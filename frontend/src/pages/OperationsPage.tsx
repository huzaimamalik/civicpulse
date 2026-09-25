import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { ComplaintList, ComplaintQuery } from "../api/contracts";
import { Badge } from "../components/Badge";
import { ComplaintDetails } from "../components/ComplaintDetails";
import { ErrorState, LoadingSkeleton } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import {
  categories,
  labels,
  priorities,
  statuses,
  type Complaint,
} from "../types/complaint";

const pageSize = 10;
const initialQuery: ComplaintQuery = { page: 1, page_size: pageSize };
const shortDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));

export function OperationsPage() {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<ComplaintList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Complaint | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRevision, setDetailRevision] = useState(0);
  const trigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .listComplaints(query, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, Math.ceil(data.total / pageSize));
        if (query.page > lastPage) {
          setQuery((current) => ({ ...current, page: lastPage }));
          return;
        }
        setResult(data);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "The request could not be completed.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [query, revision]);

  useEffect(() => {
    if (!selectedId) return;
    document.getElementById("details-title")?.focus();
    const controller = new AbortController();
    setDetail(null);
    setDetailError(null);
    api
      .getComplaint(selectedId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setDetail(data);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setDetailError(
            reason instanceof Error
              ? reason.message
              : "The request could not be completed.",
          );
      });
    return () => controller.abort();
  }, [selectedId, detailRevision]);

  function changeFilter(
    key: "category" | "priority" | "status",
    value: string,
  ) {
    setQuery((current) => ({ ...current, [key]: value || undefined, page: 1 }));
  }

  function closeDetails() {
    setSelectedId(null);
    if (trigger.current?.isConnected) trigger.current.focus();
    else document.getElementById("operations-title")?.focus();
  }

  function openDetails(id: string, button: HTMLButtonElement) {
    trigger.current = button;
    setSelectedId(id);
    if (selectedId === id) document.getElementById("details-title")?.focus();
  }

  return (
    <div className="page operations-page">
      <PageHeader
        eyebrow="Complaint management"
        title="Operations"
        description="Review, filter and manage incoming civic complaints."
      >
        <p className="operations-heading-note">Most recent complaints first</p>
      </PageHeader>
      <div className={`operations-grid${selectedId ? " has-details" : ""}`}>
        <div className="list-panel">
          <section
            className="card filter-card"
            aria-label="Complaint filters"
            id="operations-title"
            tabIndex={-1}
          >
            <div className="filters">
              <div className="filter-field">
                <label htmlFor="category-filter">Category</label>
                <select
                  id="category-filter"
                  value={query.category ?? ""}
                  onChange={(event) =>
                    changeFilter("category", event.target.value)
                  }
                >
                  <option value="">All Categories</option>
                  {categories.map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="priority-filter">Priority</label>
                <select
                  id="priority-filter"
                  value={query.priority ?? ""}
                  onChange={(event) =>
                    changeFilter("priority", event.target.value)
                  }
                >
                  <option value="">All Priorities</option>
                  {priorities.map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="status-filter">Status</label>
                <select
                  id="status-filter"
                  value={query.status ?? ""}
                  onChange={(event) =>
                    changeFilter("status", event.target.value)
                  }
                >
                  <option value="">All Statuses</option>
                  {statuses.map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="filter-meta">
              <button
                className="button-quiet"
                onClick={() => setQuery(initialQuery)}
              >
                Clear filters
              </button>
              <span aria-live="polite">
                {!loading && !error && result
                  ? result.total > 0
                    ? `Showing ${(query.page - 1) * pageSize + 1}-${Math.min(query.page * pageSize, result.total)} of ${result.total} complaints`
                    : "0 complaints"
                  : " "}
              </span>
            </div>
          </section>
          <section
            className="card table-card"
            aria-label="Complaints"
            aria-busy={loading}
          >
            {loading ? (
              <LoadingSkeleton label="Loading complaints..." />
            ) : error ? (
              <ErrorState
                title="Unable to load complaints."
                message={error}
                onRetry={() => setRevision((value) => value + 1)}
              />
            ) : result?.total === 0 ? (
              <div className="state-panel empty-state">
                <span className="empty-icon">
                  <Icon name="list" />
                </span>
                <h2>No complaints match these filters.</h2>
                <p>Clear the filters to see all complaints.</p>
                <button
                  className="button button-secondary"
                  onClick={() => setQuery(initialQuery)}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              result && (
                <>
                  <div className="table-scroll">
                    <table className="complaints-table">
                      <caption className="sr-only">
                        Civic complaints. Select a complaint to view its
                        details.
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Complaint</th>
                          <th scope="col" className="location-column">
                            Location
                          </th>
                          <th scope="col">Category</th>
                          <th scope="col">Priority</th>
                          <th scope="col">Status</th>
                          <th scope="col">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.complaints.map((complaint) => (
                          <tr
                            key={complaint.id}
                            className={
                              selectedId === complaint.id ? "selected" : ""
                            }
                          >
                            <td>
                              <button
                                className="complaint-link"
                                aria-expanded={selectedId === complaint.id}
                                onClick={(event) =>
                                  openDetails(complaint.id, event.currentTarget)
                                }
                              >
                                <span className="complaint-preview">
                                  {complaint.text}
                                </span>
                              </button>
                              <time
                                className="table-date"
                                dateTime={complaint.created_at}
                              >
                                {shortDate(complaint.created_at)}
                              </time>
                            </td>
                            <td className="location-column">
                              <span className="table-location">
                                {complaint.location}
                              </span>
                            </td>
                            <td>
                              <Badge
                                value={complaint.category}
                                kind="category"
                              />
                            </td>
                            <td>
                              <Badge
                                value={complaint.priority}
                                kind="priority"
                              />
                            </td>
                            <td>
                              <Badge value={complaint.status} kind="status" />
                            </td>
                            <td className="action-column">
                              <button
                                className="button button-secondary complaint-action"
                                aria-expanded={selectedId === complaint.id}
                                onClick={(event) =>
                                  openDetails(complaint.id, event.currentTarget)
                                }
                              >
                                View / Update
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={query.page}
                    total={result.total}
                    pageSize={pageSize}
                    onChange={(page) =>
                      setQuery((current) => ({ ...current, page }))
                    }
                  />
                </>
              )
            )}
          </section>
        </div>
        {selectedId &&
          (detail?.id === selectedId ? (
            <ComplaintDetails
              key={selectedId}
              complaint={detail}
              onClose={closeDetails}
              onUpdate={api.updateStatus}
              onUpdated={(updated) => {
                setDetail(updated);
                setRevision((value) => value + 1);
              }}
            />
          ) : (
            <section
              className="card details-panel"
              aria-label="Complaint details"
            >
              <div className="details-header">
                <h2 id="details-title" tabIndex={-1}>
                  Complaint details
                </h2>
                <button
                  className="icon-button"
                  aria-label="Close complaint details"
                  onClick={closeDetails}
                >
                  <Icon name="close" />
                </button>
              </div>
              {detailError ? (
                <ErrorState
                  title="Unable to load complaint."
                  message={detailError}
                  onRetry={() => setDetailRevision((value) => value + 1)}
                />
              ) : (
                <LoadingSkeleton label="Loading complaint details..." />
              )}
            </section>
          ))}
      </div>
    </div>
  );
}
