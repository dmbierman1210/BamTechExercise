# Design notes and interview talking points

What was wrong with the exercise as received, what was decided and why, what was left out on purpose, and how to
talk about it. Process and tracking live in [`TRACKING.md`](../TRACKING.md) (decisions **D1 to D14** are quoted
below), the system walkthrough is [`app.md`](app.md), the test strategy is [`testing.md`](testing.md), and the API
contract is [`api/openapi.yaml`](api/openapi.yaml).

PR numbers refer to <https://github.com/dmbierman1210/BamTechExercise/pulls>. Each story was one PR; the lane
releases (#38 API, #29 and #30 UI, #43 hardening) carried them into `main`.

## 1. Flaws found in the code as received, and where each ended up

The list is the baseline analysis in `TRACKING.md` ("Baseline findings", 2026-11-11), in the same order.

| # | Flaw in the received code | Status | Fixed by |
|---|---|---|---|
| 1 | SQL injection: the user-supplied `Name` was concatenated into SQL in three handlers | Fixed | STAR-4 (#32): every query goes through EF Core, parameterised by construction |
| 2 | Duties-by-name sent the wrong query, so duties were never returned; unknown names caused a null dereference | Fixed | STAR-5 (#33) |
| 3 | An unknown person returned 200 with a null body | Fixed (404 with the standard envelope) | STAR-5 (#33) |
| 4 | Inconsistent error handling: `try/catch` in one action, none in the other, `BadHttpRequestException("Bad Request")` leaking, 500s with no reason | Fixed | STAR-9 (#37): one global exception handler, one envelope; a test fails if a controller has `try`/`catch` |
| 5 | Duplicate-duty check matched title and start date across all people; no check that a new start date was after the current one | Fixed | STAR-7 (#35) |
| 6 | `RETIRED` handling: first-ever retirement set the career end to the start date (rule says the day before), the title was a case-sensitive magic string, and a duty after retirement was undefined | Fixed | STAR-7 (#35) for the rules and `DutyTitles`; STAR-8 (#36) for return from retirement (D4) |
| 7 | No person update, a bare JSON string as the `POST /Person` body, no trim, empty or length validation | Fixed | STAR-6 (#34): `POST /Person` takes `{ "name": "..." }`, `PUT /Person/{name}` renames, names are trimmed, 1 to 200 characters (D3, D11) |
| 8 | Database never created: no `Migrate()`, seed commented out, no unique index on `Person.Name` (uniqueness was a racy pre-check) | Fixed | STAR-3 (#31): migrate on startup, development seed data, unique index; the check also runs under a write gate (`WriteGate`) |
| 9 | Model and migration drift (`CareerStartDate` nullability, EF 7 snapshot in an EF 8 project, migration namespace) | Fixed | STAR-3 (#31) |
| 10 | Dapper reads mixed with EF writes on the same connection, with manual `Update()` of detached entities | Fixed | STAR-4 (#32): Dapper removed (D5) |
| 11a | No logging | Fixed | STAR-15 (#40): process log in the `LogEntry` table (see the README, "Reading the logs") |
| 11b | No tests | Fixed | Test project from STAR-3 (#31), grown with every story; coverage floor of 50 percent from STAR-16 (#41) |
| 11c | No CORS (needed for the Angular app) | Fixed | STAR-18 (#46): one origin, Development only |
| 11d | Swagger only in Development | **Deferred on purpose** | Exposing API documentation outside Development is a deployment decision; there is no deployment in this exercise |
| 12 | Repo hygiene: `extracted/` untracked, stale `net7.0` `bin/` and `obj/`, no `.gitignore`, no solution file | Fixed | STAR-1 (committed directly to `main`) |

Also fixed along the way: the six nullable warnings in the build. The documented build command
(`dotnet build StargateAPI.sln -warnaserror`) treats warnings as errors and passes with none.

## 2. Design decisions

| Decision | Why |
|---|---|
| **EF Core only** (D5) | One data-access style, parameterised by construction; removes the injection and the shared-connection hazard. |
| **Contract first** (`openapi.yaml`, STAR-2) | The UI and API were built in parallel against one file; `ContractTests` fail when Swagger's routes or status codes drift from it. |
| **Response envelope kept** (D11) | The received `{ success, message, responseCode }` shape stays (plus `errors[]` for field errors); the HTTP status always equals `responseCode`. The UI handles every outcome one way. |
| **Add and update a person are two operations** (D3) | Add: `POST /Person`, 409 if the name exists. Update means rename: `PUT /Person/{name}` with `newName`, 404 if missing, 409 if taken. |
| **Names are unique ignoring case, and trimmed** (D11) | SQLite's `NOCASE` only folds ASCII, so the application checks too. |
| **Case-only rename is applied and audited; an identical name is a no-op** (D14.3) | `john doe` to `John Doe` is a legitimate correction. |
| **A duty can be backdated, and a person can return from retirement** (D4) | Both require a non-empty `reason`, stored on the duty. Backdating re-chains the end dates of the neighbouring duties so the timeline stays consistent (one current duty, no overlaps). |
| **Future start dates are allowed, but need a reason** (D12) | Dates are judged in UTC. |
| **There is always an audit trail** (D8) | `AuditEntry` is append-only (the database refuses updates and deletes through triggers): who, what, why, before and after as JSON. Nothing is hard-deleted. |
| **Self-declared actor in an `X-Actor` header** (D10) | A header rather than a body field, so real authentication can replace it later without changing routes or bodies. It is stored on audit entries and log entries. It is not verified. |
| **One transaction per write, and a write gate** | A failed call changes nothing. SQLite has one writer, so `WriteGate` serialises writers; without it two requests fail with "database is locked" and the name checks race. |
| **Process logging in the database, off the request path** (STAR-15) | Logs go to a queue and a background writer, so a slow or failing log write never fails a request. Request outcomes record the operation name and duration, never the payload. |
| **500 responses carry a `traceId`** (D14.2, #45) | The body stays generic and never contains internals; the id finds the exception and stack trace in the log. It is documented in the contract. |
| **UI API address is fixed at build time, localhost only** (D14.1) | No runtime config and no proxy; the CORS policy allows exactly one origin, `http://localhost:4200`, for `GET`, `POST`, `PUT` and the headers `Content-Type` and `X-Actor`, in Development only. |
| **The page heading does not take focus on a fresh load or a direct link** (D14.4) | The skip link must be the first Tab stop. Focus moves to the heading only after in-app navigation. |
| **The UI is the MVP priority, and runs on a mock until the API exists** (D6) | The mock stays as an opt-in (`npm run start:with-mock`); the default build talks to the real API. |
| **No CI evidence, everything runs locally** (D13) | The monthly GitHub Actions minutes are used up, so every check is run on the developer's machine and the results are posted on the story. See the README. |
| **Repository and process** (D1, D2, D7) | Private repository, personal account only; flattened layout `api/`, `tests/`, `ui/`, `docs/`; the exercise text is kept as [`EXERCISE.md`](EXERCISE.md). |

## 3. What was deliberately left out

- **Correct or void a duty** (STAR-20, stretch). Duties cannot be edited or removed after the fact. A backdated duty with a
  reason can fill in or correct the history before the latest duty, but a wrong latest entry (for example a wrong rank
  or title) cannot be corrected until STAR-20: a second duty on the same start date is refused with 409. The intended
  design (a soft void, never a hard delete, with an audit trail) is recorded as D8 and in issue #21.
- **Real login** (STAR-21, stretch). The actor is a self-declared name, labelled "not verified" in the UI. Accounts,
  sessions and roles need owner decisions first.
- **Swagger outside Development, HTTPS and hosting.** There is no deployment, so no production configuration,
  certificates or runtime UI configuration.
- **Paging on `GET /Person`.** The list returns everyone; the UI filters and sorts in the browser. Fine for a
  small roster, to be revisited before a large one.
- **A second database engine.** SQLite is enough for the exercise; the write gate is the price of one writer.
- **Browser end-to-end coverage beyond a smoke test.** One Playwright test covers add person, add duty and the
  timeline against the real API; the rest of the UI is covered by unit tests and manual run-and-look.
- **Small UI clean-ups** recorded on issue #19 (dead helpers, a status constant defined in two places, three
  field-error patterns).

## 4. Talking points for the interview

- **What was wrong with the code you were given?** Section 1, security first (SQL injection), then correctness
  (wrong query, null dereferences, rules that did not match the exercise), then robustness (no database, no tests, no
  error handling, no logs).
- **Why MediatR?** One class per use case, thin controllers, and a pipeline to hang cross-cutting behaviour on
  (today the logging behaviour that records every command and query).
- **Walk me through adding a duty.** The controller sends `CreateAstronautDuty`. The handler first validates the request
  (trim, lengths, dates, reason, actor) and answers 400 with field errors, then takes the write gate, finds the person
  (404 if unknown) and, inside one transaction, loads the person's whole timeline and applies the rules (one current
  duty, end-date chaining, `RETIRED` sets the career end, a backdated duty or a return from retirement needs a
  reason), re-chains the timeline and writes an audit entry. See [`app.md`](app.md) for the diagrams.
- **How do you know it works?** 166 API tests on real SQLite with the real migrations and the real pipeline
  in memory, a contract test against the OpenAPI file, 232 UI tests, an axe accessibility suite and a Playwright
  smoke test. Coverage is in the README. Everything was run locally; GitHub Actions has never run on this repository.
- **How did you handle ambiguity in the requirements?** Each unclear rule became a recorded owner decision (D3 to
  D14) rather than a guess, for example "add/update a person" and what happens after `RETIRED`.
- **What would you do differently with more time?** Correct or void a duty (STAR-20), real login (STAR-21), paging,
  a hosted environment with a proven pipeline, and a broader end-to-end suite.
- **What is the riskiest part?** The duty timeline: concurrent writes and backdating. That is why it has the most
  tests, a write gate, one transaction per write, and a database-level unique index on a person's duty start dates behind
  the application checks.
