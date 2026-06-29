from config import Config

class PromptBuilder:
    """Utility to build prompts for the Gemini LLM."""

    @staticmethod
    def build_quiz_prompt(summary: str, topic: str, difficulty: str = "Medium") -> str:
        """
        Constructs the prompt for generating a 5-question multiple choice quiz
        by reading the template from the prompts directory and substituting placeholders.
        """
        try:
            with open(Config.PROMPT_PATH, 'r', encoding='utf-8') as f:
                template = f.read()
        except IOError as e:
            raise Exception(f"Failed to read prompt template at {Config.PROMPT_PATH}: {str(e)}")
            
        # Replace placeholders
        prompt = template.replace("{{topic}}", topic)
        # Normalize difficulty casing (e.g. "medium" -> "Medium")
        normalized_difficulty = difficulty.strip().capitalize() if difficulty else "Medium"
        prompt = prompt.replace("{{difficulty}}", normalized_difficulty)
        prompt = prompt.replace("{{context}}", summary)
        
        return prompt
