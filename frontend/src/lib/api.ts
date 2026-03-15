import {
  UserInput,
  PipelineStatus_Response,
  DataReviewResponse,
  OutputReviewResponse,
  HumanReviewDecision,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function startFeasibility(input: UserInput) {
  const res = await fetch(`${BASE_URL}/feasibility/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to start pipeline");
  return res.json() as Promise<{ run_id: string; status: string }>;
}

export async function getPipelineStatus(runId: string): Promise<PipelineStatus_Response> {
  const res = await fetch(`${BASE_URL}/feasibility/status/${runId}`);
  if (!res.ok) throw new Error("Run not found");
  return res.json();
}

export async function getDataForReview(runId: string): Promise<DataReviewResponse> {
  const res = await fetch(`${BASE_URL}/feasibility/review/data/${runId}`);
  if (!res.ok) throw new Error("Not ready for data review");
  return res.json();
}

export async function submitDataReview(runId: string, decision: HumanReviewDecision) {
  const res = await fetch(`${BASE_URL}/feasibility/review/data/${runId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(decision),
  });
  if (!res.ok) throw new Error("Failed to submit data review");
  return res.json();
}

export async function getOutputForReview(runId: string): Promise<OutputReviewResponse> {
  const res = await fetch(`${BASE_URL}/feasibility/review/output/${runId}`);
  if (!res.ok) throw new Error("Not ready for output review");
  return res.json();
}

export async function submitOutputReview(runId: string, decision: HumanReviewDecision) {
  const res = await fetch(`${BASE_URL}/feasibility/review/output/${runId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(decision),
  });
  if (!res.ok) throw new Error("Failed to submit output review");
  return res.json();
}

export function getDownloadUrl(runId: string) {
  return `${BASE_URL}/feasibility/download/${runId}`;
}