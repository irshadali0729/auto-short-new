import type { HistoryEntry } from '@/app/types/history';
import { HISTORY_LIMIT } from '@/app/types/history';

const LOCAL_STORAGE_KEY = 'hadith_shorts_history';

export function readLocalHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addLocalHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const current = readLocalHistory();
  const updated = [entry, ...current].slice(0, HISTORY_LIMIT);
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — best-effort only
  }
  return updated;
}

export function deleteLocalHistoryEntry(id: string): HistoryEntry[] {
  const current = readLocalHistory();
  const updated = current.filter((entry) => entry.id !== id);
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable — best-effort only
  }
  return updated;
}
