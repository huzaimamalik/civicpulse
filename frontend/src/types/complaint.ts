export const categories = [
  "water",
  "electricity",
  "sanitation",
  "roads",
  "streetlights",
  "other",
] as const;
export const priorities = ["high", "normal", "low"] as const;
export const statuses = [
  "open",
  "in_progress",
  "resolved",
  "rejected",
] as const;

export type Category = (typeof categories)[number];
export type Priority = (typeof priorities)[number];
export type Status = (typeof statuses)[number];
export type Provider = "llm:groq" | "llm:ollama" | "rules" | "rules:fallback";

export interface Complaint {
  id: string;
  text: string;
  location: string;
  reporter_contact: string | null;
  category: Category;
  priority: Priority;
  status: Status;
  ai_summary: string | null;
  triaged_by: Provider;
  triage_latency_ms: number;
  created_at: string;
  updated_at: string;
}

export interface SubmitComplaintInput {
  text: string;
  location: string;
  reporter_contact: string | null;
}

export const labels: Record<Category | Priority | Status, string> = {
  water: "Water",
  electricity: "Electricity",
  sanitation: "Sanitation",
  roads: "Roads",
  streetlights: "Streetlights",
  other: "Other",
  high: "High",
  normal: "Normal",
  low: "Low",
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  rejected: "Rejected",
};
