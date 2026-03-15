from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    # Azure OpenAI
    azure_openai_api_key: str
    azure_openai_endpoint: str          # e.g. https://YOUR-RESOURCE.openai.azure.com/
    azure_openai_deployment: str        # e.g. gpt-4o
    azure_openai_api_version: str = "2024-02-01"

    # MCP Server
    mcp_server_url: str = "http://localhost:8001"
    mcp_api_key: str = ""

    # Web Search (Bing or Tavily)
    search_api_key: str = ""
    search_provider: str = "tavily"     # "tavily" | "bing"

    # App
    max_retry_attempts: int = 3
    guardrail_threshold: float = 0.3   # min score to approve
    output_dir: str = "./outputs"

    class Config:
        env_file = ".env"

settings = Settings()