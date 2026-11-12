import type { AstronautDuty } from '../api/models';
import { latestDuty, reasonRequirement } from './duty-reason';

const duty = (over: Partial<AstronautDuty>): AstronautDuty => ({
  id: 1,
  personId: 1,
  rank: '1LT',
  dutyTitle: 'Pilot',
  dutyStartDate: '2020-01-15',
  dutyEndDate: null,
  reason: null,
  ...over,
});

const TODAY = '2026-11-11';
const ACTIVE = [
  duty({ id: 3, dutyStartDate: '2023-05-01' }),
  duty({ id: 2, dutyStartDate: '2021-09-10', dutyEndDate: '2023-04-30' }),
];
const RETIRED = [
  duty({ id: 2, dutyTitle: 'retired', dutyStartDate: '2020-01-01' }),
  duty({ id: 1, dutyStartDate: '2010-01-01', dutyEndDate: '2019-12-31' }),
];

describe('reasonRequirement (the contract: backdated, future or after retirement needs a reason)', () => {
  it('needs no reason for a normal, later start date', () => {
    expect(reasonRequirement('2024-01-01', ACTIVE, TODAY)).toBeNull();
    expect(reasonRequirement(TODAY, ACTIVE, TODAY)).toBeNull();
  });

  it('needs no reason for the first duty of a person without history', () => {
    expect(reasonRequirement('2024-01-01', [], TODAY)).toBeNull();
  });

  it('needs a reason before the latest duty start: "Correcting an earlier date"', () => {
    const need = reasonRequirement('2022-01-01', ACTIVE, TODAY);
    expect(need?.kind).toBe('correction');
    expect(need?.title).toBe('Correcting an earlier date');
    expect(need?.message).toContain('May 1, 2023');
  });

  it('judges the latest duty by start date, whatever the order of the list', () => {
    expect(latestDuty(ACTIVE)?.id).toBe(3);
    expect(latestDuty([...ACTIVE].reverse())?.id).toBe(3);
    expect(latestDuty([])).toBeNull();
  });

  it('needs a reason when the latest duty is RETIRED (any case): "Returning from retirement"', () => {
    const need = reasonRequirement('2021-06-01', RETIRED, TODAY);
    expect(need?.kind).toBe('return');
    expect(need?.title).toBe('Returning from retirement');
  });

  it('needs a reason after today (UTC): "Future-dated entry"', () => {
    const need = reasonRequirement('2026-11-12', ACTIVE, TODAY);
    expect(need?.kind).toBe('future');
    expect(need?.title).toBe('Future-dated entry');
    expect(reasonRequirement('2026-11-12', [], TODAY)?.kind).toBe('future');
  });

  it('explains a backdated entry first, then a return, then a future start', () => {
    expect(reasonRequirement('2010-01-01', RETIRED, TODAY)?.kind).toBe('correction');
    expect(reasonRequirement('2027-01-01', RETIRED, TODAY)?.kind).toBe('return');
  });

  it('ignores an empty or unfinished date', () => {
    expect(reasonRequirement('', RETIRED, TODAY)).toBeNull();
    expect(reasonRequirement('2026-1', RETIRED, TODAY)).toBeNull();
  });
});
