# Stargate ACTS: Astronaut Career Tracking System

A web API and an Angular app that track people and their astronaut duties (rank, duty title, start date) over time. A
person has at most one current duty; adding a duty ends the previous one the day before; a duty titled `RETIRED` marks
the person retired. The exercise this came from is in [`docs/EXERCISE.md`](docs/EXERCISE.md).

- **API** (`api/`): ASP.NET Core 8 Web API, MediatR, EF Core on SQLite. Contract: [`docs/api/openapi.yaml`](docs/api/openapi.yaml).
- **UI** (`ui/`): Angular 21 with Angular Material. Details in [`ui/README.md`](ui/README.md).
- **Tests** (`tests/`): xUnit on real SQLite with the real migrations; coverage gate at 50 percent line coverage.

## Repository layout

| Path | What is there |
|---|---|
| `api/` | The Web API: `Controllers/`, `Business/` (commands, queries, data, auditing, logging, validation, migrations) |
| `tests/StargateAPI.Tests/` | API tests; `tests/coverage.ps1` runs them with a coverage report |
| `ui/` | Angular app, its mock API (`ui/mock-server/`), unit tests and the Playwright smoke test (`ui/e2e/`) |
| `docs/` | [`DESIGN.md`](docs/DESIGN.md) (flaws fixed, decisions, interview talking points), [`app.md`](docs/app.md) (how the application works), [`testing.md`](docs/testing.md), [`process.md`](docs/process.md) (how the project was run), the contract in `docs/api/` |
| `scripts/start.ps1` | Starts the API and the UI together |
| `TRACKING.md` | The program tracker: stories, owner decisions D1 to D14, the original defect list |
| `StargateAPI.sln` | Solution (API and tests) |

## Prerequisites

- .NET SDK 8 (`global.json` pins 8.0 and rolls forward to a newer feature band).
- Node.js 22.12 or newer and npm 10 (for the UI).
- Git. PowerShell is only needed for `scripts/start.ps1` and `tests/coverage.ps1`; everything else is plain `dotnet` and `npm`.

## Run it

```powershell
git clone https://github.com/dmbierman1210/BamTechExercise.git
cd BamTechExercise
./scripts/start.ps1        # installs the UI packages on first use, then starts the API and the UI; Ctrl+C stops both
```

Or in two terminals from the repository root:

```powershell
dotnet run --project api --launch-profile http     # API (the first start creates and seeds api/starbase.db)
cd ui; npm ci; npm start                           # UI
```

| What | Address |
|---|---|
| UI | <http://localhost:4200> |
| API | <http://localhost:5204> (the `https` launch profile also listens on <https://localhost:7204>) |
| Swagger UI | <http://localhost:5204/swagger> (Development only) |
| Mock API (opt-in) | <http://localhost:3000>; `cd ui; npm run start:with-mock` runs the UI against it instead of the API |

The UI address of the API is fixed at build time (`ui/src/environments/`), localhost only. The API allows browser calls
from exactly one origin, `http://localhost:4200`, and only in Development.

**Seed data.** In Development the API creates and fills the database on startup with six people: Ellen Voss and Marcus
Hale (no duties), Nadia Okafor (one duty), Jack Rourke (three duties, active), Samuel Whitaker (retired) and Priya
Raman (retired, then returned to flight status). To start again from scratch, stop the API and delete `api/starbase.db`
(and `api/starbase.db-shm` / `-wal` if present).

**Acting as.** Every write must say who made it. In the UI, choose **Set your name** in the toolbar first. Over HTTP,
send an `X-Actor` header (1 to 100 characters). It is a self-declared name, stored on audit and log entries, not a login.

## The API in short

| Route | Does |
|---|---|
| `GET /Person` | All people with their current rank, duty title and astronaut status (`None`, `Active`, `Retired`) |
| `GET /Person/{name}` | One person by name (ignoring case and surrounding spaces); 404 if unknown |
| `POST /Person` | Add a person: `{ "name": "..." }`; 409 if the name exists |
| `PUT /Person/{name}` | Rename: `{ "newName": "..." }`; 404 if unknown, 409 if the new name is taken |
| `GET /AstronautDuty/{name}` | The person and their duties; 404 if unknown |
| `POST /AstronautDuty` | Add a duty: `{ "name", "rank", "dutyTitle", "dutyStartDate", "reason" }`. `reason` is required for a backdated duty, a future-dated duty and a duty after `RETIRED` |

Every response is the envelope `{ "success", "message", "responseCode" }` (plus `errors[]` for field errors), and the
HTTP status equals `responseCode`. A 500 also carries a `traceId` that finds the exception in the log. Full detail:
[`docs/api/openapi.yaml`](docs/api/openapi.yaml). An example with the API running (PowerShell):

```powershell
curl.exe -s -X POST http://localhost:5204/Person -H "Content-Type: application/json" -H "X-Actor: me" -d '{\"name\": \"Ada Stone\"}'
curl.exe -s -X POST http://localhost:5204/AstronautDuty -H "Content-Type: application/json" -H "X-Actor: me" -d '{\"name\": \"Ada Stone\", \"rank\": \"CPT\", \"dutyTitle\": \"Pilot\", \"dutyStartDate\": \"2020-01-01\"}'
curl.exe -s http://localhost:5204/AstronautDuty/Ada%20Stone
```

On macOS or Linux use `curl` and plain single-quoted JSON without the backslashes.

## Run the tests

Everything is run locally; see "No CI" below.

```powershell
dotnet build StargateAPI.sln -warnaserror      # API and tests, warnings are errors
dotnet test                                    # 166 tests; fails below 50% line coverage
./tests/coverage.ps1                           # the same plus an HTML report in coverage/report/index.html

cd ui
npm ci
npm run lint
npm run format:check
npm test                                       # 232 UI unit tests (Vitest, jsdom) and the mock-server tests
npm run build                                  # production build with bundle budgets
npm run e2e                                    # Playwright smoke test against the real API (see ui/README.md)
```

**Coverage** (`./tests/coverage.ps1` on this commit, 166 tests): total line coverage **98.99 percent**, `Business/`
**98.7 percent**. The floor that fails the build is 50 percent; only generated code (migrations) is excluded. Why each
area is tested the way it is: [`docs/testing.md`](docs/testing.md).

## Reading the logs

The API writes a process log to the `LogEntry` table of `api/starbase.db`: every command and query with its outcome and
duration, every unhandled exception with its stack trace, and application logs at Information and above. Writes go
through a queue and a background writer, so an entry can appear a moment after the request. Payloads are never logged.

Open the database with the `sqlite3` command line or any SQLite browser, for example:

```sql
-- the latest 20 entries
SELECT Id, TimestampUtc, Level, Operation, StatusCode, DurationMs, Actor, Message
FROM LogEntry ORDER BY Id DESC LIMIT 20;

-- failures, with the exception text
SELECT TimestampUtc, Operation, Message, Exception FROM LogEntry WHERE Level IN ('Error', 'Critical') ORDER BY Id DESC;

-- find the failure behind a 500: use the traceId from the response body (and the UI's "(reference ...)" message)
SELECT * FROM LogEntry WHERE TraceId = '<traceId>';
```

Columns: `Id`, `TimestampUtc`, `Level` (`Information`, `Warning`, `Error`...), `Category`, `Operation` (the command or query
name), `Message`, `Exception`, `TraceId`, `StatusCode`, `DurationMs`, `Actor`. Expected outcomes (400, 404, 409) are
logged at `Warning`, unexpected failures at `Error`.

Changes to data are in the append-only `AuditEntry` table (who, what, why, before and after as JSON): the database
refuses updates and deletes on it. `SELECT * FROM AuditEntry ORDER BY Id DESC;`

## No CI: GitHub Actions has never run on this repository

The monthly GitHub Actions minutes for the account are used up (owner decision D13), so **no check on this repository has
ever run in GitHub Actions**. Every build, test and check above is run on a developer machine, and the results are
posted on each story and in each pull request. The workflow `.github/workflows/ci.yml` is written (API build, test and
coverage; UI lint, test and build) but it is unproven, and the failing or missing check marks you may see on pull
requests are expected. Treat a claim of "passes in CI" here as unsupported; treat the local commands above as the
evidence.

## Troubleshooting

- **The UI says "API unreachable".** The API is not running on port 5204, it is not in Development
  (`ASPNETCORE_ENVIRONMENT=Development`), or the browser blocked the call (CORS: the app must be served from
  `http://localhost:4200`). The browser console names the blocked origin. If you need another UI port, start the API
  with `Cors__AllowedOrigin=http://localhost:<port>`.
- **Port already in use.** Stop whatever uses 5204 or 4200; `npm run e2e` needs 5204 free.
- **A write is refused with a message about `X-Actor`.** Set your name (UI toolbar) or send the header.
- **Start from a clean database.** Delete `api/starbase.db` as described under "Run it".

## Where to read next

[`docs/DESIGN.md`](docs/DESIGN.md) (what was wrong, what was decided, what was left out, talking points) ·
[`docs/app.md`](docs/app.md) (how the application works) · [`docs/testing.md`](docs/testing.md) ·
[`docs/process.md`](docs/process.md) · [`ui/README.md`](ui/README.md) · [`TRACKING.md`](TRACKING.md).
