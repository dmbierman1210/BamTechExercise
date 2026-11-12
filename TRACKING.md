# Stargate / ACTS - Program Tracker

Lean index only. Story detail lives in the issue tracker (GitHub Issues on the repo below); do not add per-story notes here.
Last updated: 2026-11-12.

## Program configuration

| Variable | Value |
|---|---|
| Repo (all source control) | https://github.com/dmbierman1210/BamTechExercise (private, empty, default branch `main`, Issues enabled) |
| Remotes (local clone) | `origin` = the repo above; `upstream` = the original exercise repo (read-only reference, never push) |
| GitHub identity | Personal account `dmbierman1210` only. Commits use the repo-local noreply identity. Never use any other account or token for this repo. |
| Ticket system | GitHub Issues on the repo above |
| Parent Feature | [#1](https://github.com/dmbierman1210/BamTechExercise/issues/1) "Stargate ACTS exercise (program)". STAR-n is issue #(n+1). |
| ID prefix | `STAR` (titles: `STAR-<n> [TAG] imperative title`) |
| Tracker doc / branch | `TRACKING.md` / `main` (committed directly, no PR) |
| Agent ID | `copilot-<NNNNNN>` (random 6 digits, generated once per story, reused on resume) |
| WIP limit | One story In Progress per lane (see Lanes); never two in the same lane |
| Branch strategy | One branch + one git worktree + one PR per story; marathon lanes stack PRs on a release branch |
| Chat mode | off |
| Stack | .NET 8, ASP.NET Core Web API, MediatR 12.2, EF Core 8 (SQLite), Swashbuckle. UI: Angular. Dapper is being removed (STAR-4) |
| Local API URLs | http://localhost:5204, https://localhost:7204, `/swagger` (Development) |
| Target layout (STAR-1) | `api/`, `tests/`, `ui/`, `docs/` (incl. `docs/api/openapi.yaml`, `docs/EXERCISE.md`), `StargateAPI.sln`, `README.md`, `TRACKING.md` |

## Agent protocol (read this before touching anything)

1. **Identity.** Generate `copilot-<NNNNNN>` before anything else; use it in every claim, tracker row and comment.
2. **Claim immediately, before any research.** Pick the next story in your lane whose dependencies are Done (check the issue state, not only this file). Then: issue -> In Progress, comment `CLAIMED by <id> <date>`, fill Claimed-by below, cut your branch and worktree. Only then read code/dependencies. Wrong story? Set it back to Not Started, clear Claimed-by, comment why, tell the human.
3. **Own row only.** Never change another agent's row or notes. Append a new attributed comment on their issue if something looks wrong.
4. **Branch/worktree per story**, cut fresh from the integration branch (`main`, or your lane's release branch): `git worktree add ../technical-exercise.worktrees/<story> -b <story-branch> <base>`. Needs git 2.17+. One branch can be checked out in one worktree only, so read this file with `git show origin/main:TRACKING.md`. Each worktree needs its own restore/build output and its own local server port (API lane 5204/7204, UI lane 4200, mock API 3000). Remove with `git worktree remove` then `git worktree prune`, never by deleting the folder. Keep worktrees on a short local path outside the repo folder. Exception: STAR-1 (bootstrap) works directly on local `main` because `origin/main` does not exist yet.
5. **Questions.** Try your own sources (code, issue, ADRs, `docs/api/openapi.yaml`, public docs) first, then the PM, then the human. Architecture, security, scope/acceptance and licensing questions go straight to the human; marathon agents park the story instead of guessing.
6. **Review.** Open the PR, then have a fresh context-free review agent post findings as a PR comment. Fix valid findings; send "valid but later" findings to the PM as follow-up stories.
7. **Run-and-look.** If a story touches UI or any API behavior that can run locally, launch it and exercise the change before opening the PR; record route, steps and result in the PR and issue. If it cannot run, say why. Server-only/docs changes with no client-observable effect: write "N/A: no client impact".
8. **No-merge rule.** No agent merges a PR, enables auto-merge, or completes it through an API, ever. Open the PR, post your local test results (rule 13), hand the user the link. A person merges. Allowed direct pushes: your own branch, and the PM committing this file.
9. **Close-out (all boxes, same session):** [ ] worktree removed + pruned, branch deleted locally and on remote (verify) - [ ] detailed notes on the issue - [ ] one-line exec summary comment on the parent Feature - [ ] issue -> Done - [ ] row below -> Done. "PR merged" is not "story done". (Marathon agents stop at "waiting for review"; the person closes after merging.)
10. **Tracker edits:** `git pull --ff-only` -> edit -> commit/push straight to `main` -> verify local HEAD equals origin. The PM does not push this file while a human has said another agent is editing it; show the diff and ask.
11. **Scope.** Use only this repo and public documentation. If something seems to need an external or private system, stop and ask the human.
12. **Lane ownership.** Edit only the paths your lane owns (see Lanes). `docs/api/openapi.yaml` is the contract between lanes: change it only through a contract story, never inside a lane story.
13. **No CI evidence; run everything locally (owner, 2026-11-12).** GitHub Actions minutes are exhausted, so no agent may depend on, wait for or cite a GitHub CI result. Before opening the PR, run every build, test and check the story needs on your own machine and post the exact commands and results (pass/fail counts, coverage numbers, what was not run) as a **comment on the story's issue** and in the PR description. API: `dotnet build StargateAPI.sln -warnaserror`, `dotnet test`. UI (`ui/`): `npm ci`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`. Never write "green" or "verified" for something you did not run. A workflow file (STAR-17) may be written but is not evidence.

## Decisions recorded (human-confirmed 2026-11-11 unless noted)

| # | Decision |
|---|---|
| D1 | Repo is private; use personal account only. Local `origin` retargeted to it. |
| D2 | Layout: flatten the exercise into `api/`, `tests/`, `ui/`, `docs/` (PM/worker call, delegated by the human). The original README text is kept as `docs/EXERCISE.md`. |
| D3 | "Add/update a person by name" = two operations: **add** (create; 409 if the name exists) and **update** (rename: `PUT /Person/{name}` with `newName`; 404 if missing, 409 if `newName` taken). |
| D4 | A person **may** receive a new duty after `RETIRED` (return from retirement), and a duty **may** be backdated before the current duty's start (correction). Both require a non-empty `reason`, stored on the duty. Backdating re-chains the end dates of neighbouring duties. |
| D5 | Consolidate on EF Core only; Dapper is removed (STAR-4). |
| D6 | UI is the MVP priority; API work proceeds in parallel against a committed contract. |
| D7 | API and UI marathons may run at the same time under distinct project labels (disjoint paths, contract-only coupling). |
| D8 | STAR-20 (correct/void a duty) is kept as an optional stretch goal. Removal is a soft void; **there is always an audit trail** (nothing is hard-deleted, every change keeps what it replaced). The append-only `AuditEntry` table (Person and Duty entries) is introduced in STAR-6 (person create/rename), extended in STAR-8 (every duty create) and reused by STAR-20. Every write carries a self-declared `X-Actor` header read through an `IActorProvider`, stored on audit entries and log entries; verified identity is the stretch story STAR-21 (login, after STAR-20). |
| D10 | Actor: required `X-Actor` header on all write routes (approved by the owner 2026-11-11). A header, not a body field, so authentication can replace it later without changing routes or bodies. |
| D9 | The PM created the parent issue and STAR-1..20 on 2026-11-11 with acceptance criteria. The `gh` active account was switched to `dmbierman1210`. |
| D11 | Contract decisions (owner, 2026-11-11), recorded in STAR-2 (#3): `POST /Person` body is an object `{ "name": "..." }`; the existing response envelope `{ success, message, responseCode }` (+ `errors[]`) is kept, HTTP status equals `responseCode`; names are trimmed, 1-200 chars, unique case-insensitively (the app checks, SQLite NOCASE only folds ASCII). |
| D12 | Future start dates are **allowed but need a reason** (owner, 2026-11-11; supersedes an earlier "reject" answer). `dutyStartDate` later than today (UTC) without a non-blank `reason` -> 400 with a field error on `reason`. STAR-7 (#8) accepts future dates like any later date; the `Reason` column and the required-reason rule land in STAR-8 (#9). Contract in STAR-2 (#3). |
| D13 | GitHub Actions cannot be relied on (monthly minutes used up). All tests and checks run locally and their results go on the story as a comment (protocol rule 13). STAR-17 still writes the workflow, but it is validated locally and not run. Owner, 2026-11-12. |
| D14 | Owner decisions, 2026-11-12, all taking the PM recommendation: (1) the UI gets the API address from build-time environment config, localhost only; (2) the 500 `traceId` is documented in the contract via its own contract-change PR; (3) a case-only rename is applied and audited, an identical name is a no-op; (4) the person page does not take focus on a fresh load or direct link, only after in-app navigation. Recorded in STAR-18 (#19). |

## Status table

Status: Proposed (issue exists with acceptance criteria, not yet startable) | Not Started | In Progress | Done | Done. On GitHub, In Progress and Done are the labels `status:in-progress` and `status:in-review`; Done = issue closed by a person after merge. The `marathon-ready` label is added by the PM only when the story's dependencies are Done or inside the same run and no question is open. The UI lane (STAR-10..14) was labelled and run, and is Done. STAR-15..17 wait for the API lane to be merged, STAR-20 needs a design answer, STAR-21 needs owner decisions.

| | ID | Issue | Title | Lane | Pri | Pts (est) | Status | Claimed-by | Depends on |
|---|---|---|---|---|---|---|---|---|---|
| - | STAR-1 | [#2](https://github.com/dmbierman1210/BamTechExercise/issues/2) | [REPO] Flatten to target layout, `.gitignore`, solution file, drop stale bin/obj, first push to `main` | W0 | P1 | 2 | Done | copilot-827573 | - |
| - | STAR-2 | [#3](https://github.com/dmbierman1210/BamTechExercise/issues/3) | [CONTRACT] API contract v1: `docs/api/openapi.yaml` + example payloads for people, duties, errors (reason field, 404/409 shapes) | W0 | P1 | 3 | Done | copilot-212699 | STAR-1 |
| - | STAR-3 | [#4](https://github.com/dmbierman1210/BamTechExercise/issues/4) | [DB] Generate the database: reconcile model/migration drift, migrate on startup, seed sample data, unique index on `Person.Name`; scaffold `tests/` project | API | P1 | 3 | Done | copilot-831218 | STAR-2 |
| - | STAR-4 | [#5](https://github.com/dmbierman1210/BamTechExercise/issues/5) | [SEC] Consolidate on EF, remove Dapper and all string-built SQL (fixes SQL injection) | API | P1 | 3 | Done | copilot-831218 | STAR-3, D5 |
| - | STAR-5 | [#6](https://github.com/dmbierman1210/BamTechExercise/issues/6) | [API] Fix duties-by-name (wrong query, null-person crash, 404) | API | P1 | 2 | Done | copilot-831218 | STAR-4 |
| - | STAR-6 | [#7](https://github.com/dmbierman1210/BamTechExercise/issues/7) | [API] Person add + rename endpoints with validation, correct status codes, and audit entries (introduces `AuditEntry` and `IActorProvider`) | API | P1 | 4 | Done | copilot-831218 | STAR-4 |
| - | STAR-7 | [#8](https://github.com/dmbierman1210/BamTechExercise/issues/8) | [RULES] Duty rules core: one current duty, end-date chaining, RETIRED, career start/end dates | API | P1 | 5 | Done | copilot-831218 | STAR-4 |
| - | STAR-8 | [#9](https://github.com/dmbierman1210/BamTechExercise/issues/9) | [RULES] Corrections: backdated duty, return from retirement, required `reason`, timeline re-chaining, append-only audit entry per duty create | API | P1 | 5 | Done | copilot-831218 | STAR-7 |
| - | STAR-9 | [#10](https://github.com/dmbierman1210/BamTechExercise/issues/10) | [API] Global error handling and one response contract (replace per-action try/catch, bare `BadHttpRequestException`) | API | P2 | 3 | Done | copilot-831218 | STAR-6, STAR-8 |
| - | STAR-10 | [#11](https://github.com/dmbierman1210/BamTechExercise/issues/11) | [UI] Scaffold Angular app, app shell, theme, API client generated from the contract, mock API | UI | P1 | 5 | Done | copilot-485825 | STAR-2 |
| - | STAR-11 | [#12](https://github.com/dmbierman1210/BamTechExercise/issues/12) | [UI] People list: search, status badges (non-astronaut / active / retired) | UI | P1 | 5 | Done | copilot-485825 | STAR-10 |
| - | STAR-12 | [#13](https://github.com/dmbierman1210/BamTechExercise/issues/13) | [UI] Person detail with astronaut duty timeline | UI | P1 | 5 | Done | copilot-485825 | STAR-11 |
| - | STAR-13 | [#14](https://github.com/dmbierman1210/BamTechExercise/issues/14) | [UI] Add duty form (reason required when backdating, future-dated or after retirement); add and rename person | UI | P1 | 5 | In Review | copilot-485825 | STAR-12 |
| - | STAR-14 | [#15](https://github.com/dmbierman1210/BamTechExercise/issues/15) | [UI] Production polish: loading/empty/error states, accessibility, responsive layout, UI unit tests | UI | P2 | 5 | In Review | copilot-485825 | STAR-13 |
| - | STAR-15 | [#16](https://github.com/dmbierman1210/BamTechExercise/issues/16) | [LOG] Process logging of successes and exceptions stored in the database | HARD | P2 | 5 | In Review (PR #40) | copilot-790541 | STAR-9 merged |
| - | STAR-16 | [#17](https://github.com/dmbierman1210/BamTechExercise/issues/17) | [TEST] Coverage report and >50% gate on the most impactful handlers | HARD | P2 | 3 | In Review (PR #41) | copilot-790541 | STAR-9 merged |
| - | STAR-17 | [#18](https://github.com/dmbierman1210/BamTechExercise/issues/18) | [CI] GitHub Actions: build, test, coverage on every PR | HARD | P3 | 2 | In Review (PR #42; CI not yet run, billing) | copilot-790541 | STAR-16 |
| - | STAR-18 | [#19](https://github.com/dmbierman1210/BamTechExercise/issues/19) | [INTEG] Wire UI to the live API: CORS, remove mock, end-to-end run-and-look | W3 | P1 | 5 | In Progress | copilot-647872 | STAR-9, STAR-14 merged |
| - | STAR-19 | [#20](https://github.com/dmbierman1210/BamTechExercise/issues/20) | [DOC] README: run/test steps, design decisions, interview talking points | W3 | P3 | 1 | Proposed | - | STAR-18 |
| - | STAR-20 | [#21](https://github.com/dmbierman1210/BamTechExercise/issues/21) | [RULES] Correct or void a duty entry with a reason and audit trail (stretch goal) | - | P3 | 5 | Proposed | - | STAR-8 |
| - | STAR-21 | [#22](https://github.com/dmbierman1210/BamTechExercise/issues/22) | [AUTH] Login: replace the self-declared actor with an authenticated identity (stretch goal; needs owner decisions on accounts, sessions, roles) | - | P3 | 8 | Proposed | - | STAR-20 |

Every API story includes its own unit tests and keeps the build warning-free.

## Lanes and marathons

A marathon is one unattended agent working a lane's stories in order inside confirmed limits (the human starts it; the PM never does). Lanes are written so they never touch the same files.

| Lane | Stories | Owns (paths) | Runs | Marathon project label |
|---|---|---|---|---|
| W0 | STAR-1, STAR-2 | repo root, `docs/` | Normal single session, first. Human reviews the contract. | - |
| API | STAR-3 to STAR-9 | `api/**`, `tests/**` | Marathon 1, parallel with UI | `BamTechExercise-api` |
| UI | STAR-10 to STAR-14 | `ui/**` only | Marathon 2, parallel with API (builds on the mock). Run 2026-11-11 (copilot-485825, limits 5 stories / 7.5 h): all five built, PRs #24-#30 merged by the owner 2026-11-12. | `BamTechExercise-ui` |
| HARD | STAR-15 to STAR-17 | `api/**`, `tests/**`, `.github/**` | Marathon 3, only after Marathon 1's PRs are merged | `BamTechExercise-harden` |
| W3 | STAR-18, STAR-19 | `ui/**`, `api/**` (CORS), `README.md` | Marathon 4 (owner decision 2026-11-12): STAR-18 then STAR-19, after the API, UI and HARD lanes are merged. STAR-20 and STAR-21 are not part of it | `BamTechExercise-w3` |

Running the API and UI marathons together is approved (D7): the ledger allows one live run per project label, and the two labels above are distinct only because the lanes share no files. Release branches: `release/marathon-api`, `release/marathon-ui`, `release/marathon-harden`; each ends in a draft PR to `main` that a person merges. Suggested limits per marathon (human confirms at start): API 6 stories / 6 hours; UI 5 stories / 6 hours; HARD 3 stories / 4 hours.

**Stacked PRs: merge order matters (lesson from the UI run).** Marathon story PRs are stacked: each targets the previous story branch, and only the bottom one targets the release branch. Merging them bottom-up leaves PR #2..#n merged into branches that are never merged onward, so the release PR carries only the first story. The UI run needed an extra recovery PR (#30) for this. Merge top-down (last story PR first, so each folds into its parent and the release PR carries all), or retarget each PR to the release branch after merging the one below it; then check that the release PR diff contains every story before merging it.

W3 marathon: release branch `release/marathon-w3`; suggested limits 2 stories / 3 hours (STAR-18 is 5 pts and spans `ui/**` and `api/**`, STAR-19 is 1 pt). Contract edits inside it go through their own PR. Merge top-down, or squash one release PR.

Marathon preflight on this project: use `-Tools git,gh` (no `az`), and pass `-TestCommand "dotnet test"` once `tests/` exists. Before any run the active `gh` account must be `dmbierman1210` (or the agent must set `GH_TOKEN` for that account in its own terminal).

Critical path: STAR-1 -> STAR-2 -> {API lane || UI lane} -> STAR-15..17 -> STAR-18 -> STAR-19.

## Baseline findings (analysis of the exercise as received, 2026-11-11)

Source of the stories above. Original paths: `extracted/tech_exercise/package/exercise1/api/` (becomes `api/` in STAR-1).

**What exists:** `dotnet build` (net8.0) succeeds with 6 nullable warnings. Controllers (`PersonController`, `AstronautDutyController`) -> MediatR commands/queries in `Business/` -> `StargateContext` (EF Core SQLite) plus a Dapper connection. One migration (`InitialCreate`). No `.db` file, no tests, no `.sln`, no `.gitignore`, no UI, no logging store.

**Defects and gaps:**
1. SQL injection: user-supplied `Name` is concatenated into SQL in `GetPersonByName.cs`, `GetAstronautDutiesByName.cs`, `CreateAstronautDuty.cs`.
2. `AstronautDutyController.GetAstronautDutiesByName` sends `GetPersonByName`, so duties are never returned; `GetAstronautDutiesByNameHandler` dereferences a null person for unknown names.
3. Unknown person on GET returns 200 with null body, not 404.
4. `CreateAstronautDuty` has no try/catch, so the pre-processor `BadHttpRequestException("Bad Request")` surfaces differently from `CreatePerson`, where the same exception is caught and turned into HTTP 500 with a generic message. Messages carry no reason.
5. Duty duplicate check matches title + start date across all people, not per person. No check that the new start date is after the current duty's start.
6. `RETIRED` handling: for a first-ever duty `CareerEndDate` is set to the start date (rule says one day before); "RETIRED" is a case-sensitive magic string; behavior for a duty added after retirement is undefined.
7. No person update endpoint although "add/update" is required; `POST /Person` takes a bare JSON string body; no trim/empty/length validation.
8. Database never created: no `Migrate()` call, `SeedData` is commented out, no unique index on `Person.Name` (uniqueness is only a pre-check, racy).
9. Model/migration drift: `AstronautDetail.CareerStartDate` is `DateTime` in the model but nullable in the migration and snapshot; the snapshot says EF 7.0.15 while the project uses 8.0.4; migration namespace `StargateAPI.Migrations` vs folder `Business/Migrations`.
10. Mixed data access (Dapper reads + EF writes on the same connection) with manual `Update()` of detached entities.
11. No logging anywhere, no tests, no CORS (needed for Angular), Swagger only in Development.
12. Repo: `extracted/` is untracked, `bin/`/`obj/` contain a stale `net7.0` build, no `.gitignore`.

## Open items for the human

1. STAR-21: owner decisions on account model, sessions, roles and whether reads need login (see issue #22) before it is refined.
2. Switch the `gh` account back to the work account when you finish working here, and back to `dmbierman1210` before any marathon.
