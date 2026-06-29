import google.generativeai as genai
from config import Config

class GeminiError(Exception):
    """Exception raised when Gemini API call fails."""
    pass

class GeminiService:
    """Service to interact with the Google Gemini API."""
    
    def __init__(self):
        # Configure the SDK with the API key from config
        if not Config.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not set in the configuration.")
        genai.configure(api_key=Config.GEMINI_API_KEY)
        
        # We use the requested gemini-2.5-flash model
        self.model_name = "gemini-2.5-flash"

    def generate_quiz(self, prompt: str) -> str:
        """
        Sends the prompt to Gemini 2.5 Flash and returns the raw response.
        Uses response_mime_type="application/json" to guarantee a JSON response.
        """
        try:
            model = genai.GenerativeModel(self.model_name)
            
            # Enforce JSON output using the generation_config
            response = model.generate_content(
                prompt,
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0.2, # Lower temperature for more factual adherence to the context
                }
            )
            
            if not response or not response.text:
                raise GeminiError("Received an empty response from Gemini API.")
                
            return response.text
            
        except Exception as e:
            raise GeminiError(f"Gemini API invocation failed: {str(e)}")
