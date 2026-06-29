import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).resolve().parent / '.env'
load_dotenv(dotenv_path=env_path)

class Config:
    """Application configuration loaded from environment variables."""
    
    # Gemini API Configuration
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    
    # Flask Configuration
    PORT = int(os.getenv("FLASK_PORT", 5000))
    DEBUG = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1", "t", "y", "yes")
    
    # Wikipedia API Configuration
    # Wikipedia API requires a descriptive User-Agent header
    WIKIPEDIA_USER_AGENT = os.getenv(
        "WIKIPEDIA_USER_AGENT", 
        "QuizBuilderApp/1.0 (contact@example.com)"
    )

    @classmethod
    def validate(cls):
        """Validates that critical configurations are set."""
        if not cls.GEMINI_API_KEY or cls.GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
            print("WARNING: GEMINI_API_KEY is not set or is using the default placeholder in .env!")
            return False
        return True
