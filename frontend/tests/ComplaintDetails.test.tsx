import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ComplaintDetails } from "../src/components/ComplaintDetails";
import { complaintFixtures } from "../src/mocks/complaints";
import { api } from "../src/api/client";

it("offers every status for a resolved complaint and displays the exact 409 response", async () => {
  const message = "cannot transition from resolved to in_progress";
  const fetchMock = vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ detail: message }),
    { status: 409, headers: { "Content-Type": "application/json" } },
  ));
  vi.stubGlobal("fetch", fetchMock);
  const onUpdated = vi.fn();
  render(
    <ComplaintDetails
      complaint={complaintFixtures[5]}
      onClose={vi.fn()}
      onUpdate={api.updateStatus}
      onUpdated={onUpdated}
    />,
  );
  expect(
    screen
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value),
  ).toEqual(["open", "in_progress", "resolved", "rejected"]);
  await userEvent.selectOptions(
    screen.getByLabelText("New status"),
    "in_progress",
  );
  await userEvent.click(screen.getByRole("button", { name: "Update Status" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to update status",
  );
  expect(
    screen.getByText(message),
  ).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/complaints/${complaintFixtures[5].id}/status`,
    expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "in_progress" }) }),
  );
  expect(onUpdated).not.toHaveBeenCalled();
});
