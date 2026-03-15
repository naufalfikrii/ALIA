import { PipelineStage } from "@/types";

export const STAGE_ORDER: PipelineStage[] = [
  "initializing",
  "idle",
  "fetching",
  "awaiting_human_data_review",
  "analysing",
  "awaiting_human_output_review",
  "generating_pdf",
  "completed",
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  initializing:                 "Initializing",
  idle:                         "Queued",
  fetching:                     "Fetching Data",
  awaiting_human_data_review:   "Data Review",
  analysing:                    "Analysis",
  awaiting_human_output_review: "Output Review",
  generating_pdf:               "Generating PDF",
  completed:                    "Completed",
  failed:                       "Failed",
};

export const STAGE_DESCRIPTIONS: Record<PipelineStage, string> = {
  initializing:                 "Pipeline is starting up — saving initial state…",
  idle:                         "Pipeline is queued and ready to start",
  fetching:                     "Agents are gathering physical, legal and economic data in parallel",
  awaiting_human_data_review:   "Fetched data is ready. Your review is required before analysis begins.",
  analysing:                    "Sequential analysis agents are processing the approved data",
  awaiting_human_output_review: "Analysis is complete. Your review is required before the report is generated.",
  generating_pdf:               "Compiling the final feasibility study document",
  completed:                    "The feasibility study is ready for download",
  failed:                       "The pipeline encountered an error and was stopped",
};

/** Stages shown in the progress tracker (skip idle/initializing — they're fleeting) */
export const DISPLAY_STAGES: PipelineStage[] = [
  "fetching",
  "awaiting_human_data_review",
  "analysing",
  "awaiting_human_output_review",
  "generating_pdf",
  "completed",
];

export function getStageIndex(stage: PipelineStage): number {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx === -1 ? 0 : idx;
}

export function isHumanReviewStage(stage: PipelineStage): boolean {
  return (
    stage === "awaiting_human_data_review" ||
    stage === "awaiting_human_output_review"
  );
}

/** True when the pipeline has reached a terminal state and polling must stop */
export function isTerminal(stage: PipelineStage, status: string): boolean {
  return stage === "completed" || stage === "failed" || status === "completed" || status === "failed";
}