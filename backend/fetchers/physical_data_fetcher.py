import asyncio
import json
import aiohttp
from tavily import AsyncTavilyClient
from deploy.config import settings
from memory.schema import UserInput

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

async def _fetch_osm_data(lat: float, lng: float) -> dict:
    """Internal helper to fetch technical data from OpenStreetMap."""
    lat_str = f"{lat:.6f}"
    lng_str = f"{lng:.6f}"

    # Expanded query to include natural terrain and landuse
    query = "[out:json][timeout:30];("
    # Infrastructure & Amenities
    query += f"way(around:500,{lat_str},{lng_str})[highway];"
    query += f"node(around:1000,{lat_str},{lng_str})[amenity~\"school|hospital|bank|marketplace\"];"
    # Terrain & Landuse
    query += f"way(around:800,{lat_str},{lng_str})[landuse~\"forest|grass|water|industrial|residential|meadow\"];"
    query += f"way(around:800,{lat_str},{lng_str})[natural~\"water|wood|scrub|wetland\"];"
    query += ");out body;"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=aiohttp.ClientTimeout(total=40)
            ) as resp:
                if resp.status != 200:
                    return {"error": f"OSM HTTP {resp.status}"}
                
                data = await resp.json()
                elements = data.get("elements", [])
                
                return {
                    "roads": [
                        {"id": e["id"], "type": e.get("tags", {}).get("highway"), "name": e.get("tags", {}).get("name", "unnamed")}
                        for e in elements if e.get("type") == "way" and "highway" in e.get("tags", {})
                    ],
                    "terrain_features": [
                        {
                            "type": e.get("tags", {}).get("landuse") or e.get("tags", {}).get("natural"),
                            "area_info": "detected_polygon"
                        }
                        for e in elements if e.get("type") == "way" and ("landuse" in e.get("tags", {}) or "natural" in e.get("tags", {}))
                    ],
                    "amenities": [
                        {"id": e["id"], "type": e.get("tags", {}).get("amenity"), "name": e.get("tags", {}).get("name", "unnamed")}
                        for e in elements if e.get("type") == "node"
                    ]
                }
    except Exception as e:
        return {"error": str(e)}

async def _fetch_disaster_risk(user_input: UserInput) -> dict:
    """Internal helper to fetch disaster and terrain context from Tavily."""
    tavily = AsyncTavilyClient(api_key=settings.search_api_key)
    
    # Specific query for Indonesian disaster risks (InaRisk context)
    query = (
        f"analisis kelerengan dan jenis tanah di lokasi {user_input.location}"
    )
    
    try:
        search_result = await tavily.search(
            query=query,
            search_depth="advanced",
            max_results=4,
            include_answer=True
        )
        return {
            "disaster_summary": search_result.get("answer"),
            "risk_details": [
                {"title": r['title'], "url": r['url'], "snippet": r['content']} 
                for r in search_result.get("results", [])
            ]
        }
    except Exception as e:
        return {"error": str(e)}

async def fetch_physical_data(user_input: UserInput) -> dict:
    """
    Hybrid Physical Fetcher v3:
    - Structured Technical Data (OSM)
    - Terrain & Landuse (OSM)
    - Disaster & Environmental Audit (Tavily)
    """
    if not user_input.coordinates:
        return {"source": "skipped", "raw_content": "No coordinates provided", "status": "skipped"}

    lat = user_input.coordinates[0].lat
    lng = user_input.coordinates[0].lng

    print(f"[PhysicalFetcher] 🔄 Fetching Terrain & Disaster Audit for {user_input.location}...")

    # Run technical and disaster searches in parallel
    osm_task = _fetch_osm_data(lat, lng)
    disaster_task = _fetch_disaster_risk(user_input)
    
    osm_results, disaster_results = await asyncio.gather(osm_task, disaster_task)

    return {
        "source": "hybrid_physical_disaster_fetcher",
        "status": "success",
        "coordinates": {"lat": lat, "lng": lng},
        "technical_infrastructure": osm_results,
        "disaster_risk_audit": disaster_results,
        "terrain_type": osm_results.get("terrain_features", []) if "error" not in osm_results else "Data Unavailable"
    }