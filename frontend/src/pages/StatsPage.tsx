import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ComplaintStats } from "../api/contracts";
import { ErrorState, LoadingSkeleton } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { categories, labels, priorities } from "../types/complaint";

export function StatsPage() {
  const [stats, setStats] = useState<ComplaintStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .getStats(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setStats(data);
          setLoading(false);
        }
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
  }, [revision]);

  const total = stats
    ? categories.reduce((sum, category) => sum + stats.byCategory[category], 0)
    : 0;
  const refresh = () => setRevision((value) => value + 1);

  return (
    <div className="page stats-page">
      <section className="card stats-heading page-header">
        <PageHeader
          eyebrow="Complaint overview"
          title="Complaint Statistics"
          description="Current complaint distribution across civic services."
        />
        <div className="stats-controls">
          {!loading && !error && stats && (
            <span
              role="status"
              className={`cache-badge cache-${stats.cache?.toLowerCase() ?? "unknown"}`}
            >
              {stats.cache ? `Cache ${stats.cache}` : "Cache unavailable"}
            </span>
          )}
          <button className="button" disabled={loading} onClick={refresh}>
            <Icon name="refresh" />
            {loading ? "Refreshing..." : "Refresh data"}
          </button>
        </div>
      </section>
      {loading ? (
        <section className="card">
          <LoadingSkeleton label="Loading statistics..." />
        </section>
      ) : error ? (
        <section className="card">
          <ErrorState
            title="Unable to load statistics."
            message={error}
            onRetry={refresh}
          />
        </section>
      ) : (
        stats && (
          <>
            <section className="card total-card" aria-label="Total Complaints">
              <span className="total-icon">
                <Icon name="chart" />
              </span>
              <div>
                <span className="total-label">Total Complaints</span>
                <strong className="total-count">{total}</strong>
              </div>
              <p className="total-note">Across all six complaint categories</p>
            </section>
            <div className="stats-grid">
              <section
                className="card chart-card"
                aria-labelledby="category-chart-title"
              >
                <h2 id="category-chart-title">
                  <Icon name="chart" />
                  Complaints by Category
                </h2>
                <p className="chart-description">
                  Number of complaints for each civic service.
                </p>
                <ul className="bar-list">
                  {categories.map((category) => (
                    <li key={category}>
                      <div className="bar-label">
                        <span>{labels[category]}</span>
                        <span className="bar-count">
                          {stats.byCategory[category]}
                        </span>
                      </div>
                      <div className="bar-track" aria-hidden="true">
                        <span
                          className={`bar-fill bar-${category}`}
                          style={{
                            width: `${total ? (stats.byCategory[category] / total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              <section
                className="card chart-card"
                aria-labelledby="priority-chart-title"
              >
                <h2 id="priority-chart-title">
                  <Icon name="list" />
                  Complaints by Priority
                </h2>
                <p className="chart-description">
                  Number of complaints at each priority level.
                </p>
                <ul className="priority-list">
                  {priorities.map((priority) => (
                    <li
                      className={`priority-item priority-${priority}`}
                      key={priority}
                    >
                      <span className="priority-name">
                        <span className="priority-dot" aria-hidden="true" />
                        {labels[priority]}
                      </span>
                      <strong className="priority-count">
                        {stats.byPriority[priority]}
                      </strong>
                    </li>
                  ))}
                </ul>
                <p className="stats-note">
                  Priority is returned with each complaint's triage result.
                </p>
              </section>
            </div>
          </>
        )
      )}
    </div>
  );
}
