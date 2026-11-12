import type { AstronautDuty } from '../api/models';

export type DutyKind = 'current' | 'retired' | 'past';

export interface TimelineEntry {
  duty: AstronautDuty;
  kind: DutyKind;
  /** Text label for the entry; `null` for a past duty. Never rely on color alone. */
  label: string | null;
  icon: string;
}

export const isRetiredDuty = (duty: AstronautDuty): boolean =>
  duty.dutyTitle.trim().toLowerCase() === 'retired';

const isOpen = (duty: AstronautDuty): boolean => !duty.dutyEndDate;

/** Newest start date first; the API already sorts this way, the sort keeps the page right if it ever does not. */
export function toTimeline(duties: readonly AstronautDuty[]): TimelineEntry[] {
  return [...duties]
    .sort((a, b) => b.dutyStartDate.localeCompare(a.dutyStartDate))
    .map((duty) => {
      if (isRetiredDuty(duty)) {
        return { duty, kind: 'retired', label: 'Retired', icon: 'military_tech' };
      }
      if (isOpen(duty)) {
        return { duty, kind: 'current', label: 'Current', icon: 'rocket_launch' };
      }
      return { duty, kind: 'past', label: null, icon: 'radio_button_unchecked' };
    });
}
