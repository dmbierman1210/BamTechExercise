// Seed data: the people and duties from the examples in docs/api/openapi.yaml.
// Jane Roe's timeline is built so it matches her list entry (COL / RETIRED, career 1998-03-02 to 2019-12-31).

export function createSeed({ empty = false } = {}) {
  if (empty) {
    return { people: [], nextPersonId: 1, nextDutyId: 1 };
  }
  return {
    people: [
      {
        personId: 1,
        name: 'John Doe',
        duties: [
          duty(1, 1, '1LT', 'Mission Specialist', '2020-01-15', null),
          duty(
            2,
            1,
            '1LT',
            'Pilot',
            '2021-09-10',
            'Start date was recorded wrongly and corrected.',
          ),
          duty(3, 1, 'CPT', 'Commander', '2023-05-01', null),
        ],
      },
      {
        personId: 2,
        name: 'Jane Roe',
        duties: [
          duty(4, 2, 'MAJ', 'Pilot', '1998-03-02', null),
          duty(5, 2, 'COL', 'Commander', '2009-06-15', null),
          duty(6, 2, 'COL', 'RETIRED', '2020-01-01', null),
        ],
      },
      { personId: 3, name: 'Richard Roe', duties: [] },
    ],
    nextPersonId: 4,
    nextDutyId: 7,
  };
}

function duty(id, personId, rank, dutyTitle, dutyStartDate, reason) {
  // dutyEndDate is derived from the neighbouring duty when the store is built.
  return { id, personId, rank, dutyTitle, dutyStartDate, dutyEndDate: null, reason };
}
