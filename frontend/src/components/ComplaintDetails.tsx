import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  labels,
  statuses,
  type Complaint,
  type Status,
} from "../types/complaint";
import { Badge } from "./Badge";
import { Alert } from "./Feedback";
import { Icon } from "./Icon";

const timestamp = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";

interface Props {
  complaint: Complaint;
  onClose: () => void;
  onUpdate: (
    id: string,
    status: Status,
    signal: AbortSignal,
  ) => Promise<Complaint>;
  onUpdated: (complaint: Complaint) => void;
}

export function ComplaintDetails({
  complaint,
  onClose,
  onUpdate,
  onUpdated,
}: Props) {
  const [targetStatus, setTargetStatus] = useState<Status>(complaint.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    heading.current?.focus();
    return () => request.current?.abort();
  }, []);

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const controller = new AbortController();
    request.current = controller;
    try {
      const updated = await onUpdate(
        complaint.id,
        targetStatus,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        onUpdated(updated);
        setSaved(true);
      }
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "The request could not be completed.",
        );
    } finally {
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return (
    <section
      className="card details-panel"
      aria-labelledby="details-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="details-header">
        <h2 ref={heading} tabIndex={-1} id="details-title">
          Complaint details
        </h2>
        <button
          className="icon-button"
          aria-label="Close complaint details"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="details-body">
        <p className="record-id">ID: {complaint.id}</p>
        <dl className="detail-grid">
          <div className="full-width">
            <dt>Complaint text</dt>
            <dd>{complaint.text}</dd>
          </div>
          <div className="full-width">
            <dt>AI Summary</dt>
            <dd>{complaint.ai_summary ?? "No summary provided."}</dd>
          </div>
          <div className="full-width">
            <dt>Location</dt>
            <dd>{complaint.location}</dd>
          </div>
          {complaint.reporter_contact && (
            <div className="full-width">
              <dt>Reporter contact</dt>
              <dd>{complaint.reporter_contact}</dd>
            </div>
          )}
          <div>
            <dt>Category</dt>
            <dd>
              <Badge kind="category" value={complaint.category} />
            </dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>
              <Badge kind="priority" value={complaint.priority} />
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <Badge kind="status" value={complaint.status} />
            </dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{complaint.triaged_by}</dd>
          </div>
          <div className="full-width">
            <dt>Triage latency</dt>
            <dd>{complaint.triage_latency_ms} ms</dd>
          </div>
          <div className="full-width">
            <dt>Created</dt>
            <dd>
              <time dateTime={complaint.created_at}>
                {timestamp(complaint.created_at)}
              </time>
            </dd>
          </div>
          <div className="full-width">
            <dt>Updated</dt>
            <dd>
              <time dateTime={complaint.updated_at}>
                {timestamp(complaint.updated_at)}
              </time>
            </dd>
          </div>
        </dl>
        <form className="status-form" onSubmit={updateStatus}>
          <h3>Update status</h3>
          {error !== null && (
            <Alert title="Unable to update status">
              <span className="server-message">{error}</span>
            </Alert>
          )}
          <label htmlFor="target-status">New status</label>
          <select
            id="target-status"
            value={targetStatus}
            disabled={saving}
            onChange={(event) => {
              setTargetStatus(event.target.value as Status);
              setError(null);
              setSaved(false);
            }}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {labels[status]}
              </option>
            ))}
          </select>
          <button type="submit" className="button" disabled={saving}>
            <Icon name="refresh" />
            {saving ? "Updating status..." : "Update Status"}
          </button>
          {saved && (
            <p role="status" className="status-success">
              Status updated successfully.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
