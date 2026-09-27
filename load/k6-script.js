import http from "k6/http";
import { check } from "k6";

// Run only against your local cluster after Alembic migrations and API smoke tests.
// k6 run --out json=load-results.json -e BASE_URL=http://civicpulse.local load/k6-script.js
// In another terminal: kubectl get hpa backend-hpa -n civicpulse -w
// Each iteration offers one real API request; no writes or POST rate-limit bypass.
const baseUrl = (__ENV.BASE_URL || "http://civicpulse.local").replace(/\/$/, "");

export const options = {
  scenarios: {
    complaints: {
      executor: "ramping-arrival-rate",
      startRate: 5,
      timeUnit: "1s",
      preAllocatedVUs: 10,
      maxVUs: 50,
      stages: [
        { duration: "30s", target: 5 },
        { duration: "2m", target: 20 },
        { duration: "3m", target: 50 },
        { duration: "30s", target: 5 },
        // Observe the HPA's 300-second scale-down stabilization window.
        { duration: "6m", target: 5 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate==0"],
    checks: ["rate==1"],
    // Dropped iterations mean the generator could not sustain the offered load.
    dropped_iterations: ["count==0"],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/api/complaints?page=1&page_size=20`, {
    timeout: "10s",
  });
  check(response, { "complaints returns 200": (result) => result.status === 200 });
}
