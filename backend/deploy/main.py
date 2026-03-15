from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from memory.schema import UserInput, HumanReviewDecision
from memory.session_memory import get_state, update_state
from agents.master_agent import run_pipeline, signal_human_reviewed

app = FastAPI(
    title="Real Estate Feasibility API",
    description="Human-in-the-loop multi-agent pipeline",
    version="2.0.0"
)

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

# ── Core pipeline ──────────────────────────────────────────────────────────

@app.post("/feasibility/run")
async def start_feasibility(user_input: UserInput, background_tasks: BackgroundTasks):
    run_id = user_input.run_id 
    background_tasks.add_task(run_pipeline, user_input)
    return {"run_id": run_id, "status": "started"}

@app.get("/feasibility/status/{run_id}")
async def get_status(run_id: str):
    """Poll pipeline stage and progress."""
    state = get_state(run_id)
    state = get_state(run_id)
    if not state:
        return {
            "run_id": run_id,
            "stage": "initializing",
            "status": "running",
            "pdf_ready": False
        }
    return {
        "run_id": run_id,
        "stage": state.stage,
        "status": state.status,
        "data_score": state.data_guardrail.score if state.data_guardrail else None,
        "data_issues": state.data_guardrail.issues if state.data_guardrail else [],
        "output_score": state.output_guardrail.score if state.output_guardrail else None,
        "output_issues": state.output_guardrail.issues if state.output_guardrail else [],
        "pdf_ready": state.output_pdf_path is not None,
    }

# ── Human review endpoints ─────────────────────────────────────────────────

@app.get("/feasibility/review/data/{run_id}")
async def get_data_for_review(run_id: str):
    """
    Human opens this to SEE the fetched data before deciding.
    Only available when stage == awaiting_human_data_review
    """
    state = get_state(run_id)
    if not state:
        raise HTTPException(status_code=404, detail="Run not found")
    if state.stage != "awaiting_human_data_review":
        raise HTTPException(status_code=400, detail=f"Not awaiting data review. Current stage: {state.stage}")
    return {
        "run_id": run_id,
        "stage": state.stage,
        "guardrail_score": state.data_guardrail.score if state.data_guardrail else None,
        "guardrail_issues": state.data_guardrail.issues if state.data_guardrail else [],
        "fetched_data": state.fetched_data.model_dump() if state.fetched_data else None,
        "instructions": "Submit your decision to POST /feasibility/review/data/{run_id}"
    }

@app.post("/feasibility/review/data/{run_id}")
async def submit_data_review(run_id: str, decision: HumanReviewDecision):
    """
    Human submits: approve / edit / reject for Stage 1 fetched data.
    - approve: pipeline continues as-is
    - edit: provide edited_fetched_data with your changes
    - reject: pipeline stops
    """
    state = get_state(run_id)
    if not state:
        raise HTTPException(status_code=404, detail="Run not found")
    if state.stage != "awaiting_human_data_review":
        raise HTTPException(status_code=400, detail=f"Not awaiting data review. Current stage: {state.stage}")

    update_state(run_id, human_data_review=decision)
    signal_human_reviewed(run_id)  # ← unpauses the pipeline

    return {
        "run_id": run_id,
        "action_received": decision.action,
        "message": "Decision submitted. Pipeline resuming."
    }

@app.get("/feasibility/review/output/{run_id}")
async def get_output_for_review(run_id: str):
    """
    Human opens this to SEE the analysis output before deciding.
    Only available when stage == awaiting_human_output_review
    """
    state = get_state(run_id)
    if not state:
        raise HTTPException(status_code=404, detail="Run not found")
    if state.stage != "awaiting_human_output_review":
        raise HTTPException(status_code=400, detail=f"Not awaiting output review. Current stage: {state.stage}")
    return {
        "run_id": run_id,
        "stage": state.stage,
        "guardrail_score": state.output_guardrail.score if state.output_guardrail else None,
        "guardrail_issues": state.output_guardrail.issues if state.output_guardrail else [],
        "analysis_result": state.analysis_result.model_dump() if state.analysis_result else None,
        "instructions": "Submit your decision to POST /feasibility/review/output/{run_id}"
    }

@app.post("/feasibility/review/output/{run_id}")
async def submit_output_review(run_id: str, decision: HumanReviewDecision):
    """
    Human submits: approve / edit / reject for Stage 2 analysis output.
    - approve: generates PDF immediately
    - edit: provide edited_analysis_result with your changes
    - reject: pipeline stops
    """
    state = get_state(run_id)
    if not state:
        raise HTTPException(status_code=404, detail="Run not found")
    if state.stage != "awaiting_human_output_review":
        raise HTTPException(status_code=400, detail=f"Not awaiting output review. Current stage: {state.stage}")

    update_state(run_id, human_output_review=decision)
    signal_human_reviewed(run_id)  # ← unpauses the pipeline

    return {
        "run_id": run_id,
        "action_received": decision.action,
        "message": "Decision submitted. Pipeline resuming."
    }

# ── Output ─────────────────────────────────────────────────────────────────

@app.get("/feasibility/download/{run_id}")
async def download_pdf(run_id: str):
    """Download the final feasibility study PDF."""
    state = get_state(run_id)
    if not state or not state.output_pdf_path:
        raise HTTPException(status_code=404, detail="PDF not ready or run not found")
    return FileResponse(
        state.output_pdf_path,
        media_type="application/pdf",
        filename=f"feasibility_{run_id}.pdf"
    )

@app.get("/health")
async def health():
    return {"status": "ok"}
