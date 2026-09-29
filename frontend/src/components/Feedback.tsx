import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Alert({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="alert" role="alert">
      <Icon name="alert" />
      <div>
        <strong>{title}</strong>
        {children && <div className="alert-message">{children}</div>}
      </div>
    </div>
  );
}

export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="state-panel">
      <Alert title={title}>{message}</Alert>
      <button className="button button-secondary" onClick={onRetry}>
        <Icon name="refresh" />
        Try again
      </button>
    </div>
  );
}

export function LoadingSkeleton({ label }: { label: string }) {
  return (
    <div className="loading-skeleton" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: 5 }, (_, i) => (
        <div className="skeleton-row" key={i} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
