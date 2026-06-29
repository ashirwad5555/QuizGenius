class PromptBuilder:
    """Utility to build prompts for the Gemini LLM."""

    @staticmethod
    def build_quiz_prompt(summary: str) -> str:
        """
        Constructs the prompt for generating a 5-question multiple choice quiz
        based on the provided Wikipedia summary context.
        """
        return f"""You are an expert educator.

Below is factual reference material retrieved from Wikipedia.
Use ONLY this information while generating the quiz.
If the information is insufficient, use only minimal general knowledge.

Reference Material:
{summary}

Generate exactly five multiple choice questions.

Each question must contain
- question
- four options
- correct answer
- explanation

CRITICAL INSTRUCTIONS FOR EDUCATION QUALITY:
1. Do NOT make any meta-references. Never mention "the reference material", "the text", "Wikipedia", "the article", "according to the passage", or similar phrases in the questions, options, or explanations. The student taking the quiz is unaware that this reference material exists.
2. Ask questions directly. For example, write: "What pigment absorbs light during photosynthesis?" instead of "According to the reference material, what pigment...".
3. Write explanations as direct, objective educational facts. Do NOT quote the text directly or say "The text states...", "As explained in the article...", or similar. Simply explain the scientific or historical fact directly.

Return ONLY valid JSON.

Format
[
 {{
   "question": "Question text here?",
   "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
   ],
   "correctAnswer": "The exact matching correct option text",
   "explanation": "Detailed explanation of the fact, explaining why the answer is correct without citing any source text."
 }}
]

Do not include markdown.
Do not include code fences.
Return JSON only."""
