from google import genai
from google.genai import types
from config import Config

class GeminiError(Exception):
    """Exception raised when Gemini API call fails."""
    pass

class GeminiService:
    """Service to interact with the Google Gemini API using the google-genai SDK."""
    
    def __init__(self):
        # Configure the client with the API key from config
        if not Config.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not set in the configuration.")
        self.client = genai.Client(api_key=Config.GEMINI_API_KEY)
        
        # Gemini 3.1 Flash Lite — fast, lightweight, generous free quota
        self.model_name = "gemini-3.1-flash-lite"

    def generate_quiz(self, prompt: str) -> str:
        """
        Sends the prompt to Gemini and returns the raw response.
        Uses response_mime_type="application/json" to guarantee a JSON response.
        """
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,  # Lower temperature for more factual adherence to the context
                )
            )
            
            if not response or not response.text:
                raise GeminiError("Received an empty response from Gemini API.")
                
            return response.text
            
        except Exception as e:
            raise GeminiError(f"Gemini API invocation failed: {str(e)}")
