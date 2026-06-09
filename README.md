# Handprint

A handprint is the positive, reducing counterpart to a carbon footprint: it measures the emissions you choose to cut, not just the ones you produce.

Handprint is a personal carbon accounting platform for transport, food, and home energy. Its primary vertical is transport. Research consensus identifies transport mode shifts, car-free choices, and EV adoption as the highest per-year lifestyle mitigation potential, and transport generates the most automatable logging signals. Food and home energy are tracked as secondary categories under the same accounting engine.

## Brief mapping

| Brief element | Implementation |
|---|---|
| Understand | Per-activity CO2e from deterministic pure functions over 22 cited emission factors. Each saved result carries its source citation and effective year. The methodology panel surfaces the full factor table inline. |
| Track | Persistent activity log across sessions. The dashboard shows footprint over time by category, benchmark comparison to the global average and a 1.5 C-aligned daily budget (5.75 kg CO2e/day, IPCC AR6 2023), and a consecutive-day logging streak. The full core flow works with no sign-up: the session starts as an anonymous user and can optionally upgrade to an email account. |
| Reduce | Command-pattern what-if simulator with three scenarios (EV swap, mode shift, trip reduction), each projecting annual kg CO2e savings scaled from the user's logged trip history. Users can commit to scenarios as pledges with active/completed/abandoned lifecycle tracking. |
| Simple actions | Low-friction manual log for transport (mode + distance), food (item + weight), and home energy (source + quantity). Natural-language trip descriptions are parsed by Vertex AI Gemini into a pre-filled, editable transport form. |
| Personalized insights | Vertex AI Gemini narrates the user's pre-computed carbon aggregates in 2-3 sentences and suggests a reduction action for the highest emission category. Gemini receives only the already-calculated totals; it never produces a carbon number. If Vertex AI is unavailable, a rule-based fallback covers the same logic. Response is tagged `"source": "gemini"` or `"source": "rules"`. |

## Architecture

```
Browser
  |
  |  HTTPS + Bearer token
  v
web  [Next.js 15, TypeScript strict, Tailwind v4]      Cloud Run, asia-south1
  |
  |  REST + Bearer token
  v
api  [FastAPI, Python 3.12, Pydantic v2]               Cloud Run, asia-south1
  |               |                 |                  Application Default Credentials
  v               v                 v
Firestore     Vertex AI        Distance Matrix
Native mode   Gemini            Maps API
(activity     (parse trip       (driving km for
 logs,         text; narrate    emission calc;
 pledges,      computed         manual km fallback
 streaks)      results)         if API absent)
```

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 15, TypeScript strict | App Router with server/client split; type safety enforced at build time |
| Styling | Tailwind v4 | Utility-first CSS, zero runtime, dark theme via zinc/emerald palette |
| Backend | FastAPI, Python 3.12 | Async ASGI, native Pydantic v2 integration, typed from models to routes |
| Validation | Pydantic v2 | Schema-level field bounds on every input; no manual range checks |
| Data | Cloud Firestore, Native mode | Per-user document collections; no schema migration required |
| LLM | Vertex AI Gemini | Structured JSON output for trip parsing; rule-based fallback for narration |
| Deploy | Cloud Run, asia-south1 | Scale-to-zero, source-based deploy, ADC removes all credential management |
| Logging | structlog JSON to stdout | Structured logs captured by Cloud Run; secret-shaped strings redacted before emit |

## Google services

The table below lists only services with an active code path running in the deployed application.

| Service | Role | Call site |
|---|---|---|
| Cloud Run | Host both containerized services at scale-to-zero | [api/Dockerfile](api/Dockerfile), [web/Dockerfile](web/Dockerfile) |
| Vertex AI (Gemini) | Parse free-text trip descriptions (`parse_trip`); narrate computed insight summaries (`narrate_insights`) | [api/app/clients/vertex.py:68](api/app/clients/vertex.py), [api/app/clients/vertex.py:126](api/app/clients/vertex.py) called from [POST /trips/parse](api/app/routes/trips.py) and [GET /insights](api/app/routes/insights.py) |
| Cloud Firestore | Persist activity logs, committed actions, streak data per user | [api/app/core/dependencies.py:157](api/app/core/dependencies.py) creates `AsyncClient`; used by all five repositories in [api/app/repositories/](api/app/repositories/) |
| Cloud Build | Build and push container images from source on `gcloud run deploy --source` | [api/Dockerfile](api/Dockerfile), [web/Dockerfile](web/Dockerfile) |

**Services coded but not active in this deployment:**

- **Firebase Authentication** ([api/app/middleware/auth.py](api/app/middleware/auth.py), [web/src/lib/auth-context.tsx](web/src/lib/auth-context.tsx)): `auth.verify_id_token()` is implemented and will run when a real Firebase project is configured. The deployed demo has no Firebase project; the frontend sends `mock-id-token-xyz` and the middleware intercepts it at line 34 before Firebase token verification is reached.
- **Maps Distance Matrix** ([api/app/clients/distance_matrix.py](api/app/clients/distance_matrix.py)): `DistanceMatrixClient.get_distance()` makes a real HTTP call to the Maps API when a key is provided. No Maps API key was configured at deploy time; the client returns a 12.5 km stub (line 25). The route `GET /trips/distance` exists and is wired to the client.
- **PlacesClient** and **AirQualityClient** ([api/app/clients/places.py](api/app/clients/places.py), [api/app/clients/air_quality.py](api/app/clients/air_quality.py)): constructor-only stubs; no methods, not called from any route.

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | /health | Liveness probe; Cloud Run startup and readiness check |
| GET | /.well-known/security.txt | Security contact metadata |
| POST | /trips | Log a travel trip; computes CO2e deterministically |
| GET | /trips | List trips for the authenticated user |
| GET | /trips/distance | Resolve driving distance via Distance Matrix |
| POST | /trips/parse | Parse natural-language trip text via Vertex AI |
| POST | /trips/simulate | Run a what-if reduction scenario |
| POST | /food | Log a food consumption activity |
| GET | /food | List food logs for the authenticated user |
| POST | /energy | Log a utility energy activity |
| GET | /energy | List energy logs for the authenticated user |
| POST | /committed_actions | Create a reduction commitment |
| GET | /committed_actions | List committed actions for the authenticated user |
| PATCH | /committed_actions/{id} | Update committed action status |
| GET | /streaks | Retrieve consecutive-day logging streak |
| GET | /insights | Retrieve personalized carbon narrative |

## How it works

**Request to compute to persist (transport example):**

1. User selects a transport mode and enters a distance, or uses the natural-language autofill via `POST /trips/parse`.
2. Frontend sends `POST /trips { mode, distance_km }` with the user's Bearer token.
3. Auth middleware verifies the token (Firebase or mock). Input sanitizer normalizes Unicode (NFC) and strips control, zero-width, and bidirectional-override characters.
4. `TransportEstimator.estimate()` computes `co2e_kg = distance_km * factor.value` as a deterministic pure function.
5. Result is written to Firestore with the factor's source citation and effective year. Streak is updated in a non-blocking soft-degradation block.
6. Dashboard aggregates all Firestore logs by category and renders trend and benchmark data.

**Design boundary:**

Carbon numbers come only from deterministic, unit-tested pure functions over the cited factor table. Vertex AI Gemini receives pre-computed totals and narrates them. The prompt explicitly instructs the model not to extrapolate or compute new values ([api/app/clients/vertex.py](api/app/clients/vertex.py), `narrate_insights`). This boundary is tested via the [eval harness](api/eval/run_eval.py) and the golden-case suite.

## Running locally

**Backend:**

```bash
cd api
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Without `GOOGLE_CLOUD_PROJECT` set, the API falls back to in-memory Firestore mode. Vertex AI requires Application Default Credentials (`gcloud auth application-default login`); without them, AI routes fall back to the rule-based engine automatically.

**Frontend:**

```bash
cd web
npm install
# create web/.env.local with: NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

**Eval harness (credential-free):**

```bash
cd api
MOCK_EVAL=1 uv run python eval/run_eval.py
```

## Testing

**Backend test suite** ([api/tests/](api/tests/)):

```bash
cd api
uv run pytest --cov=app --cov-report=term-missing
```

| Suite | Scale | Status |
|---|---|---|
| Backend unit + route tests | 127 test functions in 25 files; 144 cases executed (some functions are parametrized), 5 skipped (emulator) | Pass; cover estimators, routes, auth, middleware, repositories, security, rate limiting |
| Eval golden cases | 22 cases | 22/22 pass; deterministic calculations verified against expected CO2e values |
| Playwright E2E + axe | 4 specs in [web/tests/e2e.spec.ts](web/tests/e2e.spec.ts) | axe-core WCAG 2 A/AA scans wired for dashboard, trip log, simulator, and auth pages. Behavioral selector assertions in the specs (e.g., `#mode-radio-ev_car`, `#food-weight-input`) do not match the current page element IDs; behavioral steps are not fully passing. |

Test areas covered: all estimator factor paths, simulation command edge cases, streak logic boundary conditions, route validation bounds, rate limiter trip, body-size cap rejection, auth failure, CSRF origin enforcement, sanitizer Unicode and control-character handling, security header policy assertions, secret redaction in logs.

## Accessibility

Implemented and exercised by Playwright + axe-core specs in [web/tests/e2e.spec.ts](web/tests/e2e.spec.ts):

- Skip-to-content link targeting `#main-content`; visible on keyboard focus.
- Semantic landmarks: `<main id="main-content">`, `<nav>`, `<header>`, one `<h1>` per page.
- Tab list uses `role="tablist"`; each tab has `role="tab"`, `aria-selected`, and keyboard navigation (ArrowLeft/ArrowRight per ARIA spec).
- Form errors use `role="alert"`. Success confirmations use `role="status" aria-live="polite"`.
- Live emission preview wrapped in `aria-live="polite" aria-atomic="true"`.
- Simulator progress gauge uses `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- Dashboard trend chart has a `<table class="sr-only">` fallback with `<caption>` and row headers; color is never the only signal.
- `prefers-reduced-motion` disables non-essential CSS transitions.
- Always-visible `focus-visible` ring on all interactive elements.
- AA contrast ratio in dark theme verified by axe scans.

## Security

- All API keys live only on the API service. The frontend holds no credentials.
- ADC provides runtime GCP authentication; no credential files in the container or repository.
- Input sanitizer on all inbound text: Unicode NFC normalization, strip control, zero-width, and bidirectional-override characters ([api/app/middleware/sanitizer.py](api/app/middleware/sanitizer.py)).
- Secret-shaped-string redaction in the structlog pipeline before log emit ([api/app/core/logging.py](api/app/core/logging.py)).
- Same-origin CSRF enforcement on all POST routes; 403 on cross-origin requests ([api/app/middleware/csrf.py](api/app/middleware/csrf.py)).
- Per-IP sliding-window rate limiting on AI and write endpoints ([api/app/middleware/rate_limit.py](api/app/middleware/rate_limit.py)).
- 16 KiB body-size cap middleware ([api/app/middleware/body_size.py](api/app/middleware/body_size.py)).
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP, X-Request-ID ([api/app/middleware/security_headers.py](api/app/middleware/security_headers.py)).
- CI bundle scan: [web/scripts/scan-bundle.js](web/scripts/scan-bundle.js) asserts no secret or server-only value leaked into the client JS bundle.
- Non-root container user (`appuser`, uid 10001) in both Dockerfiles.
- Firestore security rules enforce per-user document access.
- [SECURITY.md](SECURITY.md) disclosure policy and `/.well-known/security.txt` contact file served at both services.

## Assumptions and limitations

- Emission factors are educational estimates intended for personal awareness. They are not certified for compliance, regulatory, or corporate reporting purposes.
- Transport factors are from UK DESNZ/DEFRA (2024). These are the most widely available per-mode published factors; India-specific equivalents are not published in a comparable per-mode format.
- The EV factor (0.047 kg CO2e/km) uses UK grid intensity per the DEFRA source. Indian grid intensity (0.727 kg CO2e/kWh, CEA Version 20.0) applies to the home electricity factor.
- The what-if simulator scales logged trips to annual projections. A short logging history produces a less reliable projection; a minimum 7-day effective span is assumed to prevent extreme multipliers.
- The live deployment runs in mock-user mode: Firebase anonymous auth is coded and tested but requires a real Firebase project. All demo data shares one user identity (`mock-local-user-id`).
- All services are in a single region (asia-south1). There is no multi-region failover.

## Carbon methodology

Factors are stored in a versioned dataset at [api/app/domain/factors.py](api/app/domain/factors.py). Each factor carries a `source` citation and `effective_year`. 22 factors are defined across three sources:

| Category | Factors | Source | Year |
|---|---|---|---|
| Transport (10 modes) | petrol car, diesel car, EV, hybrid, motorbike, bus, train, metro, bicycle, walking | UK DESNZ/DEFRA Greenhouse Gas Conversion Factors | 2024 |
| Home energy (2 sources) | electricity (Indian grid), LPG | CEA CO2 Baseline Database for the Indian Power Sector v20.0; UK DESNZ/DEFRA | 2024 |
| Food (10 items) | beef, chicken, pork, fish, milk, eggs, rice, wheat, vegetables, fruit | Poore and Nemecek (2018) via Our World in Data | 2018 |

All 22 factors are verified by the golden-case eval suite. Results: [api/eval/results.md](api/eval/results.md).

## Deployment

Both services are deployed on Google Cloud Run in asia-south1, project `handprint-498816`. The API runs under a dedicated service account (`handprint-api@handprint-498816.iam.gserviceaccount.com`) with `roles/aiplatform.user` and `roles/datastore.user`. No credential files are stored in containers or committed to the repository.

- **Web:** https://handprint-web-gomkhssdqa-el.a.run.app
- **API:** https://handprint-api-gomkhssdqa-el.a.run.app
- **API docs:** https://handprint-api-gomkhssdqa-el.a.run.app/docs

## Rubric mapping

| Evaluation axis | Where it is demonstrated |
|---|---|
| Problem statement alignment | [Brief mapping table](#brief-mapping); [api/app/domain/](api/app/domain/) for the estimator layer; [web/src/app/dashboard/page.tsx](web/src/app/dashboard/page.tsx), [web/src/app/simulate/page.tsx](web/src/app/simulate/page.tsx) |
| Code quality | EmissionEstimator Protocol in [api/app/domain/estimator.py](api/app/domain/estimator.py); command pattern in [api/app/domain/simulation.py](api/app/domain/simulation.py); constructor DI in [api/app/core/dependencies.py](api/app/core/dependencies.py); repository layer in [api/app/repositories/](api/app/repositories/) |
| Security | Middleware stack [api/app/middleware/](api/app/middleware/); sanitizer [api/app/core/sanitizer.py](api/app/core/sanitizer.py); bundle scan [web/scripts/scan-bundle.js](web/scripts/scan-bundle.js); [SECURITY.md](SECURITY.md) |
| Testing | Backend: [api/tests/](api/tests/) (127 functions, 25 files); eval: [api/eval/run_eval.py](api/eval/run_eval.py) (22 golden cases); E2E + a11y: [web/tests/e2e.spec.ts](web/tests/e2e.spec.ts) |
| Accessibility | ARIA roles and keyboard nav in [web/src/app/trips/new/page.tsx](web/src/app/trips/new/page.tsx), [web/src/app/simulate/page.tsx](web/src/app/simulate/page.tsx); axe-core scans in [web/tests/e2e.spec.ts](web/tests/e2e.spec.ts); details in [Accessibility section](#accessibility) |
| Google services | Cloud Run, Vertex AI (Gemini), Cloud Firestore: [Google services table](#google-services); active call sites at [api/app/clients/vertex.py](api/app/clients/vertex.py) and [api/app/repositories/](api/app/repositories/) |
| Efficiency | Scale-to-zero Cloud Run; structlog structured logging; sliding-window rate limiting; single list-by-user Firestore query per category (no N+1 reads) |
