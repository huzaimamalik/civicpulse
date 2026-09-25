import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ComplaintDetails } from "../src/components/ComplaintDetails";
import { complaintFixtures } from "../src/mocks/complaints";
import { createMockService } from "../src/mocks/service";

it("offers every status for a resolved complaint and displays the exact 409 response", async () => {
  const service = createMockService({ statusConflict: true, delayMs: 0 });
  const onUpdated = vi.fn();
  render(
    <ComplaintDetails
      complaint={complaintFixtures[5]}
      onClose={vi.fn()}
      onUpdate={service.updateStatus}
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
    screen.getByText("Invalid status transition: resolved -> in_progress"),
  ).toHaveTextContent(/^Invalid status transition: resolved -> in_progress$/);
  expect(onUpdated).not.toHaveBeenCalled();
});
