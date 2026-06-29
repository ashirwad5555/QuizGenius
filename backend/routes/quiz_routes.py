from flask import Blueprint, request, jsonify
import logging
from services.quiz_service import QuizService, MalformedQuizError
from services.wikipedia_service import TopicNotFoundError, WikipediaConnectionError
from services.gemini_service import GeminiError

logger = logging.getLogger("quiz_builder")

# Create the Blueprint for quiz routes
quiz_bp = Blueprint("quiz", __name__)
quiz_service = QuizService()

@quiz_bp.route("/generate", methods=["POST"])
def generate_quiz():
    """
    Endpoint to generate a 5-question quiz on a given topic.
    Expects JSON body: { "topic": "Photosynthesis", "difficulty": "Medium" }
    """
    # Parse request JSON
    data = request.get_json()
    if not data:
        return jsonify({
            "error": "Bad Request",
            "message": "Missing request body. Expected JSON."
        }), 400

    topic = data.get("topic")
    if not topic or not isinstance(topic, str) or not topic.strip():
        return jsonify({
            "error": "Bad Request",
            "message": "The 'topic' field is required and must be a non-empty string."
        }), 400

    topic = topic.strip()
    
    # Parse and validate difficulty (default to Medium)
    difficulty_input = data.get("difficulty", "Medium")
    if not isinstance(difficulty_input, str):
        difficulty_input = "Medium"
        
    difficulty = difficulty_input.strip().capitalize()
    valid_difficulties = {"Easy", "Medium", "Hard"}
    
    if difficulty not in valid_difficulties:
        return jsonify({
            "error": "Bad Request",
            "message": f"Invalid difficulty '{difficulty_input}'. Must be one of: Easy, Medium, Hard."
        }), 400
    
    logger.info(f"API Request: Generate quiz on topic='{topic}', difficulty='{difficulty}'")
    
    try:
        # Generate the quiz
        result = quiz_service.generate_quiz_for_topic(topic, difficulty)
        return jsonify(result), 200

    except TopicNotFoundError as e:
        logger.warning(f"Topic Not Found on Wikipedia: '{topic}'")
        return jsonify({
            "error": "Wikipedia Page Not Found",
            "message": str(e)
        }), 404

    except WikipediaConnectionError as e:
        logger.error(f"Wikipedia Connection Error: {str(e)}")
        return jsonify({
            "error": "Network Connection Failure",
            "message": "The server was unable to connect to Wikipedia. Please check your internet connection and try again.",
            "details": str(e)
        }), 503

    except GeminiError as e:
        return jsonify({
            "error": "Gemini API Failure",
            "message": "The AI model encountered an issue generating the quiz. Please try again.",
            "details": str(e)
        }), 502

    except MalformedQuizError as e:
        return jsonify({
            "error": "Quiz Parsing Failure",
            "message": "The quiz was generated but could not be formatted correctly. Please retry.",
            "details": str(e)
        }), 500

    except Exception as e:
        # Catch-all for any other unexpected errors
        return jsonify({
            "error": "Internal Server Error",
            "message": "An unexpected error occurred while processing your request.",
            "details": str(e)
        }), 500
