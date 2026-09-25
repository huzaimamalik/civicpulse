import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ErrorBoundary } from "../src/components/ErrorBoundary";

it("catches a rendering error, offers Operations, and retries the child", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let shouldThrow = true;
  function ExamplePage() {
    if (shouldThrow) throw new Error("Render failure fixture");
    return <p>Page recovered</p>;
  }
  const suppressFixtureError = (event: ErrorEvent) => {
    if (
      event.error instanceof Error &&
      event.error.message === "Render failure fixture"
    )
      event.preventDefault();
  };
  window.addEventListener("error", suppressFixtureError);
  try {
    render(
      <ErrorBoundary>
        <ExamplePage />
      </ErrorBoundary>,
    );
  } finally {
    window.removeEventListener("error", suppressFixtureError);
  }
  expect(
    screen.getByRole("heading", { name: "Something went wrong" }),
  ).toBeVisible();
  expect(screen.getByText("We couldn't display this page.")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Return to Operations" }),
  ).toHaveAttribute("href", "/operations");
  shouldThrow = false;
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(screen.getByText("Page recovered")).toBeVisible();
});
