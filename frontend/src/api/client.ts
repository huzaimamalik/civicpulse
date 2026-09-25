import { createMockService } from "../mocks/service";
import type { CivicPulseApi } from "./contracts";

// TODO: Verify types and implement the HTTP adapter against the real /openapi.json.
// Use relative /api/complaints and /api/stats paths, and read X-Cache from response.headers.
const scenario = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get("mock")
  : null;

export const api: CivicPulseApi = createMockService({
  failFirstList: scenario === "operations-error",
  failFirstStats: scenario === "stats-error",
  failFirstSubmit: scenario === "submit-error",
  statusConflict: scenario === "status-conflict",
});
