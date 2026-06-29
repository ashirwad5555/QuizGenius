from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from routes.quiz_routes import quiz_bp

def create_app():
    """Application factory for the Flask app."""
    app = Flask(__name__)
    
    # Enable CORS for all routes (necessary for frontend integration)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Register blueprints
    app.register_blueprint(quiz_bp, url_prefix="/api")

    # Basic health check route
    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "message": "AI Powered Knowledge Quiz Builder API is running."
        }), 200

    # Handle 404 for undefined API routes
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({
            "error": "Not Found",
            "message": "The requested URL was not found on the server."
        }), 404

    return app

if __name__ == "__main__":
    # Validate configuration on startup
    Config.validate()
    
    app = create_app()
    print(f"Starting Flask server on port {Config.PORT} (Debug={Config.DEBUG})...")
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
