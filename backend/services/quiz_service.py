import json
import time
import logging
from services.wikipedia_service import WikipediaService, TopicNotFoundError
from services.gemini_service import GeminiService, GeminiError
from utils.prompt_builder import PromptBuilder

logger = logging.getLogger("quiz_builder")

class MalformedQuizError(Exception):
    """Exception raised when the quiz JSON structure is invalid or incomplete."""
    pass

class QuizService:
    """Orchestrator service for building quizzes using RAG and Gemini."""
    
    def __init__(self):
        self.wikipedia_service = WikipediaService()
        self.gemini_service = GeminiService()

    def generate_quiz_for_topic(self, topic: str, difficulty: str = "Medium") -> dict:
        """
        Coordinates the RAG quiz generation flow:
        1. Fetch summary from Wikipedia.
        2. Build prompt with summary and difficulty.
        3. Call Gemini to generate quiz JSON (with 1 automatic retry on failure).
        4. Parse and validate the quiz JSON.
        Returns a dict: { "topic": resolved_title, "questions": [...], "context": summary }
        """
        start_time = time.time()
        
        # 1. Retrieve Wikipedia summary
        wiki_data = self.wikipedia_service.fetch_summary(topic)
        resolved_title = wiki_data["title"]
        summary = wiki_data["summary"]

        # 2. Build the prompt
        prompt = PromptBuilder.build_quiz_prompt(summary, resolved_title, difficulty)

        # 3. Generate quiz using Gemini (with automatic retry once on JSON failure)
        max_attempts = 2
        last_error = None
        
        for attempt in range(1, max_attempts + 1):
            try:
                logger.info(f"Generating quiz for '{resolved_title}' (Difficulty: {difficulty}) - Attempt {attempt}/{max_attempts}")
                raw_json_str = self.gemini_service.generate_quiz(prompt)
                
                # 4. Parse and validate the response
                quiz_data = json.loads(raw_json_str)
                validated_questions = self._validate_quiz_structure(quiz_data, resolved_title)
                
                duration = time.time() - start_time
                logger.info(f"Successfully generated quiz for '{resolved_title}' in {duration:.2f}s on attempt {attempt}")
                
                return {
                    "topic": resolved_title,
                    "difficulty": difficulty,
                    "questions": validated_questions,
                    "context": summary,
                    "generation_time": round(duration, 2)
                }
                
            except (json.JSONDecodeError, MalformedQuizError) as e:
                last_error = e
                logger.warning(f"Attempt {attempt} failed due to malformed quiz JSON: {str(e)}")
                if attempt < max_attempts:
                    logger.info("Retrying quiz generation with Gemini...")
                    time.sleep(1) # Brief pause before retry
            except GeminiError as e:
                last_error = e
                logger.error(f"Attempt {attempt} failed due to Gemini API Error: {str(e)}")
                if attempt < max_attempts:
                    time.sleep(1)

        # If we reached here, both attempts failed
        duration = time.time() - start_time
        logger.error(f"Failed to generate quiz for '{resolved_title}' after {max_attempts} attempts in {duration:.2f}s. Error: {str(last_error)}")
        
        if isinstance(last_error, json.JSONDecodeError):
            raise MalformedQuizError(f"AI returned invalid JSON: {str(last_error)}")
        raise last_error

    def _validate_quiz_structure(self, quiz_data, default_category: str) -> list:
        """
        Validates the structure of the generated quiz.
        Expects a list of dictionaries with specific keys.
        """
        if not isinstance(quiz_data, list):
            raise MalformedQuizError("Quiz response is not a JSON list.")
            
        if len(quiz_data) != 5:
            logger.warning(f"Gemini generated {len(quiz_data)} questions instead of 5.")

        validated = []
        required_keys = {"question", "options", "correctAnswer", "explanation"}

        for idx, q in enumerate(quiz_data):
            if not isinstance(q, dict):
                raise MalformedQuizError(f"Question at index {idx} is not a JSON object.")
                
            # Check for required keys
            missing_keys = required_keys - q.keys()
            if missing_keys:
                raise MalformedQuizError(f"Question at index {idx} is missing keys: {missing_keys}")

            question_text = q["question"]
            options = q["options"]
            correct_answer = q["correctAnswer"]
            explanation = q["explanation"]
            # Fallback for category if missing
            category = q.get("category", default_category)

            # Validate types and values
            if not isinstance(question_text, str) or not question_text.strip():
                raise MalformedQuizError(f"Question text at index {idx} must be a non-empty string.")

            if not isinstance(options, list) or len(options) != 4:
                raise MalformedQuizError(f"Options at index {idx} must be a list of exactly 4 strings.")

            for opt_idx, opt in enumerate(options):
                if not isinstance(opt, str) or not opt.strip():
                    raise MalformedQuizError(f"Option {opt_idx} at question index {idx} must be a non-empty string.")

            if not isinstance(correct_answer, str) or not correct_answer.strip():
                raise MalformedQuizError(f"Correct answer at index {idx} must be a non-empty string.")

            # Make sure correct_answer matches one of the options
            if correct_answer not in options:
                # Case-insensitive alignment fallback
                matched_option = None
                for opt in options:
                    if opt.lower().strip() == correct_answer.lower().strip():
                        matched_option = opt
                        break
                if matched_option:
                    correct_answer = matched_option
                else:
                    raise MalformedQuizError(
                        f"Correct answer '{correct_answer}' at index {idx} does not match any of the options."
                    )

            if not isinstance(explanation, str) or not explanation.strip():
                raise MalformedQuizError(f"Explanation at index {idx} must be a non-empty string.")

            if not isinstance(category, str) or not category.strip():
                category = default_category

            validated.append({
                "question": question_text.strip(),
                "options": [opt.strip() for opt in options],
                "correctAnswer": correct_answer,
                "explanation": explanation.strip(),
                "category": category.strip()
            })

        if len(validated) < 3:
            raise MalformedQuizError(f"Generated quiz only contains {len(validated)} valid questions (minimum 3 required).")
            
        return validated[:5]
