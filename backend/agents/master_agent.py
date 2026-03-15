import os
import asyncio
from memory.schema import UserInput, PipelineState, FetchedData, AnalysisResult, HumanReviewDecision
from memory.session_memory import save_state, update_state, get_state
from agents.data_search_orchestrator import run_parallel_fetch, run_selective_fetch
from agents.data_analysis_orchestrator import run_sequential_analysis
from agents.guardrails_evaluator import evaluate_fetched_data, evaluate_analysis_output
from deploy.config import settings
from tools.pdf_generator import generate_feasibility_pdf
from agents.data_distiller import distill_fetched_data 

# ── Per-run asyncio Events to pause/resume pipeline ───────────────────────
_human_review_events: dict[str, asyncio.Event] = {}

def get_review_event(run_id: str) -> asyncio.Event:
    if run_id not in _human_review_events:
        _human_review_events[run_id] = asyncio.Event()
    return _human_review_events[run_id]

def signal_human_reviewed(run_id: str):
    """Called by the API endpoint when human submits their decision."""
    event = _human_review_events.get(run_id)
    if event:
        event.set()

async def wait_for_human(run_id: str, timeout_seconds: int = 3600):
    """Pauses the pipeline until human submits decision or timeout."""
    event = get_review_event(run_id)
    event.clear()  # reset before waiting
    try:
        await asyncio.wait_for(event.wait(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        print(f"[MasterAgent] ⏱ Human review timed out for {run_id}")
        update_state(run_id, status="failed", stage="failed")
        raise

async def run_pipeline(user_input: UserInput) -> PipelineState:
    # Initialize with status="running"
    state = PipelineState(
        run_id=user_input.run_id, 
        user_input=user_input, 
        stage="fetching", 
        status="running" 
    )
    save_state(state)
    max_retries = settings.max_retry_attempts

    # ── STAGE 1: Parallel Fetch + Guardrail ───────────────────────────────
    fetched = None
    guardrail = None
    for attempt in range(1, max_retries + 1):
        update_state(state.run_id, stage="fetching")

        if attempt == 1:
            # First attempt: fetch everything
            fetched = await run_parallel_fetch(user_input, attempt)
        else:
            # Retry: only re-fetch domains that failed, using the guardrail's retry hints
            fetched = await run_selective_fetch(
                user_input=user_input,
                existing=fetched,           # keep the passing domains
                feedback=guardrail.domain_feedback,  # retry hints per domain
                attempt=attempt,
            )

        fetched = await distill_fetched_data(fetched)
        update_state(state.run_id, fetched_data=fetched)

        guardrail = await evaluate_fetched_data(
            fetched,
            location=user_input.location
        )
        update_state(state.run_id, fetched_data=fetched, data_guardrail=guardrail)

        if guardrail.approved:
            print(f"[Stage1] ✅ Guardrail passed (score: {guardrail.score})")
            break

    print(f"[Stage1] ❌ Attempt {attempt} — retrying failed domains:")
    for domain, fb in (guardrail.domain_feedback or {}).items():
        if isinstance(fb, dict) and not fb.get("passed"):
            print(f"         {domain}: {fb.get('retry_hint', 'no hint')}")

        if attempt == max_retries:
            # Don't hard-fail — pass through with what we have and let human decide
            print(f"[Stage1] ⚠️ Max retries reached, proceeding to human review anyway")
            update_state(state.run_id, stage="awaiting_human_data_review")
            break

    # ── HUMAN CHECKPOINT 1: Review fetched data ───────────────────────────
    print(f"[Stage1] ✋ Pausing for human review...")
    update_state(state.run_id, stage="awaiting_human_data_review")

    await wait_for_human(state.run_id)  # ← PIPELINE PAUSES HERE

    # Resume — read human's decision from state
    current = get_state(state.run_id)
    decision: HumanReviewDecision = current.human_data_review

    if decision.action == "reject":
        print(f"[Stage1] 🚫 Human rejected fetched data.")
        update_state(state.run_id, status="failed", stage="failed")
        return get_state(state.run_id)

    elif decision.action == "edit":
        print(f"[Stage1] ✏️ Human edited fetched data.")
        # Merge human edits into fetched
        edited = decision.edited_fetched_data or {}
        fetched = FetchedData(
            run_id=state.run_id,
            physical_data=edited.get("physical_data", fetched.physical_data),
            legal_data=edited.get("legal_data", fetched.legal_data),
            economic_data=edited.get("economic_data", fetched.economic_data),
            fetch_attempts=fetched.fetch_attempts
        )
        update_state(state.run_id, fetched_data=fetched)

    else:
        print(f"[Stage1] ✅ Human approved fetched data.")

    # ── STAGE 2: Sequential Analysis + Guardrail ──────────────────────────
    analysis = None
    for attempt in range(1, max_retries + 1):
        update_state(state.run_id, stage="analysing")
        analysis = await run_sequential_analysis(fetched, user_input, attempt)
        guardrail = await evaluate_analysis_output(analysis)
        update_state(
            state.run_id,
            analysis_result=analysis,
            output_guardrail=guardrail
        )

        if guardrail.approved and guardrail.score >= settings.guardrail_threshold:
            print(f"[Stage2] ✅ Guardrail passed (score: {guardrail.score})")
            break
        else:
            print(f"[Stage2] ❌ Guardrail failed attempt {attempt}: {guardrail.issues}")
            if attempt == max_retries:
                update_state(state.run_id, status="failed", stage="failed")
                return get_state(state.run_id)

    # ── HUMAN CHECKPOINT 2: Review analysis output ────────────────────────
    print(f"[Stage2] ✋ Pausing for human review...")
    update_state(state.run_id, stage="awaiting_human_output_review")

    await wait_for_human(state.run_id)  # ← PIPELINE PAUSES HERE

    current = get_state(state.run_id)
    decision: HumanReviewDecision = current.human_output_review

    if decision.action == "reject":
        print(f"[Stage2] 🚫 Human rejected analysis output.")
        update_state(state.run_id, status="failed", stage="failed")
        return get_state(state.run_id)

    elif decision.action == "edit":
        print(f"[Stage2] ✏️ Human edited analysis output.")
        edited = decision.edited_analysis_result or {}
        analysis = AnalysisResult(
            run_id=state.run_id,
            physical_analysis=edited.get("physical_analysis", analysis.physical_analysis),
            legal_analysis=edited.get("legal_analysis", analysis.legal_analysis),
            financial_analysis=edited.get("financial_analysis", analysis.financial_analysis),
            analysis_attempts=analysis.analysis_attempts
        )
        update_state(state.run_id, analysis_result=analysis)

    else:
        print(f"[Stage2] ✅ Human approved analysis output.")

    # ── FINAL: Generate PDF ───────────────────────────────────────────────
    update_state(state.run_id, stage="generating_pdf")
    os.makedirs(settings.output_dir, exist_ok=True)
    pdf_path = f"{settings.output_dir}/{user_input.run_id}_feasibility.pdf"
    final_state = get_state(state.run_id)
    generate_feasibility_pdf(final_state, pdf_path)

    update_state(state.run_id, status="completed", stage="completed", output_pdf_path=pdf_path)
    print(f"[MasterAgent] ✅ Done → {pdf_path}")
    return get_state(state.run_id)