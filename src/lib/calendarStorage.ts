export interface CalendarEvent {
  id:        string;
  date:      string; // YYYY-MM-DD
  title:     string;
  time?:     string;
  location?: string;
  location_url?: string;
}

// "2026년 5월 15일" 또는 "2026-05-15" → "2026-05-15", 실패 시 null
export function parseKoreanDate(s: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}
