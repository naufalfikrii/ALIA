import asyncio
from memory.schema import UserInput, FetchedData
from fetchers.physical_data_fetcher import fetch_physical_data
from fetchers.legal_permit_researcher import fetch_legal_data
from fetchers.land_price_searcher import fetch_economic_data

async def run_parallel_fetch(user_input: UserInput, attempt: int = 1) -> FetchedData:
    """
    Stage 1: Runs all 3 fetchers in PARALLEL (MCP connected agents).
    """
    print(f"[DataSearchOrchestrator] Attempt {attempt} — fetching in parallel...")

    physical, legal, economic = await asyncio.gather(
        fetch_physical_data(user_input),
        fetch_legal_data(user_input),
        fetch_economic_data(user_input)
    )
    

    return FetchedData(
        run_id=user_input.run_id,
        physical_data=physical,
        legal_data=legal,
        economic_data=economic,
        fetch_attempts=attempt
    )

async def run_selective_fetch(user_input, existing, feedback, attempt):
    tasks = {}

    if not feedback.get("physical", {}).get("passed"):
        # This is correct — pass the coroutine object, not the result
        tasks["physical"] = fetch_physical_data(user_input)

    if not feedback.get("legal", {}).get("passed"):
        hint = feedback.get("legal", {}).get("retry_hint") or \
               f"RTRW zoning KDB KLB {user_input.location}"
        tasks["legal"] = fetch_legal_data(user_input, search_override=hint)

    if not feedback.get("economic", {}).get("passed"):
        hint = feedback.get("economic", {}).get("retry_hint") or \
               f"harga tanah per meter {user_input.location} 2025"
        tasks["economic"] = fetch_economic_data(user_input, search_override=hint)

    if not tasks:
        return existing  # nothing to retry

    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    result_map = dict(zip(tasks.keys(), results))

    return FetchedData(
        run_id=existing.run_id,
        fetch_attempts=attempt,
        physical_data=(
            result_map["physical"]
            if "physical" in result_map and not isinstance(result_map["physical"], Exception)
            else existing.physical_data
        ),
        legal_data=(
            result_map["legal"]
            if "legal" in result_map and not isinstance(result_map["legal"], Exception)
            else existing.legal_data
        ),
        economic_data=(
            result_map["economic"]
            if "economic" in result_map and not isinstance(result_map["economic"], Exception)
            else existing.economic_data
        ),
    )