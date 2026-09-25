import { StrictMode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { App } from "../src/App";
import { api } from "../src/api/client";
import { createMockService } from "../src/mocks/service";

function mockService(service: ReturnType<typeof createMockService>) {
  vi.spyOn(api, "submitComplaint").mockImplementation(service.submitComplaint);
  vi.spyOn(api, "listComplaints").mockImplementation(service.listComplaints);
  vi.spyOn(api, "getComplaint").mockImplementation(service.getComplaint);
  vi.spyOn(api, "updateStatus").mockImplementation(service.updateStatus);
  vi.spyOn(api, "getStats").mockImplementation(service.getStats);
}

it("submits a complaint, updates its status, filters and paginates, then shows updated stats", async () => {
  const service = createMockService({ delayMs: 0, submitDelayMs: 0 });
  mockService(service);
  let releaseSubmission!: () => void;
  const pendingSubmission = new Promise<void>((resolve) => {
    releaseSubmission = resolve;
  });
  vi.mocked(api.submitComplaint).mockImplementation(async (input, signal) => {
    await pendingSubmission;
    return service.submitComplaint(input, signal);
  });
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
