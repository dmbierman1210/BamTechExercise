# How this project is run (and why)

This exercise is delivered with AI agents, run by a human-owned process. This page explains
the moving parts, with a diagram for each. It reflects the state on 2026-11-11 and is updated
as the process changes. The detail lives in `TRACKING.md` (rules, decisions, status) and the
GitHub issues (one per story).

**The one-sentence version:** a human owns every decision and every merge; a PM agent turns
requests into well-specified issues and keeps the tracker honest; worker agents each build one
story on their own branch; everything is checked against written acceptance criteria and a
shared API contract.

## 1. Who does what

```mermaid
flowchart LR
    H["Owner (human)<br/>decides, reviews, merges"]
    PM["PM agent<br/>refines requests, writes issues,<br/>owns TRACKING.md"]
    W["Worker agents<br/>one story each,<br/>own branch + worktree"]
    R["Review agent<br/>fresh context, comments on PR"]
    GH[("GitHub issues<br/>content + state<br/>authoritative")]
    TR[("TRACKING.md<br/>rules, decisions,<br/>who has what")]

    H -- "requests, answers, decisions" --> PM
    PM -- "creates / edits" --> GH
    PM -- "commits directly to main" --> TR
    W -- "claims, updates" --> GH
    W -- "own row only" --> TR
    W -- "opens PR" --> R
    R -- "findings as PR comment" --> W
    W -- "PR link" --> H
    H -- "merges (only humans merge)" --> GH
```

**Why this split:** the expensive failures on multi-agent work are coordination failures
(two agents on one story, hidden work, state that disagrees), not code quality. So the roles
are separated: the PM never implements, workers never decide scope, and nobody but the owner
merges. If the sources disagree, GitHub issue state wins, then `TRACKING.md`.

## 2. Life of a request

```mermaid
flowchart TD
    A["New idea or request"] --> B["PM restates it and asks<br/>targeted questions"]
    B --> C{"Architecture, security,<br/>scope or release question?"}
    C -- "yes" --> D["Owner decides.<br/>PM never answers these itself"]
    C -- "no" --> E["PM proposes a concrete model"]
    D --> E
    E --> F["PM writes issue:<br/>context, changes, acceptance criteria,<br/>dependencies, size, priority"]
    F --> G["Row added to TRACKING.md<br/>in the same session"]
    G --> H["Worker (or marathon) picks it up"]
```

**Why:** a story written with its constraints and rationale lets a worker build it without
re-deriving the design or interrupting a human. Adding the tracker row immediately avoids
numbering collisions (a created-but-untracked story is a trap).

## 3. Story lifecycle and the rules that guard it

```mermaid
stateDiagram-v2
    [*] --> Proposed: issue exists with acceptance criteria
    Proposed --> NotStarted: dependencies Done, ready to pick
    NotStarted --> InProgress: CLAIM (label + comment + tracker cell + own branch)
    InProgress --> InReview: PR opened, review agent comments
    InReview --> InProgress: valid findings fixed
    InReview --> Done: OWNER merges, then close-out
    InProgress --> NotStarted: wrong story, un-claim and say why
    Done --> [*]
```

| Rule | Why it exists |
|---|---|
| **Claim first, before any research** | Hides no work from other agents. "I need to investigate first" is not an excuse: claiming costs nothing. |
| **Touch only your own tracker row** | A non-owner once marked stories Done while tickets stayed open; board and tickets silently disagreed. |
| **No agent merges, ever** | A person is accountable for what reaches `main`. No auto-merge, no API merge. |
| **Run-and-look for anything client-visible** | Unit tests passing is not proof a UI works. The worker launches it and records what it saw. |
| **Fresh-context review** | A reviewer that did not write the code does not share its blind spots. |
| **Close out every box in the same session** | "PR merged" is not "story done": worktree, branch, notes, exec summary, issue, tracker row. |

## 4. Why a contract comes first

```mermaid
flowchart LR
    C["docs/api/openapi.yaml<br/>(STAR-2, owner-approved)"]
    subgraph API lane
      A1["API code in api/**<br/>implements the contract"]
    end
    subgraph UI lane
      U1["Angular app in ui/**<br/>generated client + stateful mock"]
    end
    C --> A1
    C --> U1
    A1 -. "joined at STAR-18<br/>(CORS, remove mock, e2e)" .- U1
```

**Why:** the UI is the priority, and it should not wait for the API. If both sides build
against one written contract, they can run in parallel and only meet at integration. The
contract file is the *only* coupling, so a story may not edit it; changing it needs its own
owner-approved PR.

## 5. Dependency map

```mermaid
flowchart TD
    S1["STAR-1 repo layout (Done)"] --> S2["STAR-2 contract"]
    S2 --> S3["STAR-3 DB + tests scaffold"]
    S3 --> S4["STAR-4 EF only, no SQL injection"]
    S4 --> S5["STAR-5 duties-by-name fix"]
    S4 --> S6["STAR-6 person add/rename + audit"]
    S4 --> S7["STAR-7 duty rules core"]
    S7 --> S8["STAR-8 backdate, return, reason"]
    S6 --> S9["STAR-9 error handling"]
    S8 --> S9
    S2 --> S10["STAR-10 UI scaffold + mock"]
    S10 --> S11["STAR-11 people list"]
    S11 --> S12["STAR-12 person detail"]
    S12 --> S13["STAR-13 forms"]
    S13 --> S14["STAR-14 polish"]
    S9 --> S15["STAR-15 DB logging"]
    S9 --> S16["STAR-16 coverage gate"]
    S16 --> S17["STAR-17 CI"]
    S9 --> S18["STAR-18 wire UI to API"]
    S14 --> S18
    S18 --> S19["STAR-19 README + notes"]
    S8 --> S20["STAR-20 void/correct (stretch)"]
    S20 --> S21["STAR-21 login (stretch)"]
```

## 6. What a marathon is

A marathon is **one agent working one lane's stories in order, unattended, inside limits
the owner confirms**. It exists to turn a well-specified backlog into a stack of reviewable
PRs without a human prompting every story.

```mermaid
flowchart TD
    R["PM marks stories marathon-ready<br/>criteria written, dependencies inside the run,<br/>no open design question, no missing credentials"]
    R --> O["OWNER starts the run<br/>and confirms limits (stories, hours)"]
    O --> L["Next story in order"]
    L --> CL["Claim it"]
    CL --> Q{"Hits an architecture, security<br/>or scope question?"}
    Q -- "yes" --> P["PARK the story,<br/>record the question, move on"]
    Q -- "no" --> B["Build + test + PR<br/>stacked on the lane's release branch"]
    B --> RV["Fresh-context review comment"]
    P --> M
    RV --> M{"Limit reached<br/>or STOP file?"}
    M -- "no" --> L
    M -- "yes" --> E["Report + draft PR of the release branch into main"]
    E --> H["OWNER reviews, answers parked questions,<br/>and merges"]
```

| Lane | Stories | Owns | Release branch |
|---|---|---|---|
| API | STAR-3..9 | `api/**`, `tests/**` | `release/marathon-api` |
| UI | STAR-10..14 | `ui/**` | `release/marathon-ui` |
| HARD | STAR-15..17 | `api/**`, `tests/**`, `.github/**` | `release/marathon-harden` |

**Why API and UI can run at once:** their paths do not overlap, and their only shared input is
the contract. **Why HARD waits:** logging, coverage and CI touch the same files as the API lane,
so it starts after the API PRs are merged.

**Safety stance:** the PM never starts a marathon and never calls one safe to leave. The run
parks rather than guesses on design questions, a `STOP` file ends it, and nothing merges itself.

## 7. Target request flow for a write (what the API is being built to do)

```mermaid
sequenceDiagram
    participant UI as Angular UI
    participant API as ASP.NET Core API
    participant DB as SQLite (EF Core)
    UI->>API: POST /AstronautDuty + X-Actor header
    API->>API: validate (names, dates, reason, actor)
    alt invalid
        API-->>UI: 400 { success:false, errors[] }
    else valid
        API->>DB: begin transaction
        API->>DB: apply duty rules, re-chain end dates
        API->>DB: append AuditEntry (actor, reason, before/after)
        API->>DB: commit
        API-->>UI: 201 { success:true, id }
    end
    API->>DB: process log entry (success or exception)
```

**Why these choices:** EF Core only (removes the SQL injection); a transaction so a failed
call changes nothing; an append-only audit trail so nothing is ever hard-deleted; one response
envelope so the UI handles every outcome the same way; `X-Actor` as a header so real login
(STAR-21) can replace it later without changing routes or bodies.

## 8. Decisions made by the owner

See `TRACKING.md` D1-D12. Highlights: private repo and personal account only (D1); add and
rename a person (D3); backdating and return from retirement allowed with a stored reason
(D4); EF only (D5); UI is the MVP priority (D6); always an audit trail (D8); `X-Actor` header
(D10); object body, response envelope kept, case-insensitive names (D11); future start dates
allowed with a reason (D12).
