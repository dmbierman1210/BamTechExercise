import type { ParamMap, Params } from '@angular/router';
import type { AstronautStatus, PersonAstronaut } from '../api/models';

export type StatusFilter = 'all' | 'none' | 'active' | 'retired';
export type SortOrder = 'name-asc' | 'name-desc';

/** List state; it lives in the URL as the query params `q`, `status` and `sort` (defaults are omitted). */
export interface ListFilters {
  q: string;
  status: StatusFilter;
  sort: SortOrder;
}

export const DEFAULT_FILTERS: ListFilters = { q: '', status: 'all', sort: 'name-asc' };

export const STATUS_FILTERS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'retired', label: 'Retired' },
  { value: 'none', label: 'Not an astronaut' },
];

export const SORT_ORDERS: readonly { value: SortOrder; label: string }[] = [
  { value: 'name-asc', label: 'Name (A to Z)' },
  { value: 'name-desc', label: 'Name (Z to A)' },
];

/** Badge text and icon; the label always carries the meaning so color is never the only signal. */
export const STATUS_BADGE: Record<AstronautStatus, { label: string; icon: string }> = {
  None: { label: 'Not an astronaut', icon: 'person_off' },
  Active: { label: 'Active', icon: 'rocket_launch' },
  Retired: { label: 'Retired', icon: 'military_tech' },
};

export function parseFilters(params: ParamMap): ListFilters {
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    q: params.get('q') ?? DEFAULT_FILTERS.q,
    status: STATUS_FILTERS.some((s) => s.value === status)
      ? (status as StatusFilter)
      : DEFAULT_FILTERS.status,
    sort: sort === 'name-desc' ? 'name-desc' : DEFAULT_FILTERS.sort,
  };
}

/** Query params for the filters; null removes a param from the URL when it is merged. */
export function toQueryParams(filters: ListFilters): Params {
  return {
    q: filters.q.trim() === '' ? null : filters.q,
    status: filters.status === DEFAULT_FILTERS.status ? null : filters.status,
    sort: filters.sort === DEFAULT_FILTERS.sort ? null : filters.sort,
  };
}

export function hasActiveFilters(filters: ListFilters): boolean {
  return filters.q.trim() !== '' || filters.status !== 'all';
}

export function filterAndSort(
  people: readonly PersonAstronaut[],
  filters: ListFilters,
): PersonAstronaut[] {
  const needle = filters.q.trim().toLocaleLowerCase();
  const direction = filters.sort === 'name-desc' ? -1 : 1;
  return people
    .filter((p) => needle === '' || p.name.toLocaleLowerCase().includes(needle))
    .filter((p) => filters.status === 'all' || p.astronautStatus.toLowerCase() === filters.status)
    .sort(
      (a, b) =>
        direction * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
        a.personId - b.personId,
    );
}
