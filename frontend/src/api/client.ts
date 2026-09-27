import type { Complaint } from "../types/complaint";
import { ApiError, readCacheHeader, type CivicPulseApi, type ComplaintList, type ComplaintStats } from "./contracts";

function errorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("detail" in body)) return null;
  const detail = body.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  // FastAPI validation errors identify each invalid field in detail[].loc.
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((issue: unknown) => {
      if (!issue || typeof issue !== "object" || !("msg" in issue) || typeof issue.msg !== "string")
        return [];
      const field = "loc" in issue && Array.isArray(issue.loc)
        ? issue.loc.filter((part) => part !== "body" && part !== "query").join(".")
        : "";
      return [field ? `${field}: ${issue.msg}` : issue.msg];
    });
    return messages.join("; ") || null;
  }
  return null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<{ data: T; headers: Headers }> {
  let response: Response;
  try {
    response = await fetch(path, options);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error("Unable to reach the server. Please check your connection and try again.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      errorMessage(body) ?? `Request failed (HTTP ${response.status}). Please try again.`,
    );
  }
  if (body === null) throw new Error("The server returned an invalid response. Please try again.");
  return { data: body as T, headers: response.headers };
}

// Checked against backend/app/main.py and models.py. All browser requests go through nginx.
export const api: CivicPulseApi = {
  async submitComplaint(input, signal) {
    const { data } = await request<Complaint>("/api/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    return data;
  },
  async listComplaints(query, signal) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const { data } = await request<ComplaintList>(`/api/complaints?${params}`, { signal });
    return data;
  },
  async getComplaint(id, signal) {
    const { data } = await request<Complaint>(`/api/complaints/${encodeURIComponent(id)}`, { signal });
    return data;
  },
  async updateStatus(id, status, signal) {
    const { data } = await request<Complaint>(`/api/complaints/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      signal,
    });
    return data;
  },
  async getStats(signal) {
    const { data, headers } = await request<Omit<ComplaintStats, "cache">>("/api/stats", { signal });
    return { ...data, cache: readCacheHeader(headers) };
  },
};
