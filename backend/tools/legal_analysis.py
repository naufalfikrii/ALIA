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
You are a legal and regulatory expert for real estate in Indonesia.

Return ONLY valid JSON with EXACTLY this structure:
{{
  "zoning": {{
    "classification":     "zone code or name e.g. Perumahan Kepadatan Sedang",
    "compliance_status":  "compliant | partial | non-compliant",
    "compliance_note":    "one sentence"
  }},
  "building_parameters": {{
    "kdb_bcr_allowed":   "XX%",
    "klb_far_allowed":   "X.X",
    "max_floors":        "X floors",
    "gsb_setback":       "X meters"
  }},
  "required_permits": [
    {{"permit": "permit name", "issuer": "issuing body", "est_duration": "X months", "difficulty": "easy|moderate|hard"}}
  ],
  "legal_risks": [
    {{"risk": "description", "severity": "low|medium|high", "mitigation": "mitigation step"}}
  ],
  "compliance_recommendations": ["recommendation 1", "recommendation 2"],
  "overall_legal_risk": "low | medium | high"
}}

Legal Data:
{data}

Project: {project_name} | Type: {project_type} | Location: {location}
"""

async def run_legal_analysis(fetched: FetchedData, user_input) -> dict:
    prompt = PROMPT.format(
        data=json.dumps(fetched.legal_data, indent=2)[:4000],
        project_name=user_input.project_name,
        project_type=user_input.project_type,
        location=user_input.location
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
        print(f"[LegalAnalysis] ✅")
        return json.loads(raw)
    except Exception as e:
        print(f"[LegalAnalysis] ❌ Failed: {e}")
        return {"error": str(e), "status": "failed", "summary": "Legal analysis failed"}