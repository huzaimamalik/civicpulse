import { Component, type ReactNode } from "react";
import { Icon } from "./Icon";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="boundary-page">
          <section
            className="card boundary-card"
            aria-labelledby="boundary-title"
          >
            <span className="boundary-icon">
              <Icon name="alert" />
            </span>
            <h1 id="boundary-title">Something went wrong</h1>
            <p>We couldn't display this page.</p>
            <div className="button-row">
              <button
                className="button"
                onClick={() => this.setState({ hasError: false })}
              >
                <Icon name="refresh" />
                Try again
              </button>
              <a className="button button-secondary" href="/operations">
                Return to Operations
              </a>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
