import json
from services.wikipedia_service import WikipediaService, TopicNotFoundError
from services.gemini_service import GeminiService, GeminiError
from utils.prompt_builder import PromptBuilder

class MalformedQuizError(Exception):
    """Exception raised when the quiz JSON structure is invalid or incomplete."""
    pass

class QuizService:
    """Orchestrator service for building quizzes using RAG and Gemini."""
    
    def __init__(self):
        self.wikipedia_service = WikipediaService()
        self.gemini_service = GeminiService()

    def generate_quiz_for_topic(self, topic: str) -> dict:
        """
        Coordinates the RAG quiz generation flow:
        1. Fetch summary from Wikipedia.
        2. Build prompt with summary.
        3. Call Gemini to generate quiz JSON.
        4. Parse and validate the quiz JSON.
        Returns a dict: { "topic": resolved_title, "questions": [...] }
        """
        # 1. Retrieve Wikipedia summary
        wiki_data = self.wikipedia_service.fetch_summary(topic)
        resolved_title = wiki_data["title"]
        summary = wiki_data["summary"]

        # 2. Build the prompt
        prompt = PromptBuilder.build_quiz_prompt(summary)

        # 3. Generate quiz using Gemini
        raw_json_str = self.gemini_service.generate_quiz(prompt)

        # 4. Parse and validate the response
        try:
            quiz_data = json.loads(raw_json_str)
        except json.JSONDecodeError as e:
            raise MalformedQuizError(f"Failed to parse quiz response as JSON: {str(e)}")

        # Validate quiz data structure
        validated_questions = self._validate_quiz_structure(quiz_data)
        
        return {
            "topic": resolved_title,
            "questions": validated_questions
        }

    def _validate_quiz_structure(self, quiz_data) -> list:
        """
        Validates the structure of the generated quiz.
        Expects a list of dictionaries with specific keys.
        """
        if not isinstance(quiz_data, list):
            raise MalformedQuizError("Quiz response is not a JSON list.")
            
        if len(quiz_data) != 5:
            # We want exactly 5 questions
            print(f"Warning: LLM generated {len(quiz_data)} questions instead of 5. Proceeding with validation.")

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
                # Sometimes the LLM might write the correct answer slightly differently,
                # let's do a case-insensitive check and try to align them, or raise error.
                matched_option = None
                for opt in options:
                    if opt.lower().strip() == correct_answer.lower().strip():
                        matched_option = opt
                        break
                if matched_option:
                    correct_answer = matched_option
                else:
                    raise MalformedQuizError(
                        f"Correct answer '{correct_answer}' at index {idx} does not match any of the options: {options}"
                    )

            if not isinstance(explanation, str) or not explanation.strip():
                raise MalformedQuizError(f"Explanation at index {idx} must be a non-empty string.")

            validated.append({
                "question": question_text.strip(),
                "options": [opt.strip() for opt in options],
                "correctAnswer": correct_answer,
                "explanation": explanation.strip()
            })

        # Cap at exactly 5 questions if more were generated, or raise error if too few
        if len(validated) < 3:
            raise MalformedQuizError(f"Generated quiz only contains {len(validated)} valid questions (minimum 3 required).")
            
        return validated[:5]
