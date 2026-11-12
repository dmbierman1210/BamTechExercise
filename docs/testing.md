# Testing

## Run the tests

```powershell
dotnet test                              # all tests; fails below 50% line coverage
dotnet test -p:CollectCoverage=false     # for a filtered run (--filter ...), which would otherwise trip the coverage floor
./tests/coverage.ps1                     # tests + HTML report in coverage/report/index.html + Business/ number
```

Coverage is collected on every `dotnet test` (coverlet, configured in `tests/StargateAPI.Tests/StargateAPI.Tests.csproj`)
and the run **fails if total line coverage drops below 50%**. Only generated code is excluded: `Business/Migrations/*`
and anything marked `[GeneratedCode]`. `Program.cs` is hand-written and counted. The report is written to `coverage/`
(git-ignored).

Measured when this was written: total line coverage 99.5% and `Business/` 99.3% (85% total if the migrations are
counted, because generated migration code is mostly not exercised line by line). The floor is deliberately lower than
the current number so that it catches a regression without blocking small, well-tested changes; the target for
`Business/` is 70% or more.

## How the tests are built

- **Real SQLite, real migrations.** `TestDatabase` applies the actual migrations to an in-memory (or file-backed)
  SQLite database, so constraints, collations and date storage behave as they do in the running API. No mocking of EF.
- **The real API in memory.** `ApiFactory` starts the whole pipeline (routing, validation, exception handling,
  response envelope) in Development, so route tests assert the contract that the UI relies on.
- **Fixed clock and actor.** `FixedTimeProvider` and `FixedActorProvider` make duty dates and audit entries deterministic.

## Most impactful code, and why it is tested the way it is

| Code | Why it matters | Where it is tested |
|---|---|---|
| `CreateAstronautDutyHandler.Handle` | Owns the business rules: one current duty, end-date chaining, `RETIRED` career end, backdating with re-chaining, return from retirement, required `reason`, an audit entry per create. A wrong branch corrupts a career timeline. | `Commands/CreateAstronautDutyHandlerTests` (every rule and its failure), `Commands/ConcurrencyTests` |
| `CreatePersonHandler` / `RenamePersonHandler` | Name uniqueness (case-insensitive, beyond what SQLite folds), trimming, audit entries, and the 409 on a race. | `Commands/PersonCommandTests`, `Commands/ConcurrencyTests` |
| `WriteGate` | Serialises writers because SQLite has one writer; without it two requests fail with "database is locked" and the name checks race. | `Commands/ConcurrencyTests` (file-backed database, real contention) |
| `GlobalExceptionHandler`, `ErrorResponses`, `ApiErrorBehavior` | The only place an exception becomes a response: the right status, the one envelope, and never a stack trace or internal detail to the caller. | `Api/ApiRouteTests` (every route), `Api/ErrorResponsesTests`, `Api/ContractTests` |
| `Api/ContractTests` against `docs/api/openapi.yaml` | The contract is what the UI is built against; this fails if Swagger's routes and status codes drift from it. | `Api/ContractTests` |
| Query handlers (`GetPeople`, `GetPersonByName`, `GetAstronautDutiesByName`) | Status derivation (non-astronaut, active, retired), ordering, and 404 for an unknown person. | `Queries/QueryHandlerTests` |
| `DevelopmentDataSeeder`, migrations | A fresh database must come up with the schema, constraints and sample data the app expects. | `Data/DatabaseTests`, `Data/DevelopmentDataSeederTests` |

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`, with read-only permissions:

- **API build, test, coverage** (`api` job): restore, build in Release with warnings as errors, `dotnet test` (which fails below
  the 50% line-coverage floor), then the HTML coverage report is uploaded as the `coverage-report` artifact.
- **UI lint, test, build** (`ui` job): runs only when `ui/package.json` exists: `npm ci`, `npm run lint`, `npm test`,
  `npm run build`.

Repository owner, to make the checks count: Settings -> Branches -> branch protection rule for `main` -> "Require status
checks to pass before merging" and select **`API build, test, coverage`** and **`UI lint, test, build`**. (Agents do not
change repository settings.)
