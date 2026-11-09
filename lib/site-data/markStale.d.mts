export const MAX_DAYS: number;
export function ageDays(date: string | undefined, today: string): number | null;
export function isStale(row: { date?: string }, today: string, maxDays?: number): boolean;
export function markStale<T extends { date?: string }>(rows: T[], today: string, maxDays?: number): T[];
export function numericLeaks(rows: { date?: string; id?: string }[], today: string, maxDays?: number): string[];
