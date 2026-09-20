'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, History as HistoryIcon, ChevronDown, Copy, Check, Loader2, Inbox } from 'lucide-react';
import { useFocusTrap } from '@/app/utils/useFocusTrap';
import { readLocalHistory } from '@/app/utils/history-client';
import type { HistoryEntry } from '@/app/types/history';
import type { HistoryStorageMode } from '@/app/components/SettingsModal';

export interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  storageMode: HistoryStorageMode;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable — nothing else we can do here
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-white border border-hairline text-ink hover:bg-surface-soft transition-colors shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export default function HistoryModal({ isOpen, onClose, storageMode }: HistoryModalProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, modalContainerRef, closeBtnRef);

  useEffect(() => {
    if (!isOpen) return;
    setExpandedId(null);
    setLoadError('');

    if (storageMode === 'local') {
      setEntries(readLocalHistory());
      return;
    }

    setIsLoading(true);
    fetch('/api/history')
      .then((res) => res.json())
      .then((data) => setEntries(Array.isArray(data.history) ? data.history : []))
      .catch(() => setLoadError('Failed to load history.'))
      .finally(() => setIsLoading(false));
  }, [isOpen, storageMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={modalContainerRef}
        className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-hairline bg-white shadow-airbnb overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200 my-auto"
      >
        <div className="p-4 sm:p-5 border-b border-hairline-soft bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-full bg-[#fff0f2] text-rausch shrink-0">
              <HistoryIcon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="history-modal-title" className="text-base sm:text-lg font-bold text-ink tracking-tight">
                Generation History
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Last {entries.length} compiled video{entries.length === 1 ? '' : 's'} ·{' '}
                {storageMode === 'local' ? 'Browser storage' : 'Server file'}
              </p>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-hairline text-ink hover:bg-surface-soft transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink shrink-0"
            aria-label="Close history dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-3 sm:p-5 bg-white">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs font-semibold">Loading history…</span>
            </div>
          ) : loadError ? (
            <div className="py-16 text-center text-xs font-semibold text-red-600">{loadError}</div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center max-w-sm mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-surface-soft border border-hairline flex items-center justify-center text-muted mb-4 shadow-sm">
                <Inbox className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-ink">No history yet</h3>
              <p className="text-xs text-muted mt-1">
                Generated videos will show up here (title, channel, and SEO metadata you can copy) once you compile one.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {entries.map((entry) => {
                const isExpanded = expandedId === entry.id;
                const hashtagsText = entry.seo.hashtags.join(' ');
                return (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-hairline overflow-hidden bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="w-full flex items-center justify-between gap-3 p-3.5 text-left hover:bg-surface-soft transition-colors"
                      aria-expanded={isExpanded}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink truncate">{entry.videoTitle}</p>
                        <p className="text-xs text-muted truncate mt-0.5">
                          {entry.channelName} · {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-muted shrink-0 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-hairline-soft bg-surface-soft/40 animate-in fade-in duration-150">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                              SEO Title
                            </span>
                            <CopyButton text={entry.seo.title} label="Copy" />
                          </div>
                          <p className="text-sm font-semibold text-ink bg-white border border-hairline rounded-lg p-2.5">
                            {entry.seo.title}
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                              Hashtags
                            </span>
                            <CopyButton text={hashtagsText} label="Copy" />
                          </div>
                          <div className="flex flex-wrap gap-1.5 bg-white border border-hairline rounded-lg p-2.5">
                            {entry.seo.hashtags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fff0f2] text-rausch border border-[#ffd1da]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                              Description
                            </span>
                            <CopyButton text={entry.seo.description} label="Copy" />
                          </div>
                          <p className="text-xs text-ink whitespace-pre-wrap bg-white border border-hairline rounded-lg p-2.5 leading-relaxed">
                            {entry.seo.description}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
