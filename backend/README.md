# Quiz Builder Backend API

A modular Flask API that implements Retrieval-Augmented Generation (RAG) using Wikipedia and Google Gemini 2.5 Flash to build quizzes.

## Getting Started

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Create or edit the `.env` file:
```env
GEMINI_API_KEY=your_gemini_api_key_here
FLASK_PORT=5000
FLASK_DEBUG=True
WIKIPEDIA_USER_AGENT=QuizBuilderApp/1.0 (contact@example.com)
```

### 3. Run the Server
```bash
python app.py
```
The server will start on `http://localhost:5000`.

## Directory Structure
- `app.py`: Main entry point. Configures CORS and registers the blueprint.
- `config.py`: Loads and validates environment variables.
- `routes/`: Contains blueprint routing and handles HTTP error responses.
- `services/`: Contains independent services:
  - `wikipedia_service.py`: Resolves queries and retrieves page summaries.
  - `gemini_service.py`: Calls Gemini 2.5 Flash with JSON mode.
  - `quiz_service.py`: Orchestrates the RAG flow and validates the output JSON.
- `utils/`:
  - `prompt_builder.py`: Injects Wikipedia context into the prompt.

## API Endpoints
- `GET /health`: Basic status check.
- `POST /api/generate`: Generates a 5-question quiz.
  - Input: `{"topic": "<topic_name>"}`
  - Output: `{"topic": "<resolved_name>", "questions": [...]}`
