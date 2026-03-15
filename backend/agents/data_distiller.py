import json
import re
from openai import AsyncAzureOpenAI
from deploy.config import settings
from memory.schema import FetchedData

client = AsyncAzureOpenAI(
    api_key=settings.azure_openai_api_key,
    azure_endpoint=settings.azure_openai_endpoint,
    api_version=settings.azure_openai_api_version
)

def clean_raw(data: dict) -> str:
    """
    Aggressively strip everything that isn't useful text.
    Reduces a 50,000 char Tavily dump to ~2,000 chars of actual content.
    """
    text = json.dumps(data, ensure_ascii=False)

    # Remove all base64 / CDN image paths (eyJ... is base64 JSON from Lamudi/proppit)
    text = re.sub(r'eyJ[A-Za-z0-9+/=]{10,}', '', text)
    # Remove full image URLs
    text = re.sub(r'https?://[^\s"\']+\.(jpg|jpeg|png|svg|webp|gif)[^\s"\']*', '', text, flags=re.IGNORECASE)
    # Remove CDN/image host URLs entirely
    text = re.sub(r'https?://(img\.|images\.|multimedia\.|dtc77|proppit|cloudfront)[^\s"\']*', '', text)
    # Remove markdown image tags  ![]()
    text = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', text)
    # Remove markdown links but keep the label  [text](url) → text
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Remove property listing IDs and internal ref codes
    text = re.sub(r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b', '', text)
    # Remove JSON escape sequences and leftover punctuation clutter
    text = re.sub(r'\\[nrt"]', ' ', text)
    # Remove lines that are just punctuation or very short (nav items, arrows, etc)
    lines = [l.strip() for l in text.splitlines()]
    lines = [l for l in lines if len(l) > 20]
    text = ' '.join(lines)
    # Collapse repeated whitespace
    text = re.sub(r'\s{2,}', ' ', text)

    return text[:4000]  # hard cap — LLM only needs the first ~4k chars of clean text


DISTILL_PROMPT = """
You are a real estate data analyst for ALIA. 
Summarize the input into a SHORT, FACTUAL JSON. Be concise — maximum 2-3 bullet points per field.
Only include facts that are explicitly stated. Use null if not found.

Return ONLY this JSON:
{{
  "physical": {{
    "roads": ["max 3 road names near the site"],
    "amenities": ["max 5: hospital/school/market names with rough distance if stated"],
    "terrain": "one word: flat/hilly/flood-prone or null",
    "transport": ["max 3: train stations, toll gates, bus stops"]
  }},
  "legal": {{
    "zoning": "exact zoning type or null",
    "kdb": "e.g. 60% or null",
    "klb": "e.g. 2.4 or null",
    "notes": "one sentence max, or null"
  }},
  "economic": {{
    "price_per_sqm": "e.g. Rp 15.000.000/m² or null",
    "price_range": "e.g. Rp 12jt–18jt/m² or null",
    "sample_listings": [
      "max 3 listings: area m², total price, location — e.g. '90m² Rp4.8M Rawamangun'"
    ],
    "market_note": "one sentence: trend or investment outlook, or null"
  }},
  "data_quality": {{
    "physical": "high/medium/low",
    "legal": "high/medium/low",
    "economic": "high/medium/low"
  }},
  "missing": ["max 3 most important missing fields"]
}}

DATA:
Physical: {physical}
Legal: {legal}
Economic: {economic}
"""

async def distill_fetched_data(fetched: FetchedData) -> FetchedData:
    physical_clean  = clean_raw(fetched.physical_data  or {})
    legal_clean     = clean_raw(fetched.legal_data     or {})
    economic_clean  = clean_raw(fetched.economic_data  or {})

    print(f"[Distiller] Input sizes — physical: {len(physical_clean)}, legal: {len(legal_clean)}, economic: {len(economic_clean)} chars")

    prompt = DISTILL_PROMPT.format(
        physical=physical_clean,
        legal=legal_clean,
        economic=economic_clean,
    )

    response = await client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        response_format={"type": "json_object"}
    )

    distilled = json.loads(response.choices[0].message.content)
    print(f"[Distiller] ✅ Done — missing: {distilled.get('missing', [])}")

    return FetchedData(
        run_id=fetched.run_id,
        fetch_attempts=fetched.fetch_attempts,
        physical_data={
            "summary": distilled.get("physical", {}),
            "quality": distilled["data_quality"]["physical"],
        },
        legal_data={
            "summary": distilled.get("legal", {}),
            "quality": distilled["data_quality"]["legal"],
        },
        economic_data={
            "summary": distilled.get("economic", {}),
            "quality": distilled["data_quality"]["economic"],
            "missing": distilled.get("missing", []),
        },
    )