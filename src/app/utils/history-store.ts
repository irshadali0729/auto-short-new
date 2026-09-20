import fs from 'fs';
import path from 'path';
import { HistoryEntry, HISTORY_LIMIT } from '@/app/types/history';

const HISTORY_FILE = path.join(process.cwd(), 'data', 'history.json');

export function readHistory(): HistoryEntry[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read history file:', err);
    return [];
  }
}

// Prepends the new entry and keeps only the most recent HISTORY_LIMIT
// entries, so the file never grows past the last 10 generated videos.
export function addHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const current = readHistory();
  const updated = [entry, ...current].slice(0, HISTORY_LIMIT);

  const dataDir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(updated, null, 2));

  return updated;
}

export function deleteHistoryEntry(id: string): HistoryEntry[] {
  const current = readHistory();
  const updated = current.filter((entry) => entry.id !== id);

  const dataDir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(updated, null, 2));

  return updated;
}
