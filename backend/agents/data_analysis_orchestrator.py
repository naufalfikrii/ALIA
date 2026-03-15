from memory.schema import FetchedData, AnalysisResult, UserInput
from tools.physical_analysis import run_physical_analysis
from tools.legal_analysis import run_legal_analysis
from tools.financial_analysis import run_financial_analysis

async def run_sequential_analysis(
    fetched: FetchedData,
    user_input: UserInput,
    attempt: int = 1
) -> AnalysisResult:
    """
    Stage 2: Runs 3 analyzers SEQUENTIALLY.
    Each builds on the context of the previous.
    """
    print(f"[DataAnalysisOrchestrator] Attempt {attempt} — running sequential analysis...")

    print("  → Physical Analysis...")
    physical = await run_physical_analysis(fetched, user_input)

    print("  → Legal Analysis...")
    legal = await run_legal_analysis(fetched, user_input)

    print("  → Financial Analysis...")
    financial = await run_financial_analysis(fetched, user_input)

    return AnalysisResult(
        run_id=user_input.run_id,
        physical_analysis=physical,
        legal_analysis=legal,
        financial_analysis=financial,
        analysis_attempts=attempt
    )