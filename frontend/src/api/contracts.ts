import type {
  Category,
  Complaint,
  Priority,
  Status,
  SubmitComplaintInput,
} from "../types/complaint";

export interface ComplaintQuery {
  category?: Category;
  priority?: Priority;
  status?: Status;
  page: number;
  page_size: number;
}

// ComplaintList matches backend.models.ComplaintList; stats adds the X-Cache header.
export interface ComplaintList {
  complaints: Complaint[];
  total: number;
}

export interface ComplaintStats {
  byCategory: Record<Category, number>;
  byPriority: Record<Priority, number>;
  cache: "HIT" | "MISS" | null;
}

export interface CivicPulseApi {
  submitComplaint(
    input: SubmitComplaintInput,
    signal?: AbortSignal,
  ): Promise<Complaint>;
  listComplaints(
    query: ComplaintQuery,
    signal?: AbortSignal,
  ): Promise<ComplaintList>;
  getComplaint(id: string, signal?: AbortSignal): Promise<Complaint>;
  updateStatus(
    id: string,
    status: Status,
    signal?: AbortSignal,
  ): Promise<Complaint>;
  getStats(signal?: AbortSignal): Promise<ComplaintStats>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function readCacheHeader(headers: Headers): ComplaintStats["cache"] {
  const value = headers.get("X-Cache");
  return value === "HIT" || value === "MISS" ? value : null;
}
