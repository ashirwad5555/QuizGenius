import requests
import wikipediaapi
import time
from config import Config

class TopicNotFoundError(Exception):
    """Exception raised when a topic is not found on Wikipedia."""
    pass

class WikipediaConnectionError(Exception):
    """Exception raised when the server cannot connect to Wikipedia due to network/DNS issues."""
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
                    raise WikipediaConnectionError(f"Failed to connect to Wikipedia Search API after {retries} attempts: {str(e)}")
                time.sleep(backoff)
                backoff *= 2

    def fetch_summary(self, topic: str) -> dict:
        """
        Retrieves the summary of a topic using a single optimized MediaWiki API request.
        It uses a search generator to search, resolve redirects, and fetch the plain text extract (summary)
        of the first search result.
        Returns a dictionary containing the resolved title and the summary text.
        Attempts up to 3 times with exponential backoff on network failure.
        """
        if not topic or not topic.strip():
            raise ValueError("Topic cannot be empty.")

        query = topic.strip()
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": query,
            "gsrlimit": 1,
            "prop": "extracts",
            "exintro": 1,
            "explaintext": 1,
            "redirects": 1,
            "format": "json"
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
                
                pages = data.get("query", {}).get("pages", {})
                if not pages:
                    raise TopicNotFoundError(f"No Wikipedia article found matching '{query}'.")
                
                # Get the first page in the dictionary
                page_id = list(pages.keys())[0]
                page_data = pages[page_id]
                
                if page_id == "-1" or "missing" in page_data:
                    raise TopicNotFoundError(f"No Wikipedia article found matching '{query}'.")
                
                resolved_title = page_data.get("title")
                summary_text = page_data.get("extract", "")
                
                if not summary_text or len(summary_text.strip()) < 50:
                    raise TopicNotFoundError(f"The Wikipedia article '{resolved_title}' has insufficient content.")
                    
                return {
                    "title": resolved_title,
                    "summary": summary_text
                }
                
            except requests.RequestException as e:
                if attempt == retries - 1:
                    raise WikipediaConnectionError(f"Failed to connect to Wikipedia API after {retries} attempts: {str(e)}")
                time.sleep(backoff)
                backoff *= 2
