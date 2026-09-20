export interface HistorySeo {
  title: string;
  hashtags: string[];
  description: string;
}

export interface HistoryEntry {
  id: string;
  videoTitle: string;
  channelName: string;
  createdAt: number;
  seo: HistorySeo;
  savedFilename?: string;
}

export const HISTORY_LIMIT = 10;
