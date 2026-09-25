import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ComplaintForm } from "../src/components/ComplaintForm";

describe("ComplaintForm", () => {
  it("blocks invalid lengths and focuses the first invalid field", async () => {
    const onSubmit = vi.fn();
    render(<ComplaintForm onSubmit={onSubmit} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Submit Complaint" }),
    );
    expect(
      screen.getByText("Enter a complaint between 10 and 2000 characters."),
    ).toBeVisible();
    expect(
      screen.getByText("Enter a location between 3 and 200 characters."),
    ).toBeVisible();
    expect(
      screen.getByLabelText("Describe the issue", { exact: false }),
    ).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(
      screen.getByLabelText("Describe the issue", { exact: false }),
      { target: { value: "x".repeat(2001) } },
    );
    fireEvent.change(screen.getByLabelText("Location", { exact: false }), {
      target: { value: "x".repeat(201) },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Submit Complaint" }),
    );
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts boundary lengths, updates the counter, and sends blank contact as null", async () => {
    const onSubmit = vi.fn();
    render(<ComplaintForm onSubmit={onSubmit} />);
    fireEvent.change(
      screen.getByLabelText("Describe the issue", { exact: false }),
      { target: { value: "x".repeat(2000) } },
    );
    fireEvent.change(screen.getByLabelText("Location", { exact: false }), {
      target: { value: "x".repeat(200) },
    });
    expect(screen.getByText("2000 / 2000")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Submit Complaint" }),
    );
    expect(onSubmit).toHaveBeenCalledWith({
      text: "x".repeat(2000),
      location: "x".repeat(200),
      reporter_contact: null,
    });
  });
});
