import unittest
from unittest.mock import patch, MagicMock
import json
import requests

from app import create_app
from services.wikipedia_service import WikipediaService, TopicNotFoundError, WikipediaConnectionError
from services.quiz_service import QuizService, MalformedQuizError
from utils.prompt_builder import PromptBuilder

class TestQuizBuilderBackend(unittest.TestCase):
    """Test suite for the Quiz Builder backend components."""

    def setUp(self):
        # Create Flask test client
        self.app = create_app()
        self.client = self.app.test_client()
        self.app.config['TESTING'] = True

    # ==========================================================================
    # UNIT TESTS: PROMPT BUILDER
    # ==========================================================================
    def test_prompt_builder(self):
        """Test that the prompt builder correctly injects Wikipedia summaries and difficulty."""
        test_summary = "Photosynthesis is a process used by plants."
        prompt = PromptBuilder.build_quiz_prompt(test_summary, "Photosynthesis", "Hard")
        
        self.assertIn("Photosynthesis", prompt)
        self.assertIn("Hard", prompt)
        self.assertIn("Photosynthesis is a process used by plants.", prompt)
        self.assertIn("Generate exactly five multiple choice questions", prompt)
        self.assertIn("Return ONLY valid JSON.", prompt)

    # ==========================================================================
    # UNIT TESTS: WIKIPEDIA SERVICE
    # ==========================================================================
    @patch('services.wikipedia_service.requests.get')
    def test_wikipedia_service_search_success(self, mock_get):
        """Test Wikipedia search resolves to a page title successfully."""
        # Mock Wikipedia search response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "query": {
                "search": [
                    {"title": "Photosynthesis"}
                ]
            }
        }
        mock_get.return_value = mock_response

        service = WikipediaService()
        resolved_title = service.search_topic("photosynthesis")
        self.assertEqual(resolved_title, "Photosynthesis")

    @patch('services.wikipedia_service.requests.get')
    def test_wikipedia_service_search_not_found(self, mock_get):
        """Test Wikipedia search raises TopicNotFoundError when no results match."""
        # Mock empty search results
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "query": {
                "search": []
            }
        }
        mock_get.return_value = mock_response

        service = WikipediaService()
        with self.assertRaises(TopicNotFoundError):
            service.search_topic("nonexistent_topic_xyz")

    @patch('services.wikipedia_service.requests.get')
    def test_wikipedia_service_connection_error(self, mock_get):
        """Test Wikipedia search raises WikipediaConnectionError on network failure."""
        mock_get.side_effect = requests.RequestException("Connection timed out")

        service = WikipediaService()
        with self.assertRaises(WikipediaConnectionError):
            service.search_topic("photosynthesis")

    # ==========================================================================
    # UNIT & INTEGRATION TESTS: QUIZ SERVICE & VALIDATION
    # ==========================================================================
    def test_quiz_structure_validation_valid(self):
        """Test that the quiz service validates correct JSON structures."""
        valid_data = [
            {
                "question": "What is 1+1?",
                "options": ["1", "2", "3", "4"],
                "correctAnswer": "2",
                "explanation": "Because math."
            }
        ] * 5  # Duplicate to make 5 questions
        
        service = QuizService()
        validated = service._validate_quiz_structure(valid_data)
        self.assertEqual(len(validated), 5)
        self.assertEqual(validated[0]["correctAnswer"], "2")

    def test_quiz_structure_validation_invalid_keys(self):
        """Test that validation raises MalformedQuizError when keys are missing."""
        invalid_data = [
            {
                "question": "Missing keys?",
                "options": ["A", "B", "C", "D"]
                # missing correctAnswer and explanation
            }
        ] * 5
        
        service = QuizService()
        with self.assertRaises(MalformedQuizError):
            service._validate_quiz_structure(invalid_data)

    def test_quiz_structure_validation_wrong_options_count(self):
        """Test that validation raises MalformedQuizError when options count is not 4."""
        invalid_data = [
            {
                "question": "Wrong options count?",
                "options": ["A", "B", "C"], # Only 3 options
                "correctAnswer": "A",
                "explanation": "Only three options."
            }
        ] * 5
        
        service = QuizService()
        with self.assertRaises(MalformedQuizError):
            service._validate_quiz_structure(invalid_data)

    # ==========================================================================
    # INTEGRATION TESTS: FLASK API ROUTES
    # ==========================================================================
    def test_health_endpoint(self):
        """Test that the health endpoint is running and returns 200."""
        response = self.client.get('/health')
        data = json.loads(response.data.decode())
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data["status"], "healthy")

    def test_generate_endpoint_missing_body(self):
        """Test that the generate endpoint returns 400 for empty body."""
        response = self.client.post('/api/generate', json={})
        self.assertEqual(response.status_code, 400)
        
        data = json.loads(response.data.decode())
        self.assertEqual(data["error"], "Bad Request")

    @patch('backend.routes.quiz_routes.quiz_service.generate_quiz_for_topic')
    def test_generate_endpoint_success(self, mock_generate):
        """Test that the generate endpoint successfully returns a quiz when mocked."""
        # Setup mock return value
        mock_generate.return_value = {
            "topic": "Photosynthesis",
            "questions": [
                {
                    "question": "Sample Question",
                    "options": ["A", "B", "C", "D"],
                    "correctAnswer": "A",
                    "explanation": "Sample Explanation"
                }
            ] * 5
        }

        response = self.client.post('/api/generate', json={"topic": "Photosynthesis"})
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data.decode())
        self.assertEqual(data["topic"], "Photosynthesis")
        self.assertEqual(len(data["questions"]), 5)
        self.assertEqual(data["questions"][0]["question"], "Sample Question")

    @patch('backend.routes.quiz_routes.quiz_service.generate_quiz_for_topic')
    def test_generate_endpoint_not_found(self, mock_generate):
        """Test that the generate endpoint returns 404 if topic not found on Wikipedia."""
        mock_generate.side_effect = TopicNotFoundError("No Wikipedia article found.")
        
        response = self.client.post('/api/generate', json={"topic": "InvalidTopic"})
        self.assertEqual(response.status_code, 404)
        
        data = json.loads(response.data.decode())
        self.assertEqual(data["error"], "Wikipedia Page Not Found")

if __name__ == '__main__':
    unittest.main()
