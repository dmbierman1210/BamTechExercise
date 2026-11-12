// HTTP layer of the mock API: routing, JSON envelope, CORS. Rules live in store.mjs.
import { createServer } from 'node:http';
import { HttpProblem, createStore, validationFailed } from './store.mjs';

const MAX_BODY_BYTES = 1_000_000;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Actor',
  'Access-Control-Max-Age': '600',
};

function envelope(status, message, extra = {}) {
  return { success: status < 400, message, responseCode: status, ...extra };
}

function problemBody(problem) {
  return envelope(
    problem.status,
    problem.message,
    problem.errors ? { errors: problem.errors } : {},
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(validationFailed([{ field: 'body', message: 'The request body is too large.' }]));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseJson(text) {
  if (text.trim().length === 0) {
    throw validationFailed([{ field: 'body', message: 'The request body is required.' }]);
  }
  try {
    const value = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      throw new Error('not an object');
    return value;
  } catch {
    throw validationFailed([
      { field: 'body', message: 'The request body must be a valid JSON object.' },
    ]);
  }
}

/** Routes are matched case-insensitively, like ASP.NET Core. Returns the handler result or throws HttpProblem. */
async function route(store, req, url) {
  const segments = url.pathname.split('/').filter(Boolean);
  const [resource, rawName, ...rest] = segments;
  const method = req.method;
  const actor = req.headers['x-actor'];
  const kind = resource?.toLowerCase();
  const name = rawName === undefined ? undefined : safeDecode(rawName);

  if (rest.length > 0 || (kind !== 'person' && kind !== 'astronautduty')) {
    throw new HttpProblem(404, 'Not found.');
  }
  const methodNotAllowed = () => new HttpProblem(405, 'Method not allowed.');

  if (kind === 'person' && name === undefined) {
    if (method === 'GET') return { status: 200, payload: store.getPeople() };
    if (method === 'POST') {
      const result = store.createPerson(actor, parseJson(await readBody(req)));
      return { status: result.status, payload: { id: result.id } };
    }
    throw methodNotAllowed();
  }
  if (kind === 'person') {
    if (method === 'GET') return { status: 200, payload: store.getPerson(name) };
    if (method === 'PUT') {
      const result = store.renamePerson(actor, name, parseJson(await readBody(req)));
      return { status: result.status, payload: {} };
    }
    throw methodNotAllowed();
  }
  // astronautduty
  if (name === undefined) {
    if (method === 'POST') {
      const result = store.createDuty(actor, parseJson(await readBody(req)));
      return { status: result.status, payload: { id: result.id } };
    }
    throw methodNotAllowed();
  }
  if (method === 'GET') return { status: 200, payload: store.getDuties(name) };
  throw methodNotAllowed();
}

function safeDecode(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Creates (does not start) the mock server.
 * @param {{ empty?: boolean, delayMs?: number, today?: () => string }} options
 */
export function createMockServer({ empty = false, delayMs = 0, today } = {}) {
  const store = createStore({ empty, today });

  return createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { ...CORS, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }

    try {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      const url = new URL(req.url ?? '/', 'http://localhost');
      const { status, payload } = await route(store, req, url);
      send(status, envelope(status, 'Successful', payload));
    } catch (error) {
      if (error instanceof HttpProblem) {
        send(error.status, problemBody(error));
      } else {
        console.error(error);
        send(500, envelope(500, 'An unexpected error occurred.'));
      }
    }
  });
}
