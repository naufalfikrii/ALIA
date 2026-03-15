from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime
import uuid

class LatLng(BaseModel):
    lat: float
    lng: float

class UserInput(BaseModel):
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_name: str
    location: str
    land_area_sqm: float
    project_type: str
    coordinates: List[LatLng] = []
    additional_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class FetchedData(BaseModel):
    run_id: str
    physical_data: Optional[dict] = None
    legal_data: Optional[dict] = None
    economic_data: Optional[dict] = None
    fetch_attempts: int = 0

class AnalysisResult(BaseModel):
    run_id: str
    physical_analysis: Optional[dict] = None
    legal_analysis: Optional[dict] = None
    financial_analysis: Optional[dict] = None
    analysis_attempts: int = 0

class DomainFeedback(BaseModel):
    passed: bool
    confidence: Literal["high", "medium", "low"]
    issue: Optional[str] = None        # what was wrong
    retry_hint: Optional[str] = None   # specific search query to retry

class GuardrailResult(BaseModel):
    approved: bool
    stage: Literal["data_check", "output_check"]
    score: float
    issues: list[str] = []
    suggestion: Optional[str] = None
    # NEW: per-domain breakdown
    domain_feedback: Optional[dict] = None 

# ── NEW: Human review decision ─────────────────────────────────────────────
class HumanReviewDecision(BaseModel):
    action: Literal["approve", "edit", "reject"]
    # If action == "edit": provide the override data
    edited_fetched_data: Optional[dict] = None    # for Stage 1 edits
    edited_analysis_result: Optional[dict] = None # for Stage 2 edits
    notes: Optional[str] = None                   # human's comment

class PipelineState(BaseModel):
    run_id: str
    user_input: UserInput
    fetched_data: Optional[FetchedData] = None
    analysis_result: Optional[AnalysisResult] = None
    data_guardrail: Optional[GuardrailResult] = None
    output_guardrail: Optional[GuardrailResult] = None

    # ── NEW fields ────────────────────────────────────────────────────────
    stage: Literal[
        "idle",
        "fetching",
        "awaiting_human_data_review",     # paused — waiting for human at Stage 1
        "analysing",
        "awaiting_human_output_review",   # paused — waiting for human at Stage 2
        "generating_pdf",
        "completed",
        "failed"
    ] = "idle"

    human_data_review: Optional[HumanReviewDecision] = None    # Stage 1 decision
    human_output_review: Optional[HumanReviewDecision] = None  # Stage 2 decision

    status: Literal["running", "completed", "failed"] = "running"
    output_pdf_path: Optional[str] = None