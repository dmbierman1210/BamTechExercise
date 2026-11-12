import { ParamMap, convertToParamMap } from '@angular/router';
import type { PersonAstronaut } from '../api/models';
import {
  DEFAULT_FILTERS,
  filterAndSort,
  hasActiveFilters,
  parseFilters,
  toQueryParams,
} from './people-list';

function person(
  personId: number,
  name: string,
  astronautStatus: PersonAstronaut['astronautStatus'],
) {
  return { personId, name, astronautStatus } as PersonAstronaut;
}

describe('people-list helpers', () => {
  const people = [
    person(3, 'bob', 'None'),
    person(2, 'Alice', 'Active'),
    person(1, 'Émile', 'Retired'),
    person(4, 'alice', 'Retired'),
  ];

  it('sorts by name ignoring case, with ties broken by id', () => {
    const asc = filterAndSort(people, DEFAULT_FILTERS).map((p) => p.personId);
    expect(asc).toEqual([2, 4, 3, 1]);
    const desc = filterAndSort(people, { ...DEFAULT_FILTERS, sort: 'name-desc' }).map(
      (p) => p.personId,
    );
    expect(desc).toEqual([1, 3, 2, 4]);
  });

  it('does not mutate the input', () => {
    const copy = [...people];
    filterAndSort(people, DEFAULT_FILTERS);
    expect(people).toEqual(copy);
  });

  it('filters by status and by trimmed, case-insensitive text', () => {
    expect(
      filterAndSort(people, { ...DEFAULT_FILTERS, status: 'retired', q: ' ALI ' }).map(
        (p) => p.personId,
      ),
    ).toEqual([4]);
  });

  it('round-trips query params and omits defaults', () => {
    const params: ParamMap = convertToParamMap({ q: 'x', status: 'active', sort: 'name-desc' });
    const filters = parseFilters(params);
    expect(filters).toEqual({ q: 'x', status: 'active', sort: 'name-desc' });
    expect(toQueryParams(DEFAULT_FILTERS)).toEqual({ q: null, status: null, sort: null });
    expect(hasActiveFilters(filters)).toBe(true);
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });
});
