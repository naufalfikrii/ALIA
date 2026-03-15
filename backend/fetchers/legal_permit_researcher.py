import asyncio
from tavily import AsyncTavilyClient
from deploy.config import settings
from memory.schema import UserInput

async def fetch_legal_data(user_input: UserInput, search_override: str = None) -> dict:
    """
    Legal Researcher 2.0 - Sequential Strategy:
    1. Identify Zone/Land Type (Search 1).
    2. Search for Technical Regulations (KDB/KLB) specific to that Zone (Search 2).
    3. Extract detailed Markdown content from the best sources.
    """
    # Initialize Tavily client
    tavily = AsyncTavilyClient(api_key=settings.search_api_key)
    location = user_input.location
    project_type = user_input.project_type
    
    try:
        # STEP 1: Identify the Specific Zone Type
        print(f"[LegalFetcher] Step 1: Identifying zone type for {project_type} in {location}...")
        zone_discovery_query = f"Apa tipe zona peruntukan lahan (zonasi) untuk {project_type} di {location} menurut RDTR GISTARU?"
        
        zone_search = await tavily.search(
            query=zone_discovery_query,
            search_depth="advanced",
            max_results=2,
            include_answer=True,
            include_domains=["oss.go.id", "atrbpn.go.id", "gistaru.atrbpn.go.id"]
        )
        
        # Safety check for zone_search response
        if not zone_search:
            return {"source": "error", "message": "Tavily search returned None in Step 1", "status": "failed"}

        detected_zone = zone_search.get("answer", "Unknown Zone")
        print(f"[LegalFetcher] Detected context: {detected_zone[:100]}...")

        # STEP 2: Technical Regulation Discovery
        print(f"[LegalFetcher] Step 2: Discovering technical regs for {detected_zone[:30]}...")
        technical_query = search_override or (
            f"Berapa nilai KDB, KLB, GSB, dan Koefisien Dasar Hijau untuk {detected_zone} "
            f"di {location} berdasarkan peraturan RDTR terbaru"
        )
        
        tech_search = await tavily.search(
            query=technical_query,
            search_depth="advanced",
            max_results=4,
            include_answer=True
        )
        
        # FIX: Defensive check for tech_search and filtering out None results
        if not tech_search or not tech_search.get("results"):
            return {
                "source": "error",
                "message": "No technical results found in sequential search.",
                "status": "failed",
                "raw_content": ""
            }

        # Safely extract URLs, skipping any result 'r' that is None
        urls = [r.get('url') for r in tech_search.get("results", []) if r and isinstance(r, dict) and r.get('url')]
        
        if not urls:
            return {"source": "error", "message": "No valid URLs found in results.", "status": "failed"}

        # STEP 3: Extract Clean Markdown from technical sources
        print(f"[LegalFetcher] Step 3: Extracting markdown from {len(urls)} sources...")
        extract_response = await tavily.extract(urls=urls)
        
        if not extract_response:
            return {"source": "error", "message": "Extraction failed: returned None", "status": "failed"}

        combined_markdown = ""
        results_list = []
        
        # FIX: Added safety checks inside the extraction loop
        for res in extract_response.get("results", []):
            if not res or not isinstance(res, dict):
                continue
                
            content = res.get('raw_content', '')
            url = res.get('url', 'Unknown Source')
            
            results_list.append({
                "url": url,
                "content": content
            })
            combined_markdown += f"\n\n--- SOURCE: {url} ---\n{content}"

        print(f"[LegalFetcher] completed ✅")

        return {
            "source": "tavily_legal_sequential",
            "detected_zone": detected_zone,
            "technical_summary": tech_search.get("answer"),
            "raw_content": combined_markdown,
            "metadata": {
                "location": location,
                "project": project_type,
                "urls_found": urls
            },
            "status": "success"
        }

    except Exception as e:
        print(f"[LegalFetcher] Sequential pipeline failed: {e}")
        return {
            "source": "error",
            "message": f"Legal fetcher exception: {str(e)}",
            "status": "failed",
            "raw_content": ""
        }