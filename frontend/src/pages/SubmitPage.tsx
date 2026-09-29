import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Badge } from "../components/Badge";
import { ComplaintForm } from "../components/ComplaintForm";
import { Alert } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import type { Complaint, SubmitComplaintInput } from "../types/complaint";

export function SubmitPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Complaint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (result) resultHeading.current?.focus();
  }, [result]);

  async function submit(input: SubmitComplaintInput) {
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const complaint = await api.submitComplaint(input, controller.signal);
      if (!controller.signal.aborted) setResult(complaint);
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "The request could not be completed.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="page submit-page">
      <PageHeader
        eyebrow="Public service intake"
        title="Report a Civic Issue"
        description="Tell us what happened and where. CivicPulse will classify your complaint and determine its priority."
      />
      {error && (
        <div className="submit-error">
          <Alert title="Unable to submit complaint">{error}</Alert>
        </div>
      )}
      {loading && (
        <section className="card processing" role="status">
          <span className="spinner" aria-hidden="true" />
          <h2>Analyzing your complaint...</h2>
          <p>
            CivicPulse is classifying the issue and determining its priority.
          </p>
        </section>
      )}
      {result && (
        <section className="card form-card success-card">
          <div className="success-heading">
            <span className="success-icon">
              <Icon name="check" />
            </span>
            <div>
              <h2 ref={resultHeading} tabIndex={-1}>
                Complaint submitted
              </h2>
              <p>Your complaint and triage result are ready to view.</p>
            </div>
          </div>
          <p className="record-id">ID: {result.id}</p>
          <dl className="detail-grid">
            <div>
              <dt>Category</dt>
              <dd>
                <Badge kind="category" value={result.category} />
              </dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>
                <Badge kind="priority" value={result.priority} />
              </dd>
            </div>
            <div className="full-width">
              <dt>AI Summary</dt>
              <dd>{result.ai_summary ?? "No summary provided."}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>{result.triaged_by}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <Badge kind="status" value={result.status} />
              </dd>
            </div>
          </dl>
          <div className="button-row">
            <button className="button" onClick={() => setResult(null)}>
              Submit another complaint
            </button>
            <Link className="button button-secondary" to="/operations">
              View operations dashboard
              <Icon name="arrow" />
            </Link>
          </div>
        </section>
      )}
      <div hidden={loading || result !== null} key={result?.id ?? "form"}>
        <ComplaintForm onSubmit={submit} />
      </div>
    </div>
  );
}
