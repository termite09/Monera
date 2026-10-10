function validDate(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
}

/**
 * A statement date as "YYYY-MM-DD", or null. Accepts ISO ("2024-06-10 14:02:11"),
 * European ("10/06/2024", "10-06-2024") and, when the European reading is
 * impossible, US ("06/30/2024") formats.
 */
export function parseStatementDate(dateStr: string): string | null {
  if (!dateStr) return null;

  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const eu = dateStr.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (eu && validDate(Number(eu[3]), Number(eu[2]), Number(eu[1]))) {
    return `${eu[3]}-${eu[2]}-${eu[1]}`;
  }

  const us = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (us && validDate(Number(us[3]), Number(us[1]), Number(us[2]))) {
    return `${us[3]}-${us[1]}-${us[2]}`;
  }

  return null;
}
