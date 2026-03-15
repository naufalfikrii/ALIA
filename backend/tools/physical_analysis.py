from openai import AsyncAzureOpenAI
from deploy.config import settings
from memory.schema import FetchedData
import json

client = AsyncAzureOpenAI(
    api_key=settings.azure_openai_api_key,
    azure_endpoint=settings.azure_openai_endpoint,
    api_version=settings.azure_openai_api_version
)

PROMPT = """
You are a physical site analysis expert for real estate development in Indonesia.

Return ONLY valid JSON with EXACTLY this structure:
{{
  "site_suitability": {{
    "soil_condition":   "good | fair | poor — one sentence",
    "flood_risk":       "low | medium | high — one sentence",
    "topography":       "flat | gentle slope | steep — one sentence",
    "overall_score":    "low | medium | high"
  }},
  "infrastructure": {{
    "road_access":      "description of nearest roads",
    "electricity":      "available | limited | unavailable",
    "water_supply":     "available | limited | unavailable",
    "drainage":         "adequate | needs improvement | poor",
    "readiness_score":  "low | medium | high"
  }},
  "construction_constraints": ["constraint 1", "constraint 2"],
  "nearby_amenities": [
    {{"name": "amenity name", "type": "school|hospital|market|transport", "distance": "~X km"}}
  ],
  "physical_risk_score": "low | medium | high",
  "recommendations": ["recommendation 1", "recommendation 2"]
}}

Physical Data:
{data}

Project: {project_name} | Location: {location} | Area: {area} sqm
"""

async def run_physical_analysis(fetched: FetchedData, user_input) -> dict:
    prompt = PROMPT.format(
        data=json.dumps(fetched.physical_data, indent=2)[:4000],
        project_name=user_input.project_name,
        location=user_input.location,
        area=user_input.land_area_sqm
    )
    try:
        response = await client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            response_format={"type": "json_object"},
            max_tokens=2000,
        )
        raw = response.choices[0].message.content or ""
        print(f"[PhysicalAnalysis] ✅")
        return json.loads(raw)
    except Exception as e:
        print(f"[PhysicalAnalysis] ❌ Failed: {e}")
        return {"error": str(e), "status": "failed", "summary": "Physical analysis failed"}