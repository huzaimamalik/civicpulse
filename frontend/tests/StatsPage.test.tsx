import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { api } from "../src/api/client";
import { createMockService } from "../src/mocks/service";
import { StatsPage } from "../src/pages/StatsPage";

it("renders aggregate counts and changes from header-derived Cache MISS to Cache HIT on refresh", async () => {
  const service = createMockService({ delayMs: 0 });
  vi.spyOn(api, "getStats").mockImplementation(service.getStats);
  render(<StatsPage />);
  expect(await screen.findByText("Cache MISS")).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Total Complaints" })).getByText(
      "18",
    ),
  ).toBeVisible();
  const categoryRows = within(
    screen.getByRole("region", { name: "Complaints by Category" }),
  ).getAllByRole("listitem");
  expect(categoryRows.map((row) => row.textContent)).toEqual([
    "Water4",
    "Electricity3",
    "Sanitation3",
    "Roads3",
    "Streetlights3",
    "Other2",
  ]);
  const priorityRows = within(
    screen.getByRole("region", { name: "Complaints by Priority" }),
  ).getAllByRole("listitem");
  expect(priorityRows.map((row) => row.textContent)).toEqual([
    "High5",
    "Normal8",
    "Low5",
  ]);
  await userEvent.click(screen.getByRole("button", { name: "Refresh data" }));
  expect(await screen.findByText("Cache HIT")).toBeVisible();
  expect(screen.queryByText("Cache MISS")).not.toBeInTheDocument();
});
