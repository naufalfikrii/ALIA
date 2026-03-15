import asyncio
from tavily import AsyncTavilyClient
from deploy.config import settings
from memory.schema import UserInput

async def fetch_economic_data(user_input: UserInput, search_override: str = None) -> dict:
    """
    Step 1: Search across marketplaces and economic reports for market values.
    Step 2: Extract content to find actual currency numbers and market trends.
    """
    tavily = AsyncTavilyClient(api_key=settings.search_api_key)
    
    # We target marketplaces (Rumah123, Lamudi) for prices 
    # and news (Kontan, Bisnis) for macroeconomic trends.
    query = search_override or (
        f"harga tanah per meter {user_input.location} "
        f"market trend properti {user_input.project_type} 2025 2026"
    )
    
    try:
        # 1. Broad search for market listings and news
        search_response = await tavily.search(
            query=query,
            search_depth="advanced",
            max_results=5,
            include_raw_content=False,
            include_answer=True,
            # Including these domains ensures you get actual "market" prices
            include_domains=[
                "rumah123.com", "lamudi.co.id", "brighton.co.id", 
                "kontan.co.id", "bisnis.com", "olx.co.id"
            ]
        )
        
        urls = [r['url'] for r in search_response.get("results", [])]
        
        if not urls:
            return {"source": "web_search", "raw_content": "No market data found.", "results": []}

        # 2. Extract content to find the specific price per sqm numbers
        extract_response = await tavily.extract(urls=urls)
        
        combined_content = "\n\n".join([
            f"SOURCE: {res['url']}\nCONTENT:\n{res['raw_content']}" 
            for res in extract_response.get("results", [])
        ])

        print(f"[EconomicFetcher] completed ✅")

        return {
            "source": "tavily_market_extract",
            "raw_content": combined_content,
            "urls": urls
        }

    except Exception as e:
        print(f"[EconomicFetcher] Tavily economic pipeline failed: {e}")
        return {"source": "error", "message": str(e), "raw_content": ""}