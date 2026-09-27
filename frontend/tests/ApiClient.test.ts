import { expect, it, vi } from "vitest";
import { api } from "../src/api/client";
import { complaintFixtures } from "../src/mocks/complaints";

it("sends pagination and filters, omits unset filters, and forwards cancellation", async () => {
  const result = { complaints: [complaintFixtures[0]], total: 21 };
  const fetchMock = vi.fn().mockImplementation(async () => Response.json(result));
  vi.stubGlobal("fetch", fetchMock);
  const controller = new AbortController();
  expect(await api.listComplaints({ page: 2, page_size: 10, category: "water", priority: "high", status: "open" }, controller.signal)).toEqual(result);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/complaints?page=2&page_size=10&category=water&priority=high&status=open",
    { signal: controller.signal },
  );
  await api.listComplaints({ page: 1, page_size: 10, category: undefined });
  expect(fetchMock).toHaveBeenLastCalledWith("/api/complaints?page=1&page_size=10", { signal: undefined });
});

it.each([400, 422])("preserves field messages from HTTP %s validation errors", async (status) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ detail: [
    { type: "string_too_short", loc: ["body", "text"], msg: "String should have at least 10 characters", input: "short", ctx: { min_length: 10 } },
    { type: "string_too_short", loc: ["body", "location"], msg: "String should have at least 3 characters", input: "x", ctx: { min_length: 3 } },
  ] }, { status })));
  await expect(api.submitComplaint({ text: "short", location: "x" })).rejects.toMatchObject({
    name: "ApiError", status,
    message: "text: String should have at least 10 characters; location: String should have at least 3 characters",
  });
});

it.each([
  [404, "complaint not found"],
  [409, "cannot transition from resolved to in_progress"],
  [429, "rate limit exceeded"],
])("retains HTTP %s and its exact server detail", async (status, message) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ detail: message }, { status })));
  await expect(api.updateStatus(complaintFixtures[5].id, "in_progress")).rejects.toMatchObject({ status, message });
});

it("gives useful errors for a non-JSON server failure and an unreachable server", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(new Response("<html>Bad Gateway</html>", { status: 502 }))
    .mockRejectedValueOnce(new TypeError("Failed to fetch")));
  await expect(api.getStats()).rejects.toMatchObject({ status: 502, message: "Request failed (HTTP 502). Please try again." });
  await expect(api.getStats()).rejects.toThrow("Unable to reach the server. Please check your connection and try again.");
});

it("preserves cancellation instead of reporting a network failure", async () => {
  const controller = new AbortController();
  controller.abort();
  const error = new DOMException("Request cancelled", "AbortError");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
  await expect(api.getStats(controller.signal)).rejects.toBe(error);
});
