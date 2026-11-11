import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createMockServer } from './app.mjs';

const TODAY = '2026-06-15';

async function start(options = {}) {
  const server = createMockServer({ today: () => TODAY, ...options });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { body, actor = 'tester', raw } = {}) => {
    const headers = {};
    if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
    if (actor !== null) headers['X-Actor'] = actor;
    const res = await fetch(base + path, {
      method,
      headers,
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
  return { server, base, call };
}

describe('mock API (seeded)', () => {
  let ctx;
  before(async () => {
    ctx = await start();
  });
  after(() => ctx.server.close());

  it('lists the three seeded people with derived summaries', async () => {
    const { status, body } = await ctx.call('GET', '/Person');
    assert.equal(status, 200);
    assert.deepEqual(
      body.people.map((p) => [p.name, p.astronautStatus]),
      [
        ['John Doe', 'Active'],
        ['Jane Roe', 'Retired'],
        ['Richard Roe', 'None'],
      ],
    );
    const jane = body.people[1];
    assert.equal(jane.currentRank, 'COL');
    assert.equal(jane.currentDutyTitle, 'RETIRED');
    assert.equal(jane.careerStartDate, '1998-03-02');
    assert.equal(jane.careerEndDate, '2019-12-31');
    assert.deepEqual(body.people[2], {
      personId: 3,
      name: 'Richard Roe',
      currentRank: null,
      currentDutyTitle: null,
      careerStartDate: null,
      careerEndDate: null,
      astronautStatus: 'None',
    });
  });

  it('returns duties newest first and matches names case-insensitively', async () => {
    const { status, body } = await ctx.call('GET', '/AstronautDuty/john%20DOE');
    assert.equal(status, 200);
    assert.deepEqual(
      body.astronautDuties.map((d) => d.id),
      [3, 2, 1],
    );
    assert.equal(body.astronautDuties[0].dutyEndDate, null);
    assert.equal(body.astronautDuties[1].dutyEndDate, '2023-04-30');
    assert.equal(body.astronautDuties[2].dutyEndDate, '2021-09-09');
    assert.equal(body.person.careerStartDate, '2020-01-15');
  });

  it('returns an empty duty list for a person with no duties', async () => {
    const { body } = await ctx.call('GET', '/AstronautDuty/Richard%20Roe');
    assert.deepEqual(body.astronautDuties, []);
  });

  it('404 for an unknown name on every route that takes a name', async () => {
    for (const [method, path, payload] of [
      ['GET', '/Person/Nobody', undefined],
      ['GET', '/AstronautDuty/Nobody', undefined],
      ['PUT', '/Person/Nobody', { newName: 'X' }],
      [
        'POST',
        '/AstronautDuty',
        { name: 'Nobody', rank: 'CPT', dutyTitle: 'Pilot', dutyStartDate: '2020-01-01' },
      ],
    ]) {
      const { status, body } = await ctx.call(method, path, { body: payload });
      assert.equal(status, 404, `${method} ${path}`);
      assert.deepEqual(body, { success: false, message: 'Person not found.', responseCode: 404 });
    }
  });

  it('400 when X-Actor is missing or blank on writes', async () => {
    for (const actor of [null, '   ']) {
      const { status, body } = await ctx.call('POST', '/Person', { body: { name: 'Zed' }, actor });
      assert.equal(status, 400);
      assert.deepEqual(body, {
        success: false,
        message: 'Validation failed.',
        responseCode: 400,
        errors: [{ field: 'X-Actor', message: 'The X-Actor header is required.' }],
      });
    }
    const put = await ctx.call('PUT', '/Person/John%20Doe', {
      body: { newName: 'J' },
      actor: null,
    });
    assert.equal(put.status, 400);
    const duty = await ctx.call('POST', '/AstronautDuty', {
      body: { name: 'John Doe', rank: 'CPT', dutyTitle: 'Pilot', dutyStartDate: '2024-01-01' },
      actor: null,
    });
    assert.equal(duty.status, 400);
    assert.equal(duty.body.errors[0].field, 'X-Actor');
  });

  it('400 for an invalid name and for a malformed body', async () => {
    const blank = await ctx.call('POST', '/Person', { body: { name: '   ' } });
    assert.equal(blank.status, 400);
    assert.deepEqual(blank.body.errors, [{ field: 'name', message: 'The name is required.' }]);
    const long = await ctx.call('POST', '/Person', { body: { name: 'x'.repeat(201) } });
    assert.deepEqual(long.body.errors, [
      { field: 'name', message: 'The name must be at most 200 characters.' },
    ]);
    const bad = await ctx.call('POST', '/Person', { raw: '{not json' });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.errors[0].field, 'body');
  });

  it('answers the CORS preflight including X-Actor', async () => {
    const res = await fetch(`${ctx.base}/Person`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:4200', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.match(res.headers.get('access-control-allow-headers'), /X-Actor/);
  });

  it('every response carries the envelope, even for unknown routes', async () => {
    const { status, body } = await ctx.call('GET', '/nope');
    assert.equal(status, 404);
    assert.equal(body.success, false);
    assert.equal(body.responseCode, 404);
  });
});

describe('mock API (writes)', () => {
  let ctx;
  before(async () => {
    ctx = await start();
  });
  after(() => ctx.server.close());

  it('creates a person, 409 on a case-insensitive duplicate', async () => {
    const created = await ctx.call('POST', '/Person', { body: { name: '  Ann Lee ' } });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body, {
      success: true,
      message: 'Successful',
      responseCode: 201,
      id: 4,
    });
    const dup = await ctx.call('POST', '/Person', { body: { name: 'ann lee' } });
    assert.equal(dup.status, 409);
    assert.deepEqual(dup.body, {
      success: false,
      message: 'A person with this name already exists.',
      responseCode: 409,
    });
    const got = await ctx.call('GET', '/Person/Ann%20Lee');
    assert.equal(got.body.person.name, 'Ann Lee');
    assert.equal(got.body.person.astronautStatus, 'None');
  });

  it('renames: 409 for another person, allows a case change of the own name, keeps duties', async () => {
    const taken = await ctx.call('PUT', '/Person/Richard%20Roe', { body: { newName: 'john doe' } });
    assert.equal(taken.status, 409);
    const caseChange = await ctx.call('PUT', '/Person/Richard%20Roe', {
      body: { newName: 'RICHARD ROE' },
    });
    assert.equal(caseChange.status, 200);
    const renamed = await ctx.call('PUT', '/Person/Jane%20Roe', { body: { newName: 'Janet Roe' } });
    assert.equal(renamed.status, 200);
    const duties = await ctx.call('GET', '/AstronautDuty/Janet%20Roe');
    assert.equal(duties.body.astronautDuties.length, 3);
    assert.equal((await ctx.call('GET', '/Person/Jane%20Roe')).status, 404);
  });

  it('duty: 409 on the same start date, 400 reason rules, chaining and status', async () => {
    const duty = (extra) => ({
      body: {
        name: 'John Doe',
        rank: 'CPT',
        dutyTitle: 'Pilot',
        dutyStartDate: '2024-01-01',
        ...extra,
      },
    });
    const same = await ctx.call('POST', '/AstronautDuty', duty({ dutyStartDate: '2023-05-01' }));
    assert.equal(same.status, 409);

    const future = await ctx.call('POST', '/AstronautDuty', duty({ dutyStartDate: '2027-01-01' }));
    assert.equal(future.status, 400);
    assert.deepEqual(future.body.errors, [
      { field: 'reason', message: 'A reason is required when the duty starts in the future.' },
    ]);

    const back = await ctx.call('POST', '/AstronautDuty', duty({ dutyStartDate: '2022-02-02' }));
    assert.equal(back.status, 400);
    assert.equal(back.body.errors[0].field, 'reason');

    const backOk = await ctx.call(
      'POST',
      '/AstronautDuty',
      duty({ dutyStartDate: '2022-02-02', reason: ' Correction ' }),
    );
    assert.equal(backOk.status, 201);
    assert.equal(backOk.body.id, 7);
    const timeline = (await ctx.call('GET', '/AstronautDuty/John%20Doe')).body.astronautDuties;
    const inserted = timeline.find((d) => d.id === 7);
    assert.equal(inserted.reason, 'Correction');
    assert.equal(inserted.dutyEndDate, '2023-04-30');
    assert.equal(timeline.find((d) => d.id === 2).dutyEndDate, '2022-02-01');
  });

  it('duty: retiring, return from retirement needs a reason, RETIRED is case-insensitive', async () => {
    const retire = await ctx.call('POST', '/AstronautDuty', {
      body: { name: 'Ann Lee', rank: 'CPT', dutyTitle: 'Pilot', dutyStartDate: '2020-01-01' },
    });
    assert.equal(retire.status, 201);
    const done = await ctx.call('POST', '/AstronautDuty', {
      body: { name: 'Ann Lee', rank: 'CPT', dutyTitle: 'retired', dutyStartDate: '2021-01-01' },
    });
    assert.equal(done.status, 201);
    const person = (await ctx.call('GET', '/Person/Ann%20Lee')).body.person;
    assert.equal(person.astronautStatus, 'Retired');
    assert.equal(person.careerEndDate, '2020-12-31');

    const comeback = await ctx.call('POST', '/AstronautDuty', {
      body: { name: 'Ann Lee', rank: 'CPT', dutyTitle: 'Pilot', dutyStartDate: '2022-01-01' },
    });
    assert.equal(comeback.status, 400);
    assert.deepEqual(comeback.body.errors, [
      {
        field: 'reason',
        message: 'A reason is required to add a duty after the person has retired.',
      },
    ]);
    const ok = await ctx.call('POST', '/AstronautDuty', {
      body: {
        name: 'Ann Lee',
        rank: 'CPT',
        dutyTitle: 'Pilot',
        dutyStartDate: '2022-01-01',
        reason: 'Recalled.',
      },
    });
    assert.equal(ok.status, 201);
    assert.equal(
      (await ctx.call('GET', '/Person/Ann%20Lee')).body.person.astronautStatus,
      'Active',
    );
  });

  it('duty: field errors for missing fields and a bad date', async () => {
    const { status, body } = await ctx.call('POST', '/AstronautDuty', {
      body: { name: 'John Doe', dutyTitle: 'Pilot', dutyStartDate: '2020-02-30' },
    });
    assert.equal(status, 400);
    assert.deepEqual(
      body.errors.map((e) => e.field),
      ['rank', 'dutyStartDate'],
    );
  });
});

describe('mock API (MOCK_EMPTY)', () => {
  it('starts with no people', async () => {
    const ctx = await start({ empty: true });
    try {
      const { status, body } = await ctx.call('GET', '/Person');
      assert.equal(status, 200);
      assert.deepEqual(body.people, []);
      const created = await ctx.call('POST', '/Person', { body: { name: 'First' } });
      assert.equal(created.body.id, 1);
    } finally {
      ctx.server.close();
    }
  });
});
