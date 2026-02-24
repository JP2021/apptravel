/**
 * Garante data no formato AAAA-MM-DD, evitando que ISO com timezone
 * (ex: 2026-02-28T00:00:00.000Z) seja interpretada e vire dia anterior.
 */
export function normalizeDateOnly(value: string | undefined): string {
  if (value == null || typeof value !== 'string') return '';
  const s = value.trim();
  if (!s) return '';
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (s.includes('T')) return s.slice(0, 10);
  return s;
}
