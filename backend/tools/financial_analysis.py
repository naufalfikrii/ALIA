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
You are a senior real estate financial analyst in Indonesia.
Produce a detailed feasibility financial model based on the economic data below.

Return ONLY valid JSON with EXACTLY this structure (no extra keys, no markdown):

{{
  "project_cost": {{
    "land_acquisition":        "IDR X,XXX,XXX,XXX",
    "site_preparation":        "IDR X,XXX,XXX,XXX",
    "construction":            "IDR X,XXX,XXX,XXX",
    "mep_and_utilities":       "IDR X,XXX,XXX,XXX",
    "permits_and_legal":       "IDR X,XXX,XXX,XXX",
    "marketing_and_sales":     "IDR X,XXX,XXX,XXX",
    "contingency_10pct":       "IDR X,XXX,XXX,XXX",
    "total":                   "IDR X,XXX,XXX,XXX"
  }},
  "projected_revenue": {{
    "year_1":  "IDR X,XXX,XXX,XXX",
    "year_5":  "IDR X,XXX,XXX,XXX",
    "year_10": "IDR X,XXX,XXX,XXX",
    "gdv_total": "IDR X,XXX,XXX,XXX",
    "basis": "one sentence explaining the revenue assumption"
  }},
  "returns": {{
    "roi_pct":          "XX%",
    "irr_pct":          "XX%",
    "equity_multiple":  "X.Xx",
    "roi_basis":        "one sentence explaining ROI method"
  }},
  "payback": {{
    "payback_period_years": X,
    "break_even_units_or_sqm": "XXX units / XX,XXX sqm",
    "break_even_revenue":      "IDR X,XXX,XXX,XXX",
    "break_even_note":         "one sentence"
  }},
  "risk": {{
    "overall_rating":  "low | medium | high",
    "market_risk":     "low | medium | high",
    "construction_risk": "low | medium | high",
    "regulatory_risk": "low | medium | high",
    "reasoning":       "2-3 sentences explaining the main risk factors"
  }},
  "recommendation": {{
    "verdict":   "GO | NO-GO | CONDITIONAL GO",
    "rationale": "2-3 sentences with clear reasoning",
    "conditions": ["condition 1 if CONDITIONAL GO, else empty array"]
  }}
}}

Economic Data:
{data}

Project: {project_name}
Land Area: {area} sqm
Project Type: {project_type}
Location: {location}

Use Indonesian market rates. All monetary values in IDR formatted with commas.
If data is insufficient for a field, make a reasonable market-based estimate and note it.
"""

async def run_financial_analysis(fetched: FetchedData, user_input) -> dict:
    prompt = PROMPT.format(
        data=json.dumps(fetched.economic_data, indent=2)[:4000],
        project_name=user_input.project_name,
        area=user_input.land_area_sqm,
        project_type=user_input.project_type,
        location=user_input.location,
    )
    try:
        response = await client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            response_format={"type": "json_object"},
            max_tokens=3000,
        )
        raw = response.choices[0].message.content or ""
        result = json.loads(raw)
        print(f"[FinancialAnalysis] ✅ verdict: {result.get('recommendation', {}).get('verdict', 'N/A')}")
        return result
    except Exception as e:
        print(f"[FinancialAnalysis] ❌ Failed: {e}")
        return {
            "error": str(e),
            "status": "failed",
            "project_cost":       {"total": "N/A"},
            "projected_revenue":  {"year_1": "N/A", "year_5": "N/A", "year_10": "N/A"},
            "returns":            {"roi_pct": "N/A", "irr_pct": "N/A"},
            "payback":            {"payback_period_years": "N/A"},
            "risk":               {"overall_rating": "N/A", "reasoning": str(e)},
            "recommendation":     {"verdict": "N/A", "rationale": "Analysis failed"},
        }