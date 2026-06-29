import requests
import wikipediaapi
import time
from config import Config

class TopicNotFoundError(Exception):
    """Exception raised when a topic is not found on Wikipedia."""
    pass

class WikipediaService:
    """Service to interact with the Wikipedia API for search and retrieval."""
    
    def __init__(self):
        # Initialize Wikipedia API client with the configured User-Agent
        self.wiki = wikipediaapi.Wikipedia(
            user_agent=Config.WIKIPEDIA_USER_AGENT,
            language='en'
        )
        self.search_url = "https://en.wikipedia.org/w/api.php"

    def search_topic(self, topic: str) -> str:
        """
        Searches Wikipedia for the closest matching page title.
        Returns the title of the best match.
        Raises TopicNotFoundError if no match is found.
        Attempts up to 3 times with exponential backoff on network failure.
        """
        params = {
            "action": "query",
            "list": "search",
            "srsearch": topic,
            "utf8": 1,
            "format": "json",
            "srlimit": 1
        }
        
        headers = {
            "User-Agent": Config.WIKIPEDIA_USER_AGENT
        }

        retries = 3
        backoff = 1.0
        for attempt in range(retries):
            try:
                response = requests.get(self.search_url, params=params, headers=headers, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                search_results = data.get("query", {}).get("search", [])
                if not search_results:
                    raise TopicNotFoundError(f"No Wikipedia article found matching '{topic}'.")
                
                # Return the title of the most relevant match
                return search_results[0]["title"]
                
            except requests.RequestException as e:
                if attempt == retries - 1:
                    raise Exception(f"Failed to connect to Wikipedia Search API after {retries} attempts: {str(e)}")
                time.sleep(backoff)
                backoff *= 2

    def fetch_summary(self, topic: str) -> dict:
        """
        Retrieves the summary of a topic. It first resolves the topic using search_topic,
        then fetches the summary of the resolved page.
        Returns a dictionary containing the resolved title and the summary text.
        Attempts up to 3 times with exponential backoff on network failure.
        """
        if not topic or not topic.strip():
            raise ValueError("Topic cannot be empty.")

        # 1. Resolve the topic to the best matching Wikipedia page title
        resolved_title = self.search_topic(topic.strip())

        # 2. Fetch the page content with retries
        retries = 3
        backoff = 1.0
        for attempt in range(retries):
            try:
                page = self.wiki.page(resolved_title)
                if not page.exists():
                    raise TopicNotFoundError(f"Wikipedia page for '{resolved_title}' does not exist.")
                
                # We fetch the summary, which is usually the introduction paragraphs.
                summary_text = page.summary
                
                if not summary_text or len(summary_text.strip()) < 50:
                    raise TopicNotFoundError(f"The Wikipedia article '{resolved_title}' has insufficient content.")
                    
                return {
                    "title": resolved_title,
                    "summary": summary_text
                }
                
            except Exception as e:
                if isinstance(e, TopicNotFoundError):
                    raise
                if attempt == retries - 1:
                    raise Exception(f"Failed to fetch Wikipedia page content for '{resolved_title}' after {retries} attempts: {str(e)}")
                time.sleep(backoff)
                backoff *= 2
