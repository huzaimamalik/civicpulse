import {
  ApiError,
  readCacheHeader,
  type CivicPulseApi,
} from "../api/contracts";
import { complaintFixtures } from "./complaints";

interface MockOptions {
  delayMs?: number;
  submitDelayMs?: number;
  failFirstList?: boolean;
  failFirstStats?: boolean;
  statusConflict?: boolean;
  failFirstSubmit?: boolean;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Request cancelled", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Request cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export function createMockService(options: MockOptions = {}): CivicPulseApi {
  const complaints = complaintFixtures.map((complaint) => ({ ...complaint }));
  let failList = options.failFirstList ?? false;
  let failStats = options.failFirstStats ?? false;
  let failSubmit = options.failFirstSubmit ?? false;
  let hasReadStats = false;
  let sequence = 0;
  const wait = (signal?: AbortSignal) => delay(options.delayMs ?? 350, signal);
  const nextTimestamp = () =>
    new Date(Date.UTC(2026, 8, 25, 9, sequence++)).toISOString();

  function findComplaint(id: string) {
    const complaint = complaints.find((item) => item.id === id);
    if (!complaint) throw new ApiError(404, "Complaint not found.");
    return complaint;
  }

  return {
    async submitComplaint(input, signal) {
      await delay(options.submitDelayMs ?? 900, signal);
      if (failSubmit) {
        failSubmit = false;
        throw new ApiError(
          503,
          "Complaint submission is temporarily unavailable. Please try again.",
        );
      }
      const timestamp = nextTimestamp();
      // A fixed response fixture demonstrates triage output without implementing classification.
      const complaint = {
        ...input,
        id: `c27c5b60-1e2a-4d82-a917-${String(sequence).padStart(12, "0")}`,
        category: "other" as const,
        priority: "normal" as const,
        status: "open" as const,
        ai_summary: "A civic issue has been reported and is open for review.",
        triaged_by: "rules" as const,
        triage_latency_ms: 18,
        created_at: timestamp,
        updated_at: timestamp,
      };
      complaints.unshift(complaint);
      hasReadStats = false;
      return { ...complaint };
    },
    async listComplaints(query, signal) {
      await wait(signal);
      if (failList) {
        failList = false;
        throw new ApiError(
          500,
          "The complaint service is temporarily unavailable.",
        );
      }
      const filtered = complaints.filter(
        (complaint) =>
          (!query.category || complaint.category === query.category) &&
          (!query.priority || complaint.priority === query.priority) &&
          (!query.status || complaint.status === query.status),
      );
      const start = (query.page - 1) * query.page_size;
      return {
        complaints: filtered
          .slice(start, start + query.page_size)
          .map((complaint) => ({ ...complaint })),
        total: filtered.length,
      };
    },
    async getComplaint(id, signal) {
      await wait(signal);
      return { ...findComplaint(id) };
    },
    async updateStatus(id, status, signal) {
      await wait(signal);
      // This explicit error fixture is independent of the current or requested status.
      if (options.statusConflict)
        throw new ApiError(
          409,
          "Invalid status transition: resolved -> in_progress",
        );
      const complaint = findComplaint(id);
      complaint.status = status;
      complaint.updated_at = nextTimestamp();
      hasReadStats = false;
      return { ...complaint };
    },
    async getStats(signal) {
      await wait(signal);
      if (failStats) {
        failStats = false;
        throw new ApiError(500, "Statistics are temporarily unavailable.");
      }
      const byCategory = {
        water: 0,
        electricity: 0,
        sanitation: 0,
        roads: 0,
        streetlights: 0,
        other: 0,
      };
      const byPriority = { high: 0, normal: 0, low: 0 };
      for (const complaint of complaints) {
        byCategory[complaint.category] += 1;
        byPriority[complaint.priority] += 1;
      }
      const headers = new Headers({ "X-Cache": hasReadStats ? "HIT" : "MISS" });
      hasReadStats = true;
      return { byCategory, byPriority, cache: readCacheHeader(headers) };
    },
  };
}
