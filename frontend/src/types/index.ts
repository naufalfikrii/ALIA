export type PipelineStage =
  | "initializing"   // backend: run exists but pipeline hasn't saved state yet
  | "idle"
  | "fetching"
  | "awaiting_human_data_review"
  | "analysing"
  | "awaiting_human_output_review"
  | "generating_pdf"
  | "completed"
  | "failed";

export type PipelineStatus = "running" | "completed" | "failed";
export type ReviewAction = "approve" | "edit" | "reject";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface UserInput {
  run_id?: string;
  project_name: string;
  location: string;
  land_area_sqm: number;
  project_type: string;
  coordinates: LatLng[];       // required — backend List[LatLng], send [] if no map selection
  additional_notes?: string;
}

export interface GuardrailResult {
  approved: boolean;
  stage: "data_check" | "output_check";
  score: number;
  issues: string[];
  suggestion?: string;
}

export interface FetchedData {
  run_id: string;
  physical_data?: Record<string, unknown>;
  legal_data?: Record<string, unknown>;
  economic_data?: Record<string, unknown>;
  fetch_attempts: number;
}

export interface AnalysisResult {
  run_id: string;
  physical_analysis?: Record<string, unknown>;
  legal_analysis?: Record<string, unknown>;
  financial_analysis?: Record<string, unknown>;
  analysis_attempts: number;
}

export interface HumanReviewDecision {
  action: ReviewAction;
  edited_fetched_data?: Record<string, unknown>;
  edited_analysis_result?: Record<string, unknown>;
  notes?: string;
}

export interface PipelineStatus_Response {
  run_id: string;
  stage: PipelineStage;
  status: PipelineStatus;
  data_score?: number;
  data_issues: string[];
  output_score?: number;
  output_issues: string[];
  pdf_ready: boolean;
}

export interface DataReviewResponse {
  run_id: string;
  stage: PipelineStage;
  guardrail_score?: number;
  guardrail_issues: string[];
  fetched_data?: FetchedData;
  instructions: string;
}

export interface OutputReviewResponse {
  run_id: string;
  stage: PipelineStage;
  guardrail_score?: number;
  guardrail_issues: string[];
  analysis_result?: AnalysisResult;
  instructions: string;
}