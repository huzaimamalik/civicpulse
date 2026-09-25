import {
  labels,
  type Category,
  type Priority,
  type Status,
} from "../types/complaint";

export function Badge({
  value,
  kind,
}: {
  value: Category | Priority | Status;
  kind: "category" | "priority" | "status";
}) {
  return (
    <span className={`badge badge-${kind} badge-${value}`}>
      {kind === "status" && <span className="badge-dot" />}
      {labels[value]}
    </span>
  );
}
