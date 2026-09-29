import { StrictMode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { App } from "../src/App";
import { api } from "../src/api/client";
import { ApiError } from "../src/api/contracts";
import type { ComplaintQuery } from "../src/api/contracts";
import { createMockService } from "../src/mocks/service";

function mockService(service: ReturnType<typeof createMockService>) {
  // Keep the real API adapter in the flow; only the HTTP boundary is simulated.
  const fetchMock = vi.fn(async (path: string, options: RequestInit = {}) => {
    const url = new URL(path, "http://localhost");
    const signal = options.signal ?? undefined;
    try {
      if (path === "/api/complaints" && options.method === "POST") {
        expect(options.headers).toEqual({ "Content-Type": "application/json" });
        return Response.json(await service.submitComplaint(JSON.parse(options.body as string), signal), { status: 201 });
      }
      if (url.pathname === "/api/complaints" && !options.method) {
        const params = Object.fromEntries(url.searchParams);
        const query = { ...params, page: Number(params.page), page_size: Number(params.page_size) } as ComplaintQuery;
        return Response.json(await service.listComplaints(query, signal));
      }
      const match = url.pathname.match(/^\/api\/complaints\/([^/]+)(\/status)?$/);
      if (match && !match[2] && !options.method)
        return Response.json(await service.getComplaint(match[1], signal));
      if (match?.[2] && options.method === "PATCH") {
        expect(options.headers).toEqual({ "Content-Type": "application/json" });
        const body = JSON.parse(options.body as string);
        expect(Object.keys(body)).toEqual(["status"]);
        return Response.json(await service.updateStatus(match[1], body.status, signal));
      }
      if (path === "/api/stats" && !options.method) {
        const { cache, ...stats } = await service.getStats(signal);
        return Response.json(stats, { headers: cache ? { "X-Cache": cache } : {} });
      }
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${path}`);
    } catch (error) {
      if (error instanceof ApiError)
        return Response.json({ detail: error.message }, { status: error.status });
      throw error;
    }
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it("submits a complaint, updates its status, filters and paginates, then shows updated stats", async () => {
  const service = createMockService({ delayMs: 0, submitDelayMs: 0 });
  let releaseSubmission!: () => void;
  const pendingSubmission = new Promise<void>((resolve) => {
    releaseSubmission = resolve;
  });
  const submit = service.submitComplaint;
  service.submitComplaint = async (input, signal) => {
    await pendingSubmission;
    return submit(input, signal);
  };
  const fetchMock = mockService(service);
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  const text = "The community notice board has a broken frame.";
  fireEvent.change(
    screen.getByLabelText("Describe the issue", { exact: false }),
    { target: { value: text } },
  );
  fireEvent.change(screen.getByLabelText("Location", { exact: false }), {
    target: { value: "Community centre, G-11" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Submit Complaint" }),
  );
  expect(screen.getByText("Analyzing your complaint...")).toBeVisible();
  releaseSubmission();
  expect(
    await screen.findByRole("heading", { name: "Complaint submitted" }),
  ).toBeVisible();
  expect(screen.getByText("rules")).toBeVisible();
  expect(screen.getByText("A civic issue has been reported and is open for review.")).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith("/api/complaints", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ text, location: "Community centre, G-11", reporter_contact: null }),
  }));

  await userEvent.click(screen.getByRole("link", { name: "Operations" }));
  expect(
    await screen.findByText("Showing 1-10 of 19 complaints"),
  ).toBeVisible();
  expect(screen.getByRole("columnheader", { name: "Action" })).toBeVisible();
  expect(screen.getAllByRole("button", { name: "View / Update" })).toHaveLength(
    10,
  );
  const complaintRow = screen.getByRole("row", {
    name: /The community notice board has a broken frame/,
  });
  await userEvent.click(
    within(complaintRow).getByRole("button", { name: "View / Update" }),
  );
  await screen.findByLabelText("New status");
  expect(
    screen.getByRole("heading", { name: "Complaint details" }),
  ).toHaveFocus();
  expect(
    screen.getAllByRole("region", { name: "Complaint details" }),
  ).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: text }));
  expect(
    screen.getByRole("heading", { name: "Complaint details" }),
  ).toHaveFocus();
  const details = screen.getByRole("region", {
    name: "Complaint details",
  });
  await userEvent.selectOptions(
    within(details).getByLabelText("New status"),
    "in_progress",
  );
  await userEvent.click(
    within(details).getByRole("button", { name: "Update Status" }),
  );
  expect(await screen.findByText("Status updated successfully.")).toBeVisible();
  expect(await serviceStatus(text)).toBe("in_progress");
  await userEvent.click(
    screen.getByRole("button", { name: "Close complaint details" }),
  );
  await userEvent.click(await screen.findByRole("button", { name: "Next" }));
  expect(
    await screen.findByText("Showing 11-19 of 19 complaints"),
  ).toBeVisible();

  await userEvent.selectOptions(
    screen.getByLabelText("Category", { exact: true }),
    "water",
  );
  await userEvent.selectOptions(
    screen.getByLabelText("Priority", { exact: true }),
    "high",
  );
  await userEvent.selectOptions(
    screen.getByLabelText("Status", { exact: true }),
    "open",
  );
  expect(await screen.findByText("Showing 1-1 of 1 complaints")).toBeVisible();
  expect(screen.getByText("Page 1 of 1")).toBeVisible();
  await userEvent.selectOptions(
    screen.getByLabelText("Priority", { exact: true }),
    "low",
  );
  expect(
    await screen.findByText("No complaints match these filters."),
  ).toBeVisible();
  await userEvent.click(
    screen.getAllByRole("button", { name: "Clear filters" })[0],
  );
  expect(
    await screen.findByText("Showing 1-10 of 19 complaints"),
  ).toBeVisible();

  await userEvent.click(screen.getByRole("link", { name: "Stats" }));
  expect(await screen.findByText("Cache MISS")).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Total Complaints" })).getByText(
      "19",
    ),
  ).toBeVisible();
});

async function serviceStatus(text: string) {
  const result = await api.listComplaints({ page: 1, page_size: 10 });
  return result.complaints.find((complaint) => complaint.text === text)?.status;
}

it("shows a request error under StrictMode and recovers on Try again", async () => {
  mockService(createMockService({ delayMs: 0, failFirstList: true }));
  render(
    <StrictMode>
      <MemoryRouter initialEntries={["/operations"]}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
  expect(screen.getByText("Loading complaints...")).toBeInTheDocument();
  expect(await screen.findByText("Unable to load complaints.")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(
    await screen.findByText("Showing 1-10 of 18 complaints"),
  ).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
