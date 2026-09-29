# CivicPulse frontend

React 18, Vite and TypeScript. This session implements the frontend with in-memory mocks. No backend server is needed.

## Run locally

Use Node 22.12 or newer.

```sh
cd frontend
npm install
npm run dev
```

Open the local address printed by Vite. Routes are `/` (Submit Complaint), `/operations` and `/stats`.

```sh
npm run build
npm run typecheck
npm run lint
npm test
```

`npm run preview` serves the built frontend locally. Deployment must eventually serve `index.html` for frontend routes and proxy `/api` separately. That infrastructure is outside this session.

## Structure

- `src/pages`: Submit, Operations and Stats views.
- `src/components`: layout, form, details panel, error boundary and shared presentation.
- `src/types/complaint.ts`: domain values and complaint fields from the shared contract.
- `src/api/contracts.ts`: typed frontend service interface, error and result types.
- `src/api/client.ts`: the single service instance used by pages.
- `src/mocks`: fixtures and deterministic asynchronous service behavior.
- `tests`: a small initial component suite, using Vitest and Testing Library.

## Mock behavior and manual checks

The header identifies mock data. The initial 18 complaints cover every category, priority, status and provider. Contact addresses are fictional. Dates and UUIDs are deterministic. Changes last until a full browser reload; navigation retains them.

- Submit fewer than 10 complaint characters or fewer than 3 location characters to see validation. Maximum lengths are 2000 and 200, respectively. Values above the limits remain visible with an error instead of being silently truncated. The counter counts Unicode code points, like Python string length.
- A submission takes 900 ms. Its fixed response is `other`, `normal`, `rules`, and `open`, with a fixture summary. This demonstrates rendering returned values; it does not classify the input or implement an AI provider.
- In Operations, combine the three filters and use Previous/Next. Filters reset pagination. `Water` + `Low` produces the empty state with the initial data.
- Select a complaint to load its details. Escape or the close button closes the panel and restores focus to the row when it is still present.
- Every status stays available in the selector. Normal mock requests succeed regardless of transition. There is no frontend transition table.
- For the deterministic 409 demo, open `/operations?mock=status-conflict`, open the resolved Blue Area drain complaint, choose In Progress, and update. The fixture returns `Invalid status transition: resolved -> in_progress` verbatim. In this scenario every update returns that same canned error, independently of both statuses. It is an error fixture, not a status validator.
- Open `/operations?mock=operations-error` to see the request error, then use Try again. The first completed list request fails once; the retry succeeds.
- `/stats?mock=stats-error` and `/?mock=submit-error` provide equivalent one-time failures. Submit errors retain the form values.
- Stats initially displays Cache MISS, then Cache HIT after Refresh data. A submission or status update resets the next stats response to MISS. Counts are derived from the current mock complaints. This simulates response headers without implementing a cache server or TTL.
- An application-level error boundary catches render failures. The component test exercises its fallback and retry without a public crash control.

Scenario query parameters are read at startup in development only. Load their URLs directly or reload after changing them. No scenario controls appear in the product UI. Production builds still use the normal mock service until backend integration.

## Backend handoff

TODO: Verify complaint types and the typed client against Partner A's real `/openapi.json` before connecting the backend. This is not an OpenAPI-generated client.

The references do not specify exact list, aggregate or error JSON envelopes. `ComplaintList` and `ComplaintStats` are internal frontend service results only. The future HTTP adapter must map actual response bodies to these results, preserve server error messages exactly in `ApiError.message`, and read stats cache metadata from `response.headers` using `readCacheHeader`. A missing or unexpected cache header must not be presented as HIT or MISS.

Replace the mock instance in `src/api/client.ts` with an implementation of `CivicPulseApi`. Use only relative paths:

- `POST /api/complaints`
- `GET /api/complaints?category=...&priority=...&status=...&page=...&page_size=...`
- `GET /api/complaints/{id}`
- `PATCH /api/complaints/{id}/status`
- `GET /api/stats`

Confirm request and response envelopes, field-level 400 errors, 429 and Retry-After behavior, and the 409 message field with Partner A. No absolute backend URL or backend URL environment variable is needed. The backend remains responsible for all validation, triage and status transition rules.

The initial suite has seven tests, including an application flow for submission, navigation, status updates, combined filters, pagination and updated counts, plus request-error recovery under StrictMode. The dedicated testing session should expand boundary cases, cancellation, zero aggregates, responsive browser checks and real adapter behavior.

Desktop and mobile CSS follow the supplied screenshots. Visual browser verification remains open because this implementation environment had no connected browser. The three local routes were checked over HTTP, and component behavior was checked in jsdom.
