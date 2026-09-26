# ADR 0002: Frontend runtime API routing

Status: Accepted

## Context

CivicPulse's React application is built with Vite into static JavaScript.
Using `VITE_API_URL` would bake an environment-specific backend address into
that bundle and require a new frontend build when the backend address changes.

## Decision

The React application's HTTP API calls use relative `/api` URLs. nginx serves
the built frontend on port 8080 and proxies `/api/*` to `http://backend:8000`
in Compose. `proxy_pass` has no URI suffix, so `/api/complaints` reaches the
backend as `/api/complaints`. Other frontend routes fall back to `index.html`.

The existing deterministic frontend mocks stay in place for now. The later
HTTP adapter must follow this routing decision when Partner A's OpenAPI schema
is ready for integration.

## Consequences

- One frontend image can run across environments without rebuilding React.
- Backend addresses remain runtime infrastructure concerns. Docker and
  Kubernetes service discovery stay outside React.
- nginx or Ingress routing becomes part of runtime configuration and must
  preserve the `/api` prefix. The bundled nginx configuration expects a
  backend service named `backend` on port 8000.
