# AI-Powered Knowledge Quiz Builder (RAG MVP)

An interview-ready, production-quality Single Page Application (SPA) that dynamically generates 5-question multiple-choice quizzes on any topic. By utilizing **Retrieval-Augmented Generation (RAG)**, it fetches factual reference material from Wikipedia before querying **Google Gemini 2.5 Flash** to synthesize the quiz, preventing AI hallucinations and ensuring factual accuracy.

---

## Architecture Diagram

The diagram below outlines the flow of data from the frontend to Wikipedia (Retrieval), through prompt construction (Context Injection), and finally through the Gemini API (Generation) to return structured JSON.

```mermaid
graph TD
    A[Frontend: index.html / app.js] -->|1. POST /api/generate <br> {topic: "Photosynthesis"}| B[Backend: Flask API]
    B -->|2. Search & Fetch Summary| C[Wikipedia Service]
    C -->|3. Retrieve Summary Context| B
    B -->|4. Pass Summary Context| D[Prompt Builder]
    D -->|5. Format Prompt with Context| B
    B -->|6. Call Gemini 2.5 Flash <br> with JSON Mode| E[Gemini Service]
    E -->|7. Generate Structured JSON| B
    B -->|8. Validate Quiz Structure| F[Quiz Service]
    F -->|9. Send Validated Quiz JSON| A
    A -->|10. Render Quiz / Persist in LocalStorage| G[Browser UI & History]
```

---

## Folder Structure

```text
quiz-builder/
├── backend/
│   ├── app.py                # Flask application factory and CORS configuration
│   ├── config.py             # Environment configuration and validation
│   ├── services/
│   │   ├── __init__.py
│   │   ├── gemini_service.py     # Invokes Gemini 2.5 Flash (enforces JSON)
│   │   ├── wikipedia_service.py  # Searches & fetches Wikipedia summaries
│   │   └── quiz_service.py       # Orchestrates the RAG flow & validates JSON
│   ├── routes/
│   │   ├── __init__.py
│   │   └── quiz_routes.py        # API routing and HTTP error mapping
│   ├── utils/
│   │   ├── __init__.py
│   │   └── prompt_builder.py     # Injects retrieved context into prompt templates
│   ├── requirements.txt      # Python backend dependencies
│   └── .env                  # Environment variables (API Keys)
│
├── frontend/
│   ├── index.html            # Main SPA dashboard
│   ├── css/
│   │   └── style.css         # Custom CSS (Glassmorphism, dark-mode, responsive)
│   ├── js/
│   │   └── app.js            # SPA state manager, API caller, local storage history
│   └── assets/               # Placeholder for icons/images
│
└── README.md                 # Project documentation
```

---

## Setup & Installation

### 1. Prerequisites
- **Python 3.9+** installed.
- A **Google Gemini API Key** (obtainable from [Google AI Studio](https://aistudio.google.com/)).

### 2. Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # Activate on Windows:
   venv\Scripts\activate
   # Activate on macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   - Rename or edit the `.env` file and replace `YOUR_GEMINI_API_KEY_HERE` with your actual API key:
     ```env
     GEMINI_API_KEY=AIzaSy...
     FLASK_PORT=5000
     FLASK_DEBUG=True
     WIKIPEDIA_USER_AGENT=QuizBuilderApp/1.0 (contact@your-email.com)
     ```
5. Run the Flask server:
   ```bash
   python app.py
   ```
   The backend will start at `http://localhost:5000`.

### 3. Frontend Setup
You can run the frontend in one of two ways:
- **Option A: Serve via local server (Recommended)**
  Run a simple Python server from the `frontend` folder:
  ```bash
  cd ../frontend
  python -m http.server 8000
  ```
  Then open `http://localhost:8000` in your web browser.
- **Option B: Open directly**
  Double-click `frontend/index.html` to open it in your browser (uses the `file://` protocol). *Note: CORS is fully enabled on the backend, so this will work perfectly.*

---

## API Endpoints

### 1. Health Check
* **URL**: `/health`
* **Method**: `GET`
* **Response**: `200 OK`
  ```json
  {
    "status": "healthy",
    "message": "AI Powered Knowledge Quiz Builder API is running."
  }
  ```

### 2. Generate Quiz
* **URL**: `/api/generate`
* **Method**: `POST`
* **Headers**: `Content-Type: application/json`
* **Body**:
  ```json
  {
    "topic": "Photosynthesis"
  }
  ```
* **Response**: `200 OK`
  ```json
  {
    "topic": "Photosynthesis",
    "questions": [
      {
        "question": "What pigment absorbs light during photosynthesis?",
        "options": [
          "Chlorophyll",
          "Carotenoid",
          "Anthocyanin",
          "Melanin"
        ],
        "correctAnswer": "Chlorophyll",
        "explanation": "Chlorophyll is the primary pigment in plants that absorbs light energy, primarily in the blue and red wavelengths."
      },
      ...
    ]
  }
  ```
* **Error Responses**:
  * `400 Bad Request`: If the `topic` field is missing or empty.
  * `404 Not Found`: If no matching Wikipedia page is found.
  * `502 Bad Gateway`: If the Gemini API call fails (invalid key, quota limits, etc.).
  * `500 Internal Server Error`: If the response from the LLM is malformed or invalid.

---

## Design Decisions

### 1. Why Retrieval-Augmented Generation (RAG) Was Implemented
Large Language Models (LLMs) are prone to **hallucinations**—generating plausible-sounding but factually incorrect statements. For educational tools (like quizzes), accuracy is critical. 
By implementing RAG:
* We anchor the LLM's generation to **Wikipedia's factual summaries**.
* The LLM is explicitly instructed to *use only the provided reference material*.
* This guarantees that questions, answers, and explanations are rooted in verified public knowledge, preventing the model from hallucinating non-existent facts.

### 2. Layered Service Architecture
The backend is split into distinct, single-responsibility layers:
* **Wikipedia Service**: Dedicated to searching the MediaWiki API and fetching text summaries. It has no awareness of LLMs.
* **Prompt Builder**: Synthesizes prompt text. It contains no API logic, making it easily testable.
* **Gemini Service**: Handles API communication with Google Gemini. It enforces JSON output using native Gemini parameters.
* **Quiz Service (Orchestrator)**: Glues the retrieval, prompt building, LLM call, and parsing together. Crucially, it validates the returned JSON schema to ensure the frontend never receives invalid data.

### 3. Native JSON Mode
We configure the Gemini API call with `response_mime_type="application/json"`. Rather than relying on regex or string replacement to strip markdown fences (like ` ```json `), the model is forced at the decoding level to output a clean, parsable JSON string.

---

## Tradeoffs

1. **Wikipedia Summary vs. Full Article**:
   * *Tradeoff*: We fetch only the `summary` of the Wikipedia page (the introduction) rather than the full article.
   * *Reason*: The introduction contains the most high-density, general-knowledge facts about a topic. Passing the entire article would exceed token limits for long pages, increase API latency, and increase costs.
   * *Mitigation*: For extremely niche topics, the summary might be brief. The prompt instructs the LLM to fallback to minimal general knowledge if the reference material is insufficient.

2. **No Backend Database (Local Storage only)**:
   * *Tradeoff*: User history is stored in the browser's `localStorage` rather than a database.
   * *Reason*: Keeps the MVP lightweight, fast, and easy to deploy without needing database setup (SQLite, Postgres, etc.).
   * *Mitigation*: The UI provides a history sidebar allowing users to review and reload past quizzes locally.

---

## Future Improvements

1. **Vector DB for Deep RAG**: Chunk full Wikipedia articles and store them in a vector database (like Chroma or FAISS) to perform semantic search and retrieve highly specific context passages.
2. **User Authentication**: Add login capabilities so users can sync their quiz history across devices.
3. **Custom Quiz Settings**: Allow users to select difficulty level, number of questions, and language.
4. **Export Quiz**: Support downloading quizzes as PDFs or sharing links with students.
#   Q u i z G e n i u s 
 
 