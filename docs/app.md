# How the Stargate application works

The Astronaut Career Tracking System (ACTS) keeps a master list of **people** and, for those
who served as astronauts, their **duty history**. This page explains the application as it
was received (the baseline), what is wrong with it, and what it becomes. Process (who builds
what, and how) is in [process.md](process.md). Original exercise text: [EXERCISE.md](EXERCISE.md).
Code references are to `api/`.

## 1. The system at a glance

```mermaid
flowchart LR
    subgraph Client
      UI["Angular UI<br/>(STAR-10..14, not built yet)"]
      SW["Swagger UI<br/>(Development only)"]
    end
    subgraph "ASP.NET Core 8 Web API  (api/)"
      CT["Controllers<br/>PersonController<br/>AstronautDutyController"]
      ME["MediatR<br/>request to handler"]
      HD["Commands + Queries<br/>(Business/)"]
      EF["StargateContext<br/>EF Core"]
    end
    DB[("SQLite<br/>starbase.db")]

    UI --> CT
    SW --> CT
    CT --> ME --> HD --> EF --> DB
```

| Piece | What it is | Where |
|---|---|---|
| Controllers | HTTP routes, turn a result into an HTTP response | `Controllers/` |
| MediatR | A mediator: the controller sends a *request object*, MediatR finds the one *handler* for it. Keeps controllers thin and each use case in one class | `Program.cs`, `Business/` |
| Commands | Requests that change data (`CreatePerson`, `CreateAstronautDuty`) | `Business/Commands/` |
| Queries | Requests that only read (`GetPeople`, `GetPersonByName`, `GetAstronautDutiesByName`) | `Business/Queries/` |
| `StargateContext` | The EF Core database session; maps classes to tables | `Business/Data/` |
| SQLite | A single-file database (`Data Source=starbase.db`) | `appsettings.json` |

**Pattern to name in the interview:** CQRS-style request/handler separation using MediatR
(commands change state, queries read it), with a pre-processor hook for validation.

## 2. The data model

```mermaid
erDiagram
    Person ||--o| AstronautDetail : "has at most one"
    Person ||--o{ AstronautDuty : "has many"
    Person {
        int Id PK
        string Name "unique identity"
    }
    AstronautDetail {
        int Id PK
        int PersonId FK
        string CurrentRank
        string CurrentDutyTitle
        date CareerStartDate
        date CareerEndDate "null while active"
    }
    AstronautDuty {
        int Id PK
        int PersonId FK
        string Rank
        string DutyTitle
        date DutyStartDate
        date DutyEndDate "null for the current duty"
    }
```

- `AstronautDuty` is the **history** (one row per assignment).
- `AstronautDetail` is a **summary of the latest state**, kept in step with the history. It
  exists only once the person has had a first duty (a person with no assignments has no
  astronaut records).
- Planned additions: a case-insensitive unique index on `Person.Name` (STAR-3), `Reason` on
  `AstronautDuty` (STAR-8), and an append-only `AuditEntry` table (STAR-6).

## 3. The business rules

From the exercise, plus the owner's decisions (`TRACKING.md` D3 to D12):

| # | Rule | Enforced today? | Fixed in |
|---|---|---|---|
| 1 | A person is identified by name (unique) | Partly: case-sensitive check, no DB constraint | STAR-3, STAR-6 |
| 2 | No assignment, no astronaut records | Yes (detail created on first duty) | kept |
| 3 | One current duty at a time | No: nothing prevents two open duties | STAR-7 |
| 4 | The current duty has no end date | Partly | STAR-7 |
| 5 | A new duty ends the previous one the day before it starts | Partly: closes the latest duty even if already closed | STAR-7 |
| 6 | Title `RETIRED` means retired | Case-sensitive match only | STAR-7 |
| 7 | Career end = day before the retired duty starts | Wrong for a first-ever retired duty (uses the start date); right otherwise | STAR-7 |
| D4 | Backdating and return from retirement allowed, with a stored reason; neighbours re-chained | Not supported | STAR-8 |
| D12 | Future start dates allowed, with a reason | Not supported | STAR-8 |

### A worked example: how a timeline chains

```mermaid
gantt
    title Duty history for one person (end dates are set by the system)
    dateFormat YYYY-MM-DD
    axisFormat %Y
    section Duties
    1LT Pilot (ends day before next starts)  :done, d1, 2020-01-01, 2022-06-30
    CPT Commander (ends day before next starts) :done, d2, 2022-07-01, 2024-12-31
    RETIRED (open, no end date)          :active, d3, 2025-01-01, 2026-01-01
    section Career
    Career span (end = day before RETIRED starts) :c1, 2020-01-01, 2024-12-31
```

When a duty is added, the system (not the caller) sets the previous duty's end date to the
day before the new start date. Retiring sets the career end date to the day before the
retired duty starts. Those two calculations are the core of the exercise.

## 4. The API, as received

| Route | Intended behaviour | What the code actually does |
|---|---|---|
| `GET /Person` | List everyone with astronaut summary | Works (raw SQL via Dapper) |
| `GET /Person/{name}` | One person | Works, but returns 200 with a null person for an unknown name |
| `POST /Person` | Add a person | Body is a bare JSON string; duplicate check is case-sensitive; no validation |
| `GET /AstronautDuty/{name}` | Duty history for a person | **Calls the wrong query** (`GetPersonByName`), so it never returns duties |
| `POST /AstronautDuty` | Add a duty | Several rule bugs (section 6) |

## 5. Request flow today, and where it breaks

### Reading a person (SQL injection)

```mermaid
sequenceDiagram
    participant C as Caller
    participant API as PersonController
    participant H as GetPersonByNameHandler
    participant DB as SQLite
    C->>API: GET /Person/{name}
    API->>H: send GetPersonByName(name)
    H->>DB: "SELECT ... WHERE '" + name + "' = a.Name"
    Note over H,DB: the name is pasted into the SQL text,<br/>so a name like  ' OR '1'='1  changes the query
    DB-->>H: rows
    H-->>API: person (or null)
    API-->>C: 200 even when null
```

### Adding a duty (the heart of the exercise)

```mermaid
flowchart TD
    A["POST /AstronautDuty<br/>name, rank, title, start date"] --> B["Pre-processor"]
    B --> B1{"Person exists?"}
    B1 -- "no" --> E1["throws BadHttpRequestException<br/>(no response envelope, wrong status semantics)"]
    B1 -- "yes" --> B2{"ANY duty with same title and start date?<br/>(checks ALL people, not this one)"}
    B2 -- "yes" --> E1
    B2 -- "no" --> H["Handler"]
    H --> H1["Dapper: find person (string-built SQL)"]
    H1 --> H2{"Has AstronautDetail?"}
    H2 -- "no" --> H3["create detail<br/>CareerStart = start date<br/>if RETIRED: CareerEnd = start date (should be start - 1)"]
    H2 -- "yes" --> H4["update rank and title<br/>if RETIRED: CareerEnd = start - 1<br/>CareerStart never maintained"]
    H3 --> H5
    H4 --> H5["Dapper: latest duty by start date"]
    H5 --> H6["set its end date = new start - 1<br/>(even if it already had one)"]
    H6 --> H7["add new duty, SaveChanges"]
    H7 --> OK["return new duty Id"]
```

The pre-processor and the handler are separate steps, there is no transaction around the whole
operation, and nothing checks date order. These are the gaps STAR-7 and STAR-8 close.

## 6. Defects found in the baseline, and the story that fixes each

```mermaid
flowchart LR
    subgraph Security
      D1["User input pasted into SQL in 3 handlers<br/>(SQL injection)"] --> F4["STAR-4"]
    end
    subgraph Correctness
      D2["Duties-by-name sends the wrong query"] --> F5["STAR-5"]
      D3["Null dereferences: unknown person<br/>crashes duty read and duty create"] --> F5
      D4["Duty rules: duplicate check across all people,<br/>no ordering, RETIRED case, first-ever retirement date,<br/>CareerStartDate not kept"] --> F7["STAR-7"]
      D5["Cannot backdate or return from retirement"] --> F8["STAR-8"]
      D6["Duplicate person check case-sensitive,<br/>no name validation"] --> F6["STAR-6"]
    end
    subgraph Robustness
      D7["Inconsistent error handling<br/>(try/catch in some actions, none in others)"] --> F9["STAR-9"]
      D8["Database never created, seed commented out,<br/>model and migration drift"] --> F3["STAR-3"]
      D9["Dapper reads mixed with EF writes<br/>on one connection"] --> F4
    end
    subgraph "Missing entirely"
      D10["No tests"] --> F16["STAR-3 scaffold, STAR-16 gate"]
      D11["No logging"] --> F15["STAR-15"]
      D12["No UI, no CORS"] --> F10["STAR-10..14, STAR-18"]
    end
```

## 7. What it becomes (target)

```mermaid
flowchart LR
    UI["Angular UI"] -->|"HTTP + X-Actor header<br/>against openapi.yaml"| CT["Controllers (thin)"]
    CT --> MW["Global error handling<br/>one response envelope"]
    MW --> ME["MediatR"]
    ME --> V["Validation<br/>(trim, length, dates, reason, actor)"]
    V --> H["Handlers: EF Core only,<br/>one transaction per write"]
    H --> DB[("SQLite")]
    H --> AU["AuditEntry<br/>append-only: who, what, why"]
    H --> LG["Process log table<br/>successes and exceptions"]
    AU --> DB
    LG --> DB
```

| Change | Why it matters |
|---|---|
| EF Core only | Parameterised by construction; removes the injection and the mixed-connection hazard |
| One transaction per write | A failed call changes nothing; no half-updated timeline |
| One response envelope + global error handler | The UI handles every outcome one way; no raw exceptions |
| Audit trail + `X-Actor` | Nothing is hard-deleted; every change records who and why |
| Process logging in the database | An exercise requirement; also what you would use to debug in production |
| Contract first (`openapi.yaml`) | UI and API can be built in parallel and checked against one file |

## 8. Interview prompts this page should help you answer

- *What is wrong with the code you were given?* Section 6, ordered by severity: security first,
  then correctness, then robustness.
- *Why MediatR?* Section 1: one class per use case, thin controllers, a place to hang validation.
- *Walk me through adding a duty.* Section 5 (as received) then section 3 (how the timeline chains).
- *What would you do differently with more time?* The stretch stories: correct or void a duty
  with an audit trail (STAR-20) and real login in place of the self-declared actor (STAR-21).
