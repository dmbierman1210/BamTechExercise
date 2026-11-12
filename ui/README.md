# Stargate ACTS UI

Angular app for the Astronaut Career Tracking System, built against the API contract in
[`docs/api/openapi.yaml`](../docs/api/openapi.yaml) and a local mock API, so it does not wait for the real API.

- Angular 21 (standalone components, signals, strict TypeScript, SCSS), Angular Material 21 with a custom dark
  "mission control" theme.
- Unit tests run on Angular's default runner (Vitest with jsdom: no browser needed). ESLint via `angular-eslint`.
- Needs Node 22 (>= 22.12) and npm 10.

## Commands

Run everything from this `ui/` folder.

| Command | What it does |
| --- | --- |
| `npm ci` | Clean install from `package-lock.json` (use `npm install` only to change dependencies). |
| `npm start` | Mock API on <http://localhost:3000> and the app on <http://localhost:4200>, together. |
| `npm run start:mock` | Only the mock API (`PORT`, `MOCK_EMPTY`, `MOCK_DELAY_MS`, see below). |
| `npm run start:app` | Only the app (`ng serve`); uses `src/environments/environment.development.ts`. |
| `npm run generate:api` | Regenerates the typed API schema from `docs/api/openapi.yaml`. |
| `npm run lint` | ESLint (TypeScript and templates). |
| `npm test` | One non-watch run of the app tests (`test:ui`) and the mock-server tests (`test:mock`). Exits by itself, fine for CI. |
| `npm run build` | Production build into `dist/acts-ui` (uses `environment.ts`, the real API URL). |

## Structure

```
ui/
  mock-server/            Stateful mock API (plain Node ESM, no dependencies) and its node:test tests
  scripts/generate-api.mjs  Contract -> src/app/api/generated/schema.ts
  src/environments/       apiBaseUrl: development = http://localhost:3000 (mock), production = http://localhost:5204 (real API)
  src/app/
    api/                  Typed client layer
      generated/          GENERATED, do not edit (header says so); committed
      models.ts           Friendly aliases over the generated schema
      person.service.ts   getPeople, getPersonByName, createPerson, renamePerson
      duty.service.ts     getAstronautDutiesByName, createAstronautDuty
      api-error.ts        ApiError (status, message, errors[]) + envelope mapping
      error.interceptor.ts  Maps every failed call to ApiError
    core/                 "Acting as": ActorService, interceptor, dialog, toolbar control, ActorRequiredDirective
    pages/                People list (`/people`), person detail (`/people/:name`), 404
    shared/               StatusBadge (icon + text badge) and date helpers (`dates.ts`)
    app.*                 Shell: toolbar, nav (slide-over sidenav on phone widths), router outlet
  src/styles.scss         Theme: Material 3 dark theme + --acts-* CSS variables (colors, spacing, typography)
```

Service methods are named after the contract's `operationId`s and return the typed response envelopes.
The base URL comes from `API_BASE_URL` (an injection token that defaults to `environment.apiBaseUrl`); to point the
dev build at the real API, change `environment.development.ts` to `http://localhost:5204`.

## Generated API client

`npm run generate:api` uses [`openapi-typescript`](https://openapi-ts.dev) offline on `docs/api/openapi.yaml` and
writes `src/app/api/generated/schema.ts` (committed, header "GENERATED FILE - DO NOT EDIT"). Hand-written code imports
its types through `src/app/api/models.ts`, so if the contract removes or renames a schema the build fails until the
app is updated. After a contract change: run `npm run generate:api`, then `npm run build`, then commit the result.

## Errors

`errorInterceptor` turns every failed HTTP call into an `ApiError`:

- API envelope (`success`, `message`, `responseCode`, optional `errors[{field, message}]`) -> `status`, `message`, `errors`.
  Use `error.fieldMessage('reason')` to show a field error.
- Network failure (status 0) -> message "API unreachable. ...".
- Anything else (e.g. an HTML 502 page) -> a generic message with the status.

## "Acting as" and the X-Actor header

Every write (`POST`, `PUT`, `PATCH`, `DELETE`) must carry `X-Actor`, who made the change (contract: 1 to 100
characters, trimmed). The toolbar's **Acting as** control asks for a name, stores it in `localStorage` under
`acts.actor`, lets you change or clear it, and labels it **self-declared, not verified**.

- `actorInterceptor` adds `X-Actor` to every write request while a name is set.
- `ActorService.hasActor()` is a signal; write actions must stay disabled with a hint until it is true. Put the
  `appActorRequired` directive on every button that changes data:
  `<button mat-flat-button appActorRequired (click)="save()">Save</button>`. It disables the control and sets the hint
  as its title. Do not also bind `[disabled]` on that element.
- The toolbar control turns amber ("Set your name") while no name is set. The dialog is not opened automatically.

## Mock API (`mock-server/`)

Plain Node (no dependencies), stateful in memory (restart to reset). Seeded from the contract examples:
John Doe (active, 3 duties), Jane Roe (retired, 3 duties ending in `RETIRED`, consistent with her list entry),
Richard Roe (no duties) and Ada Stone (returned from retirement: Pilot 2005, Flight Engineer 2010, `RETIRED` 2015, then
Pilot 2018 with the reason "Returned from retirement"; Active again, no career end). Next ids are person 5 and duty 11.

| Setting | Effect |
| --- | --- |
| `PORT` | Port to listen on (default 3000). |
| `MOCK_EMPTY=1` | Start with no people. |
| `MOCK_DELAY_MS=400` | Delay every response (to see loading states). |

PowerShell example: `$env:MOCK_EMPTY=1; npm run start:mock`.

It implements all six routes with the contract's status codes, envelope and field errors: 400 for a missing or blank
`X-Actor` on writes, invalid names (trim, 1 to 200) and malformed bodies; 404 for an unknown person on every route that
takes a name, including `POST /AstronautDuty`; 409 for a duplicate name (case-insensitive) and for a duty with the same
start date; the duty reason rule (400 on field `reason` when the start is after today UTC, before the latest duty start,
or the latest duty is `RETIRED`); `RETIRED` matched case-insensitively; end dates re-chained so the timeline is
gap-free; derived `currentRank`, `currentDutyTitle`, `astronautStatus`, `careerStartDate`, `careerEndDate`; duties
newest first. Order of checks follows the contract: header/body validation, then 404, then 409, then history rules.
CORS is open, including `X-Actor` and the preflight.

## People list (`/people`)

The default route lists everyone from `GET /Person` (`PersonService.getPeople`) as responsive cards: name (a link to
`/people/:name`, URL-encoded), current rank, current duty title and a status badge. Badges carry an icon and text, so
color is never the only signal: `None` = "Not an astronaut", `Active`, `Retired`. States: loading skeleton, "No people
yet" (with a disabled Add person placeholder until STAR-13; it uses `disabledInteractive`, so it stays focusable and
points to its hint with `aria-describedby`), "No matches" (with a clear button) and a retryable error that shows the
API message.

List state lives in the URL query params, so it survives reloads and browser Back:

| Param | Values | Default (omitted from the URL) |
| --- | --- | --- |
| `q` | name search, case-insensitive substring | empty |
| `status` | `active`, `retired`, `none` | all |
| `sort` | `name-asc`, `name-desc` (case-insensitive) | `name-asc` |

Invalid values fall back to the defaults. Filter changes use `replaceUrl`, so they do not fill the history. Other pages
that link back to the list should use `PeopleListState` (`pages/people-list-state.ts`), which remembers the last
params: `<a routerLink="/people" [queryParams]="listState.queryParams()">Back to People</a>`.

## Person detail (`/people/:name`)

Calls `DutyService.getAstronautDutiesByName` (`GET /AstronautDuty/{name}`, name URL-encoded; the route param is decoded
by the router, so spaces, `/`, `?` and `%` work). The heading (focused after navigation) is the route name until the
response gives the canonical one. Header: status badge (`shared/status-badge.ts`, also used by the list), current rank
and duty title, career start and end ("Present" while there is no end) and the career length ("5 years, 3 months", from
the career start to the career end or today; for a returned-from-retirement person it runs to today, "so far").

The timeline is an `<ol>` of duties, newest first: rank, title, start to end (or "Present"), and the reason when there
is one. The open duty is highlighted with a "Current" label and `aria-current`; a `RETIRED` duty has a dashed amber
frame and a "Retired" label, so status never relies on color. States: loading skeleton, "Person not found" for a 404
(link back), "No astronaut assignments" for no duties, and a retryable error with the API message. "Back to People"
restores the list's `q`/`status`/`sort` through `PeopleListState`.

Dates: `yyyy-MM-dd` values are never passed to `new Date(string)` (that is UTC midnight, so the day shifts west of
Greenwich). `shared/dates.ts` splits the parts, formats with `Intl.DateTimeFormat(locale, { dateStyle: 'medium',
timeZone: 'UTC' })` using the browser locale and does the career-length math on integers. `dates.spec.ts` runs it with
`TZ` set to a negative-offset zone (America/Los_Angeles, Pacific/Honolulu) and a positive one (Pacific/Kiritimati).

## Screenshots

`docs/screenshots/`: `star-10-shell-desktop.png` (1280 px), `star-10-shell-phone.png` (390 px),
`star-11-list-desktop.png`, `star-11-list-phone.png`, `star-11-search-filter.png`, `star-11-error.png` (mock stopped),
`star-11-empty.png` (`MOCK_EMPTY=1`), `star-12-active-desktop.png` (John Doe), `star-12-retired-desktop.png` (Jane Roe),
`star-12-returned-desktop.png` (Ada Stone), `star-12-none-desktop.png` (Richard Roe), `star-12-notfound.png`,
`star-12-active-phone.png` (390 px).

