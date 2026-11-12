// In-memory ACTS store and the contract's rules (docs/api/openapi.yaml). No I/O here.
import { createSeed } from './seed.mjs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export const MAX_NAME = 200;
export const MAX_ACTOR = 100;
export const MAX_TEXT = 100;
export const MAX_REASON = 500;

export class HttpProblem extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function validationFailed(errors) {
  return new HttpProblem(400, 'Validation failed.', errors);
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const isRetired = (duty) => duty.dutyTitle.toLowerCase() === 'retired';
const byStartAsc = (a, b) => a.dutyStartDate.localeCompare(b.dutyStartDate);

/** Keeps the timeline gap-free: each duty ends the day before the next one starts; the latest has no end. */
function rechain(person) {
  person.duties.sort(byStartAsc);
  person.duties.forEach((d, i) => {
    const next = person.duties[i + 1];
    d.dutyEndDate = next ? addDays(next.dutyStartDate, -1) : null;
  });
}

function summarize(person) {
  const sorted = [...person.duties].sort(byStartAsc);
  const latest = sorted.at(-1);
  const retired = latest ? isRetired(latest) : false;
  return {
    personId: person.personId,
    name: person.name,
    currentRank: latest?.rank ?? null,
    currentDutyTitle: latest?.dutyTitle ?? null,
    careerStartDate: sorted[0]?.dutyStartDate ?? null,
    careerEndDate: retired ? addDays(latest.dutyStartDate, -1) : null,
    astronautStatus: latest ? (retired ? 'Retired' : 'Active') : 'None',
  };
}

function checkActor(actorHeader) {
  const actor = typeof actorHeader === 'string' ? actorHeader.trim() : '';
  if (actor.length === 0) {
    return { field: 'X-Actor', message: 'The X-Actor header is required.' };
  }
  if (actor.length > MAX_ACTOR) {
    return {
      field: 'X-Actor',
      message: `The X-Actor header must be at most ${MAX_ACTOR} characters.`,
    };
  }
  return null;
}

function checkText(value, field, label, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length === 0) {
    return { error: { field, message: `The ${label} is required.` } };
  }
  if (text.length > max) {
    return { error: { field, message: `The ${label} must be at most ${max} characters.` } };
  }
  return { value: text };
}

export function createStore({
  empty = false,
  today = () => new Date().toISOString().slice(0, 10),
} = {}) {
  const state = createSeed({ empty });
  state.people.forEach(rechain);

  const find = (name) =>
    typeof name === 'string' ? state.people.find((p) => sameName(p.name, name)) : undefined;
  const notFound = () => new HttpProblem(404, 'Person not found.');

  return {
    getPeople() {
      return { people: state.people.map(summarize) };
    },

    getPerson(name) {
      const person = find(name);
      if (!person) throw notFound();
      return { person: summarize(person) };
    },

    getDuties(name) {
      const person = find(name);
      if (!person) throw notFound();
      const duties = [...person.duties].sort((a, b) => byStartAsc(b, a)).map((d) => ({ ...d }));
      return { person: summarize(person), astronautDuties: duties };
    },

    createPerson(actor, body) {
      const errors = [];
      const actorError = checkActor(actor);
      if (actorError) errors.push(actorError);
      const name = checkText(body?.name, 'name', 'name', MAX_NAME);
      if (name.error) errors.push(name.error);
      if (errors.length) throw validationFailed(errors);
      if (find(name.value)) {
        throw new HttpProblem(409, 'A person with this name already exists.');
      }
      const person = { personId: state.nextPersonId++, name: name.value, duties: [] };
      state.people.push(person);
      return { status: 201, id: person.personId };
    },

    renamePerson(actor, currentName, body) {
      const errors = [];
      const actorError = checkActor(actor);
      if (actorError) errors.push(actorError);
      const newName = checkText(body?.newName, 'newName', 'new name', MAX_NAME);
      if (newName.error) errors.push(newName.error);
      if (errors.length) throw validationFailed(errors);
      const person = find(currentName);
      if (!person) throw notFound();
      const other = find(newName.value);
      if (other && other !== person) {
        throw new HttpProblem(409, 'A person with this name already exists.');
      }
      person.name = newName.value;
      return { status: 200 };
    },

    createDuty(actor, body) {
      const errors = [];
      const actorError = checkActor(actor);
      if (actorError) errors.push(actorError);
      const name = checkText(body?.name, 'name', 'name', MAX_NAME);
      const rank = checkText(body?.rank, 'rank', 'rank', MAX_TEXT);
      const title = checkText(body?.dutyTitle, 'dutyTitle', 'duty title', MAX_TEXT);
      for (const part of [name, rank, title]) if (part.error) errors.push(part.error);

      const start = body?.dutyStartDate;
      const startValid = isValidDate(start);
      if (!startValid) {
        errors.push({
          field: 'dutyStartDate',
          message: 'The duty start date must be a date in the form yyyy-MM-dd.',
        });
      }

      const rawReason = body?.reason;
      let reason = null;
      if (rawReason !== undefined && rawReason !== null) {
        if (typeof rawReason !== 'string') {
          errors.push({ field: 'reason', message: 'The reason must be text.' });
        } else if (rawReason.trim().length > MAX_REASON) {
          errors.push({
            field: 'reason',
            message: `The reason must be at most ${MAX_REASON} characters.`,
          });
        } else {
          reason = rawReason.trim() || null;
        }
      }
      const reasonOk = !errors.some((e) => e.field === 'reason');
      if (startValid && start > today() && reasonOk && !reason) {
        errors.push({
          field: 'reason',
          message: 'A reason is required when the duty starts in the future.',
        });
      }
      if (errors.length) throw validationFailed(errors);

      const person = find(name.value);
      if (!person) throw notFound();

      if (person.duties.some((d) => d.dutyStartDate === start)) {
        throw new HttpProblem(409, 'The person already has a duty starting on this date.');
      }

      const latest = [...person.duties].sort(byStartAsc).at(-1);
      if (latest && !reason) {
        if (start < latest.dutyStartDate) {
          throw validationFailed([
            {
              field: 'reason',
              message: "A reason is required when the duty starts before the person's latest duty.",
            },
          ]);
        }
        if (isRetired(latest)) {
          throw validationFailed([
            {
              field: 'reason',
              message: 'A reason is required to add a duty after the person has retired.',
            },
          ]);
        }
      }

      const created = {
        id: state.nextDutyId++,
        personId: person.personId,
        rank: rank.value,
        dutyTitle: title.value,
        dutyStartDate: start,
        dutyEndDate: null,
        reason,
      };
      person.duties.push(created);
      rechain(person);
      return { status: 201, id: created.id };
    },
  };
}
