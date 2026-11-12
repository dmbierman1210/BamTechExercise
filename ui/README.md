# Stargate ACTS UI

Angular app for the Astronaut Career Tracking System, built against the API contract in
[`docs/api/openapi.yaml`](../docs/api/openapi.yaml). It talks to the real API by default; a stateful mock API is
available as an opt-in for working without the API.

- Angular 21 (standalone components, signals, strict TypeScript, SCSS), Angular Material 21 with a custom dark
  "mission control" theme.
- Unit tests run on Angular's default runner (Vitest with jsdom: no browser needed). ESLint via `angular-eslint`.
- Needs Node 22 (>= 22.12) and npm 10.

## Commands

Run everything from this `ui/` folder.

| Command                                   | What it does                                                                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                  | Clean install from `package-lock.json` (use `npm install` only to change dependencies).                                                                              |
| `npm start`                               | The app on <http://localhost:4200> against the real API on <http://localhost:5204> (start the API first, or use `..\scripts\start.ps1` from the repo root for both). |
| `npm run start:with-mock`                 | Opt-in: the mock API on <http://localhost:3000> and the app built with `environment.mock.ts` pointing at it, together.                                               |
| `npm run start:mock`                      | Only the mock API (`PORT`, `MOCK_EMPTY`, `MOCK_DELAY_MS`, see below).                                                                                                |
| `npm run e2e`                             | End-to-end smoke test (Playwright): see "End-to-end test" below. Starts its own API and UI.                                                                          |
| `npm run generate:api`                    | Regenerates the typed API schema from `docs/api/openapi.yaml`.                                                                                                       |
| `npm run lint`                            | ESLint (TypeScript and templates).                                                                                                                                   |
| `npm run format` / `npm run format:check` | Prettier (`.prettierrc`: 100 columns, single quotes, `endOfLine: auto` so Windows checkouts with CRLF are not rewritten). `format:check` is what CI should run.      |
| `npm test`                                | One non-watch run of the app tests (`test:ui`) and the mock-server tests (`test:mock`). Exits by itself, fine for CI.                                                |
| `npm run build`                           | Production build into `dist/acts-ui` (uses `environment.ts`, the real API URL). Enforces the budgets below.                                                          |
| `npm run a11y:browser`                    | axe-core, all rules incl. color-contrast, in a real browser against the running app + mock (see "Accessibility"). Needs playwright-core, which is not a dependency.  |
| `npm run walkthrough`                     | Keyboard-only walkthrough (Acting as, add person, add duty, rename) in a real browser. Same prerequisites; run it on a fresh mock.                                   |

## Structure

```
ui/
  mock-server/            Stateful mock API (plain Node ESM, no dependencies) and its node:test tests
  scripts/generate-api.mjs  Contract -> src/app/api/generated/schema.ts
  scripts/a11y-browser.mjs, scripts/keyboard-walkthrough.mjs  Real-browser axe scan and keyboard walkthrough (need playwright-core)
  src/environments/       apiBaseUrl: development and production = http://localhost:5204 (real API), mock = http://localhost:3000
  e2e/, playwright.config.ts  End-to-end smoke test against the real API (Playwright)
  src/app/
    api/                  Typed client layer
      generated/          GENERATED, do not edit (header says so); committed
      models.ts           Friendly aliases over the generated schema
      person.service.ts   getPeople, getPersonByName, createPerson, renamePerson
      duty.service.ts     getAstronautDutiesByName, createAstronautDuty
      api-error.ts        ApiError (status, message, errors[]) + envelope mapping
      error.interceptor.ts  Maps every failed call to ApiError
    core/                 "Acting as": ActorService, interceptor, dialog, toolbar control, ActorRequiredDirective, ActorHint, Notifier;
                          polish: ConnectionStatus + ConnectionBanner, StatusAnnouncer (live region), page titles, motion helper
    pages/                People list (`/people`), person detail (`/people/:name`), 404
    shared/               StatusBadge, StateNotice + Illustration (empty/error/404 states), form helpers, date helpers (`dates.ts`)
    app.*                 Shell: toolbar, nav (slide-over sidenav on phone widths), router outlet
  src/styles.scss         Theme: Material 3 dark theme + --acts-* CSS variables (colors, spacing, typography)
```

Service methods are named after the contract's `operationId`s and return the typed response envelopes.
The base URL comes from `API_BASE_URL` (an injection token that defaults to `environment.apiBaseUrl`). It is fixed at
build time and is localhost only (owner decision D14: no runtime config, no proxy). `ng serve` and `ng build` use
`environment.development.ts` / `environment.ts` (both `http://localhost:5204`); the `mock` configuration swaps in
`environment.mock.ts` (`http://localhost:3000`).

## Running against the real API (CORS)

The API allows exactly one browser origin, `http://localhost:4200` (setting `Cors:AllowedOrigin`), only in the
Development environment, for `GET`, `POST`, `PUT` and the headers `Content-Type` and `X-Actor`. There is no wildcard. If
the UI is served from another origin (for example another port), start the API with
`Cors__AllowedOrigin=http://localhost:<port>`.

A browser blocks a call the API does not allow and reports it as a network failure, so a CORS problem looks like
"API unreachable" in the UI (the message names CORS). When you see it: is the API running on 5204, is it in Development
(`ASPNETCORE_ENVIRONMENT=Development`), and is the app served from the allowed origin? The browser console names the
blocked origin.

## End-to-end test

`npm run e2e` runs `e2e/smoke.e2e.ts` with Playwright: add a person, add a duty and see it on the timeline against the
real API (plus a duplicate-name conflict). The Playwright config starts the API itself on port 5204 with a throwaway
SQLite file in the temp folder (seeded, never `api/starbase.db`) and the UI on 4200 (an already running UI is reused).
Stop any API running on 5204 first. One-time setup: `npx playwright install chromium`, or set
`E2E_BROWSER_CHANNEL=msedge` (or `chrome`) to use an installed browser. It needs the .NET 8 SDK for `dotnet run`.

## Generated API client

`npm run generate:api` uses [`openapi-typescript`](https://openapi-ts.dev) offline on `docs/api/openapi.yaml` and
writes `src/app/api/generated/schema.ts` (committed, header "GENERATED FILE - DO NOT EDIT"). Hand-written code imports
its types through `src/app/api/models.ts`, so if the contract removes or renames a schema the build fails until the
app is updated. After a contract change: run `npm run generate:api`, then `npm run build`, then commit the result.

## Errors

`errorInterceptor` turns every failed HTTP call into an `ApiError`:

- API envelope (`success`, `message`, `responseCode`, optional `errors[{field, message}]`) -> `status`, `message`, `errors`.
  Use `error.fieldMessage('reason')` to show a field error.
- Network failure (status 0) -> message "API unreachable. ..." (it names CORS as a possible cause, see "Running
  against the real API").
- A 500 carries a `traceId`; the message ends with `(reference <traceId>)` so the failure can be found in the API's
  process log (`LogEntry.TraceId`).
- Anything else (e.g. an HTML 502 page) -> a generic message with the status.

## "Acting as" and the X-Actor header

Every write (`POST`, `PUT`, `PATCH`, `DELETE`) must carry `X-Actor`, who made the change (contract: 1 to 100
characters, trimmed). The toolbar's **Acting as** control asks for a name, stores it in `localStorage` under
`acts.actor`, lets you change or clear it, and labels it **self-declared, not verified**.

- `actorInterceptor` adds `X-Actor` to every write request while a name is set.
- `ActorService.hasActor()` is a signal; write actions must stay blocked with a hint until it is true. Put the
  `appActorRequired` directive on every button that changes data and give it the id of a visible hint
  (`<app-actor-hint id="save-hint" />`):
  `<button mat-flat-button appActorRequired="save-hint" [actorBusy]="pending()" (click)="save()">Save</button>`.
  A blocked control keeps focus (`aria-disabled`, not the native `disabled`), points to the hint with
  `aria-describedby`, has the hint as its title, and swallows clicks. `[actorBusy]` blocks it the same way while a
  request is pending (no double submit). Do not also bind `[disabled]` on that element.
- The toolbar control turns amber ("Set your name") while no name is set. The dialog is not opened automatically.

## Mock API (`mock-server/`)

Plain Node (no dependencies), stateful in memory (restart to reset). Seeded from the contract examples:
John Doe (active, 3 duties), Jane Roe (retired, 3 duties ending in `RETIRED`, consistent with her list entry),
Richard Roe (no duties) and Ada Stone (returned from retirement: Pilot 2005, Flight Engineer 2010, `RETIRED` 2015, then
Pilot 2018 with the reason "Returned from retirement"; Active again, no career end). Next ids are person 5 and duty 11.

| Setting             | Effect                                        |
| ------------------- | --------------------------------------------- |
| `PORT`              | Port to listen on (default 3000).             |
| `MOCK_EMPTY=1`      | Start with no people.                         |
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
yet" (with an Add person button), "No matches" (with a clear button) and a retryable error that shows the
API message. The header has a persistent **Add person** button (see "Writing data" below).

List state lives in the URL query params, so it survives reloads and browser Back:

| Param    | Values                                     | Default (omitted from the URL) |
| -------- | ------------------------------------------ | ------------------------------ |
| `q`      | name search, case-insensitive substring    | empty                          |
| `status` | `active`, `retired`, `none`                | all                            |
| `sort`   | `name-asc`, `name-desc` (case-insensitive) | `name-asc`                     |

Invalid values fall back to the defaults. Filter changes use `replaceUrl`, so they do not fill the history. Other pages
that link back to the list should use `PeopleListState` (`pages/people-list-state.ts`), which remembers the last
params: `<a routerLink="/people" [queryParams]="listState.queryParams()">Back to People</a>`.

## Person detail (`/people/:name`)

Calls `DutyService.getAstronautDutiesByName` (`GET /AstronautDuty/{name}`, name URL-encoded; the route param is decoded
by the router, so spaces, `/`, `?` and `%` work). The heading is focused after in-app navigation (by the app shell) but
not on a fresh load or a direct link, so the skip link stays the first Tab stop (owner decision D14). The heading is the route name until the
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

## Writing data (add person, rename, add duty)

All writes need an actor name (see above) and are blocked with a visible hint until one is set. Shared pieces:
`shared/form-errors.ts` (trimmed-text validator, `applyServerError`), `shared/form-alert.ts` (dismissible form-level
message), `core/notifier.ts` (confirmation snackbar, polite live region).

- **Add person** (`pages/add-person-dialog.ts`, `POST /Person`): a dialog opened from the People header or the empty
  state. Name is trimmed, required, at most 200. A 409 shows on the name field, `errors[]` on their fields, anything
  else as a dismissible message. Success goes to `/people/<new name>`; the list reloads whenever it is opened.
- **Rename** (`pages/rename-person-form.ts`, `PUT /Person/{name}`): inline form under the person header. An unchanged
  name (after trimming) sends no request and shows a hint; a case-only change is allowed. Success replaces the URL
  (`replaceUrl`) with the new name and reloads; 404 and 409 are shown in the form.
- **Add duty** (`pages/add-duty-form.ts`, `POST /AstronautDuty`): rank, duty title (with a `RETIRED` quick-pick that also
  fills an empty rank), start date (native `<input type="date">`: its value is exactly `yyyy-MM-dd`, so no time zone
  can shift the day) and reason. The start date defaults to today in UTC. `pages/duty-reason.ts` decides when the reason
  is required, from the loaded duties (latest duty = latest start date) and today in UTC, and a banner (`role="region"`
  inside a polite live region) explains why: **Correcting an earlier date** (before the latest duty start),
  **Returning from retirement** (latest duty is `RETIRED`) or **Future-dated entry** (after today, UTC); if several apply
  the order is that one. A start date that an existing duty already uses is flagged client-side (the server's 409 is
  still handled). Success closes the form, reloads the timeline in place and confirms with a snackbar.
- Submit buttons use `[actorBusy]` while a request is pending, and the submit handlers ignore a second call, so two
  quick clicks send one request. Rename, Add duty and the dialog close with Cancel. `Escape` closes an inline form
  only while nothing was typed; with typed text it is ignored, a hint ("You have unsaved changes. Choose Cancel to
  discard them, or keep editing.") appears and is announced, and the text stays. The Add person dialog behaves the same
  (Escape and backdrop clicks are ignored while the name field is dirty; Cancel always closes).

## Production polish (STAR-14)

- **States on every route.** People list and person page: loading skeleton, empty ("No people yet", "No astronaut
  assignments"), "No matches", "Person not found" and a retryable error, all built on `shared/state-notice.ts` (one
  look: illustration, heading, text, actions) with own inline SVG art in `shared/illustration.ts` (no external files).
  Unknown URLs get the 404 page ("Page not found", an `h1`, link back).
- **Global connection banner** (`core/connection-banner.ts`, state in `core/connection-status.ts`). The error
  interceptor reports every response: a status-0 `ApiError` shows "Cannot reach the API" with **Retry**, `navigator.onLine`
  going false shows "You are offline" (and the page reloads by itself when the browser is back online), a 5xx shows a
  dismissible "The API reported a problem (HTTP 5xx)". Retry bumps `ConnectionStatus.retryTick`; the People and person
  pages watch it and reload (the person page refreshes in place, so open forms stay). 4xx errors are the pages' own
  business and clear the banner. The banner sits in an always-present `role="alert"` wrapper so its text is announced.
- **Titles.** `core/page-title.ts`: `AppTitleStrategy` makes every route title "`<page>` - Stargate ACTS" (`People`,
  the decoded name for `/people/:name`, `Page not found`); the person page replaces the route name by the canonical name
  once loaded ("Jane Roe - Stargate ACTS") or "Person not found".
- **Favicon.** `public/favicon.svg` (own rocket drawing, linked first) with a generated 32x32 `favicon.ico` fallback.
- **Motion.** Page fade/slide-in (`.acts-page`), timeline entries sliding in one after the other (`.acts-entry-in`,
  `--i` = index, capped at 8) and the skeleton pulse are defined in `styles.scss` inside
  `@media (prefers-reduced-motion: no-preference)`, so with reduced motion they do not exist; a `reduce` block also
  shortens anything that animates by itself. `core/motion.ts` (`prefersReducedMotion`, `scrollBehavior`) gives the
  shell the same answer for scripted scrolling to the top after a page change (`auto` instead of `smooth`).

## Accessibility

- **Landmarks and skip link.** Skip link first in the tab order (moves focus to `<main>`), `banner`, `nav`, one `main`.
- **Focus management.** After a page change (not on the first load, not for query-only filter changes) the shell scrolls
  to the top and focuses the page `h1` (`tabindex="-1"`), or `<main>`. Dialogs (Acting as, Add person) focus their first
  field and return focus to the button that opened them; Add duty and Rename focus their first field and return focus to
  their button on close or save; a failed submit focuses the first invalid field.
- **Live regions.** One persistent polite `role="status"` region in the shell (`core/status-announcer.ts`): the People
  and person pages announce "Loading people…", "Showing 3 of 4 people.", "Jane Roe: 3 duties on record." there instead of
  inserting `role="status"` elements that already hold text. Forms announce "Cannot add the duty: 2 fields need
  attention." on a rejected submit; field messages are announced by Material's always-present `aria-live="polite"`
  subscript wrapper; form-level errors use `role="alert"`; confirmations use the polite snackbar.
- **Names.** Icon-only controls have `aria-label`; the "Acting as" button's accessible name starts with its visible text
  (WCAG 2.5.3, found and fixed by the browser scan); blocked write buttons are `aria-disabled` with `aria-describedby`.
- **Automated scan, jsdom** (`src/app/a11y.spec.ts`, part of `npm test`): axe-core runs on the whole rendered app
  (shell, banner, live region) for the people list (also empty, loading, error), person detail with timeline, not found,
  rename form, add duty form (with banner and field errors), Add person and Acting as dialogs, the 404 page, blocked
  controls and the connection banner. It fails on any serious or critical violation. A sanity test checks that the scan
  reports a known-bad snippet. Color-contrast is switched off there (jsdom has no layout).
- **Automated scan, real browser** (`npm run a11y:browser`, `scripts/a11y-browser.mjs`): all axe rules including
  color-contrast at 1280 and 360 px on people list, person detail (with and without an actor name), rename, add duty (also
  with banner and errors), Add person dialog, Acting as dialog and 404. Run with `npm run start:with-mock` (the
  scans read the mock's seed data), `PLAYWRIGHT_CORE_DIR` pointing at a playwright-core install (default
  `%TEMP%\pw-scratch\node_modules\playwright-core`) and `BROWSER_PATH` at a Chromium browser (default: Edge). Result of
  the last run: 0 violations of any impact, so no theme token needed changing for contrast (the `--acts-*` pairs are
  documented as AA in `styles.scss`).
- **Keyboard-only walkthrough** (`npm run walkthrough`, `scripts/keyboard-walkthrough.mjs`; real browser, 1280 px,
  only Tab, Shift+Tab, Enter, Space, Escape and typing, no mouse). Last run: all 29 checks passed, no console errors.
  1. Tab: the first stop is "Skip to content"; Enter moves focus to `<main>`.
  2. Tab to **Add person** (no name set yet): it is `aria-disabled`; Enter and Space open nothing and send no request.
  3. Shift+Tab to **Acting as**; Enter opens the dialog with focus in the name field; type "Ada Lovelace"; Enter saves;
     focus returns to the toolbar button.
  4. Tab to **Add person**; Enter; focus is in Name; Enter on the empty field shows "required"; type "Walter Keys";
     Escape keeps the dialog and shows the discard hint; Enter creates the person and focus lands on the `h1`
     "Walter Keys" (`POST /Person`).
  5. Tab, Tab to **Add duty**; Space opens the form (focus in Rank); Escape on the untouched form closes it and focus
     returns to the button; Enter reopens; type "CPT", Tab, "Pilot", Tab (RETIRED quick pick), Tab (start date, today),
     Tab (reason) "First assignment", Tab to the submit button, Enter: the timeline shows Pilot, focus is back on
     **Add duty** (`POST /AstronautDuty`).
  6. Shift+Tab to **Rename**; Enter (focus in the selected name field); type "Walter Keyes"; Enter: the URL and `h1` are
     "Walter Keyes" (`PUT /Person/{name}`).
  7. Shift+Tab to **Back to People**; Enter: the renamed person is in the list.
- **Responsive.** Checked at 360, 768 and 1280 px (screenshots below): no horizontal overflow, the toolbar nav moves into a
  slide-over menu on handset widths, the filter bar and the add duty form stack to one column.

## Bundle budgets (`angular.json`, production build)

| Budget              | Warning | Error  | Current                              |
| ------------------- | ------- | ------ | ------------------------------------ |
| initial total       | 660 kB  | 750 kB | 632 kB (143.7 kB transferred)        |
| `main` bundle       | 85 kB   | 110 kB | 72 kB                                |
| `styles` bundle     | 16 kB   | 24 kB  | 12.4 kB                              |
| any component style | 4 kB    | 6 kB   | largest: `person-page.scss` (3.4 kB) |

The 4 kB / 6 kB component-style limits replace the earlier 6 / 8 kB workaround: the styles every page repeated
(visually hidden text, notice panels, skeleton bars, keyframes) moved to `styles.scss` / `StateNotice`. Lazy chunks are not
budgeted (person page about 31 kB, people page about 14 kB). The warning is about 5% above today's size, the error about
19%; raise them deliberately when a feature needs it.

## Screenshots

`docs/screenshots/`: `star-10-shell-desktop.png` (1280 px), `star-10-shell-phone.png` (390 px),
`star-11-list-desktop.png`, `star-11-list-phone.png`, `star-11-search-filter.png`, `star-11-error.png` (mock stopped),
`star-11-empty.png` (`MOCK_EMPTY=1`), `star-12-active-desktop.png` (John Doe), `star-12-retired-desktop.png` (Jane Roe),
`star-12-returned-desktop.png` (Ada Stone), `star-12-none-desktop.png` (Richard Roe), `star-12-notfound.png`,
`star-12-active-phone.png` (390 px). STAR-13: `star-13-add-person.png`, `star-13-add-person-duplicate.png` (409),
`star-13-rename.png`, `star-13-add-duty.png`, `star-13-reason-banner-backdated.png`, `star-13-reason-banner-return.png`,
`star-13-error.png` (rename to a taken name), `star-13-no-actor-hint.png` and `star-13-add-duty-phone.png` (390 px).
STAR-14 (run-and-look at 360, 768 and 1280 px): `star-14-people-{360,768,1280}.png`, `star-14-person-{360,768,1280}.png`
(Jane Roe), `star-14-add-duty-{360,768,1280}.png` (Jane Roe, with the "Returning from retirement" banner),
`star-14-offline.png` (mock stopped: banner + error state) and `star-14-notfound.png`.
STAR-18 (real API, no mock; `docs/screenshots/integration/`): `01-direct-link-skip-link.png`,
`02-people-from-live-api.png`, `03-conflict-error.png`, `04-new-person.png`, `05-backdated-needs-reason.png`,
`06-backdated-saved.png`, `07-return-from-retirement-needs-reason.png`, `08-return-from-retirement-saved.png` and
`09-case-only-rename.png`.
