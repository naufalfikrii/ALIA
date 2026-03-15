# agents/guardrails_evaluator.py
import json
from openai import AsyncAzureOpenAI
from deploy.config import settings
from memory.schema import GuardrailResult, FetchedData, AnalysisResult

client = AsyncAzureOpenAI(
    api_key=settings.azure_openai_api_key,
    azure_endpoint=settings.azure_openai_endpoint,
    api_version=settings.azure_openai_api_version
)

DATA_CHECK_PROMPT = """
You are a data quality reviewer for ALIA, a real estate feasibility AI in Indonesia.
Evaluate each data domain independently. Be LENIENT — partial data is acceptable.

Scoring rules:
- physical: PASS if any roads OR amenities OR transport found. FAIL only if completely empty.
- legal: PASS if zoning OR kdb OR klb found, even partially. FAIL only if truly nothing legal found.
- economic: PASS if any price reference OR market note found. FAIL only if completely empty.

For each FAILED domain, write a specific Tavily search query (in Indonesian or English) 
that would find the missing data. Be specific to the location.

Location context: {location}

Distilled Data:
{data}

Return ONLY this JSON:
{{
  "physical": {{
    "passed": true/false,
    "confidence": "high/medium/low",
    "issue": "what is missing or null if passed",
    "retry_hint": "specific search query to find missing data, or null if passed"
  }},
  "legal": {{
    "passed": true/false,
    "confidence": "high/medium/low", 
    "issue": "what is missing or null if passed",
    "retry_hint": "specific search query, e.g. 'RTRW Jakarta Timur Rawamangun KDB KLB zoning 2024' or null"
  }},
  "economic": {{
    "passed": true/false,
    "confidence": "high/medium/low",
    "issue": "what is missing or null if passed", 
    "retry_hint": "specific search query, e.g. 'harga tanah Rawamangun per meter 2024 2025' or null"
  }},
  "overall_score": 0.0,
  "approved": true/false
}}

approved = true if AT LEAST 2 out of 3 domains passed.
overall_score = fraction of domains passed (0.33, 0.67, or 1.0) adjusted by confidence.
"""

OUTPUT_CHECK_PROMPT = """
You are reviewing the final analysis output of a real estate feasibility study.
Approve if each domain contains actual conclusions with numbers, not just restated input.

Analysis:
{data}

Return ONLY this JSON:
{{
  "physical_analysis": {{"passed": true/false, "issue": "or null"}},
  "legal_analysis":    {{"passed": true/false, "issue": "or null"}},
  "financial_analysis":{{"passed": true/false, "issue": "or null"}},
  "overall_score": 0.0,
  "approved": true/false,
  "suggestion": "what to re-analyze or null"
}}

approved = true if all 3 domains passed.
"""

async def evaluate_fetched_data(fetched: FetchedData, location: str = "") -> GuardrailResult:
    prompt = DATA_CHECK_PROMPT.format(
        location=location,
        data=fetched.model_dump_json(indent=2)
    )

    response = await client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        response_format={"type": "json_object"}
    )

    parsed = json.loads(response.choices[0].message.content)

    # Collect issues only from failed domains
    issues = []
    for domain in ["physical", "legal", "economic"]:
        d = parsed.get(domain, {})
        if not d.get("passed") and d.get("issue"):
            issues.append(f"{domain.capitalize()}: {d['issue']}")

    return GuardrailResult(
        stage="data_check",
        approved=parsed.get("approved", False),
        score=parsed.get("overall_score", 0.0),
        issues=issues,
        domain_feedback=parsed,  # full per-domain breakdown preserved
    )

async def evaluate_analysis_output(analysis: AnalysisResult) -> GuardrailResult:
    prompt = OUTPUT_CHECK_PROMPT.format(data=analysis.model_dump_json(indent=2))

    response = await client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        response_format={"type": "json_object"}
    )

    parsed = json.loads(response.choices[0].message.content)

    issues = [
        f"{k.replace('_', ' ').title()}: {v['issue']}"
        for k, v in parsed.items()
        if isinstance(v, dict) and not v.get("passed") and v.get("issue")
    ]

    return GuardrailResult(
        stage="output_check",
        approved=parsed.get("approved", False),
        score=parsed.get("overall_score", 0.0),
        issues=issues,
        suggestion=parsed.get("suggestion"),
    )