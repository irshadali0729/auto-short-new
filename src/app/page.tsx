'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SettingsModal, {
  MediaSettings,
  DEFAULT_MEDIA_SETTINGS,
} from '@/app/components/SettingsModal';
import ReplaceImageModal from '@/app/components/ReplaceImageModal';
import DuaEditModal from '@/app/components/DuaEditModal';
import HistoryModal from '@/app/components/HistoryModal';
import TopNav from '@/app/components/dashboard/TopNav';
import StepIndicator, { type DashboardStep } from '@/app/components/dashboard/StepIndicator';
import InputPanel, { isYoutubeUrl, SAMPLE_TRANSCRIPT } from '@/app/components/dashboard/InputPanel';
import Storyboard from '@/app/components/dashboard/Storyboard';
import PreviewPanel, { type PreviewTab } from '@/app/components/dashboard/PreviewPanel';
import StickyActionBar from '@/app/components/dashboard/StickyActionBar';
import Toaster from '@/app/components/dashboard/Toaster';
import type { SeoMetadata, SeoState } from '@/app/components/dashboard/ExportPanel';
import { useToasts } from '@/app/hooks/useToasts';
import { useTheme } from '@/app/hooks/useTheme';
import { useVideoGeneration } from '@/app/hooks/useVideoGeneration';
import { clearDraft, loadDraft, useDraftAutosave } from '@/app/hooks/useDraftAutosave';
import { isRemoteUrl } from '@/app/utils/media-url';
import { rescaleSceneDurations } from '@/app/utils/scene-timing';
import { addLocalHistoryEntry } from '@/app/utils/history-client';
import {
  detectTranscriptLanguage,
  TRANSLATION_TARGET_LABELS,
  type TranscriptLanguage,
  type TranslationTarget,
} from '@/app/utils/transcript-language';
import type { Scene, TranscriptSegment, DuaInfo } from '@/app/types/scene';
import type { HistoryEntry } from '@/app/types/history';

export type { Scene, TranscriptSegment, GraphicBeat, CaptionSlice } from '@/app/types/scene';

const SETTINGS_STORAGE_KEY = 'hadith_shorts_media_settings';
const DEFAULT_VIDEO_FILENAME = 'auto_short.mp4';

function newSceneId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `scene_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function withIds(scenes: Scene[]): Scene[] {
  return scenes.map((s) => (s.id ? s : { ...s, id: newSceneId() }));
}

function withoutKey(set: Set<string>, key: string): Set<string> {
  if (!set.has(key)) return set;
  const next = new Set(set);
  next.delete(key);
  return next;
}

// Converts YouTube caption segments (which overlap on screen) into real
// spoken-time segments: each segment ends when the next one starts.
function parseYoutubeSegments(raw: unknown[]): TranscriptSegment[] {
  const temp: { text: string; start: number; rawEnd: number }[] = [];
  for (const s of raw) {
    if (s && typeof s === 'object') {
      const seg = s as { text?: string; phrase?: string; start?: number; offset?: number; duration?: number };
      const text = (seg.text || seg.phrase || '').trim();
      if (!text) continue;
      const start = Number(seg.start ?? seg.offset ?? 0);
      const duration = Number(seg.duration ?? 0);
      temp.push({ text, start: Number(start.toFixed(2)), rawEnd: Number((start + duration).toFixed(2)) });
    }
  }
  temp.sort((a, b) => a.start - b.start);
  return temp.map((seg, i) => {
    const next = temp[i + 1];
    const end = next && next.start > seg.start && next.start < seg.rawEnd ? next.start : seg.rawEnd;
    return {
      text: seg.text,
      start: seg.start,
      duration: Number(Math.max(0.5, end - seg.start).toFixed(2)),
      end: Number(end.toFixed(2)),
    };
  });
}

export default function Home() {
  const { toasts, push: notify, dismiss } = useToasts();
  const { theme, toggle: toggleTheme } = useTheme();

  // ---- Project state -------------------------------------------------------
  const [transcript, setTranscript] = useState('');
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [youtubeLink, setYoutubeLink] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [channelName, setChannelName] = useState('');
  const [targetVideoLength, setTargetVideoLength] = useState<number | ''>(30);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [draftReady, setDraftReady] = useState(false);

  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Transcript translation: the original is kept so the user can switch back,
  // and each translation is cached so switching languages doesn't re-call Groq.
  const [originalTranscript, setOriginalTranscript] = useState<{
    text: string;
    segments: TranscriptSegment[];
    language: TranscriptLanguage;
  } | null>(null);
  const [translatedTo, setTranslatedTo] = useState<TranslationTarget | null>(null);
  const [translatingTo, setTranslatingTo] = useState<TranslationTarget | null>(null);
  const translationCache = useRef(new Map<TranslationTarget, { text: string; segments: TranscriptSegment[] }>());

  const [videoUrl, setVideoUrl] = useState('');
  const [savedVideoFilename, setSavedVideoFilename] = useState(DEFAULT_VIDEO_FILENAME);
  const [seoState, setSeoState] = useState<SeoState>({ status: 'idle' });

  // ---- Settings ------------------------------------------------------------
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mediaSettings, setMediaSettings] = useState<MediaSettings>(DEFAULT_MEDIA_SETTINGS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) setMediaSettings({ ...DEFAULT_MEDIA_SETTINGS, ...JSON.parse(saved) });
    } catch (err) {
      console.warn('Could not read media settings from localStorage:', err);
    }
  }, []);

  const handleSaveSettings = useCallback((next: MediaSettings) => {
    setMediaSettings(next);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('Could not save media settings to localStorage:', err);
    }
  }, []);

  // ---- UI state ------------------------------------------------------------
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('preview');
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  // Assets already shown per scene, so "Find another" keeps moving forward.
  const triedAssets = useRef(new Map<string, string[]>());

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [allLibraryImages, setAllLibraryImages] = useState<string[]>([]);
  const [replacing, setReplacing] = useState<{ id: string; target: 'image' | 'host' } | null>(null);
  const [hostVideos, setHostVideos] = useState<string[]>([]);
  const [editingDuaId, setEditingDuaId] = useState<string | null>(null);

  const transcriptRef = useRef<HTMLTextAreaElement>(null);

  const activeIndex = Math.max(0, scenes.findIndex((s) => s.id === activeSceneId));
  const sceneStartTimes = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const s of scenes) {
      starts.push(acc);
      acc += s.duration;
    }
    return starts;
  }, [scenes]);
  const totalDuration = useMemo(() => scenes.reduce((sum, s) => sum + s.duration, 0), [scenes]);

  const updateScene = useCallback((id: string, patch: Partial<Scene> | ((s: Scene) => Partial<Scene>)) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } : s)),
    );
  }, []);

  const selectSceneIndex = useCallback(
    (index: number) => {
      const scene = scenes[index];
      if (scene?.id) setActiveSceneId(scene.id);
    },
    [scenes],
  );

  const clearTranslation = useCallback(() => {
    setOriginalTranscript(null);
    setTranslatedTo(null);
    translationCache.current.clear();
  }, []);

  // ---- Draft autosave / restore ---------------------------------------------
  const resetProject = useCallback(() => {
    setTranscript('');
    setTranscriptSegments([]);
    clearTranslation();
    setYoutubeLink('');
    setVideoTitle('');
    setChannelName('');
    setTargetVideoLength(30);
    setScenes([]);
    setActiveSceneId(null);
    setBrokenIds(new Set());
    triedAssets.current.clear();
    clearDraft();
  }, [clearTranslation]);

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setTranscript(draft.transcript || '');
      setTranscriptSegments(draft.transcriptSegments || []);
      setYoutubeLink(draft.youtubeLink || '');
      setVideoTitle(draft.videoTitle || '');
      setChannelName(draft.channelName || '');
      setTargetVideoLength(draft.targetVideoLength ?? 30);
      const restored = withIds(draft.scenes || []);
      setScenes(restored);
      setActiveSceneId(restored[0]?.id ?? null);
      notify({
        kind: 'info',
        title: 'Draft restored',
        message: restored.length
          ? `Your transcript and ${restored.length} scenes are back.`
          : 'Your transcript is back.',
        action: { label: 'Start fresh', onClick: resetProject },
      });
    }
    setDraftReady(true);
    // Runs once on mount; notify/resetProject are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draft = useMemo(
    () => ({ transcript, transcriptSegments, youtubeLink, videoTitle, channelName, targetVideoLength, scenes }),
    [transcript, transcriptSegments, youtubeLink, videoTitle, channelName, targetVideoLength, scenes],
  );
  useDraftAutosave(draft, draftReady);

  // ---- Library -------------------------------------------------------------
  const fetchLibraryImages = useCallback(async () => {
    try {
      const res = await fetch('/api/list-images');
      const data = await res.json();
      if (data.images) setAllLibraryImages(data.images);
    } catch (err) {
      console.error('Failed to load library images:', err);
    }
  }, []);

  useEffect(() => {
    fetchLibraryImages();
  }, [fetchLibraryImages]);

  // ---- Step 1: transcript --------------------------------------------------
  const handleImportYoutube = async (url: string) => {
    setIsFetchingTranscript(true);
    try {
      const res = await fetch('/api/fetch-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to fetch the transcript.');
      if (!Array.isArray(data.transcript)) throw new Error('No transcript was found for this video.');

      const segments = parseYoutubeSegments(data.transcript);
      const text = segments.length
        ? segments.map((s) => s.text).join(' ')
        : data.transcript
            .map((s: { text?: string; phrase?: string } | string) => (typeof s === 'string' ? s : s.text || s.phrase || ''))
            .join(' ');

      setYoutubeLink(url);
      setVideoTitle(typeof data.videoTitle === 'string' ? data.videoTitle : '');
      setChannelName(typeof data.channelName === 'string' ? data.channelName : '');
      setTranscript(text);
      setTranscriptSegments(segments);
      clearTranslation();

      const audioEnd = segments.length ? segments[segments.length - 1].end : Number(data.length_seconds) || 0;
      if (audioEnd > 0) setTargetVideoLength(Math.round(audioEnd));
      notify({
        kind: 'success',
        title: 'Transcript imported',
        message: segments.length
          ? `${segments.length} segments · ${audioEnd.toFixed(0)}s, synced to the audio timeline.`
          : undefined,
      });
    } catch (err) {
      notify({
        kind: 'error',
        title: "Couldn't import from YouTube",
        message: err instanceof Error ? err.message : 'Unknown error.',
        action: { label: 'Retry', onClick: () => handleImportYoutube(url) },
      });
    } finally {
      setIsFetchingTranscript(false);
    }
  };

  const hasTranscript = Boolean(transcript.trim()) && !isYoutubeUrl(transcript);

  const sourceLanguage = useMemo<TranscriptLanguage>(
    () => originalTranscript?.language ?? detectTranscriptLanguage(transcript),
    [originalTranscript, transcript],
  );

  const handleTranslate = async (target: TranslationTarget) => {
    if (!hasTranscript || translatingTo) return;
    // Always translate from the original so errors don't compound.
    const base = originalTranscript ?? {
      text: transcript,
      segments: transcriptSegments,
      language: sourceLanguage,
    };
    const hadScenes = scenes.length > 0;

    const applyTranslation = (result: { text: string; segments: TranscriptSegment[] }) => {
      setOriginalTranscript(base);
      setTranscript(result.text);
      setTranscriptSegments(result.segments);
      setTranslatedTo(target);
      if (hadScenes) {
        notify({
          kind: 'info',
          title: `Transcript switched to ${TRANSLATION_TARGET_LABELS[target]}`,
          message: 'Re-analyze to rebuild the scenes in this language.',
        });
      }
    };

    const cached = translationCache.current.get(target);
    if (cached) {
      applyTranslation(cached);
      return;
    }

    setTranslatingTo(target);
    try {
      const res = await fetch('/api/translate-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLanguage: target,
          segments: base.segments.length > 0 ? base.segments : undefined,
          text: base.segments.length > 0 ? undefined : base.text,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation failed.');

      const result = {
        text: String(data.text || ''),
        segments: Array.isArray(data.segments) ? (data.segments as TranscriptSegment[]) : [],
      };
      translationCache.current.set(target, result);
      applyTranslation(result);
      if (data.untranslated > 0) {
        notify({
          kind: 'info',
          title: `${data.untranslated} line(s) kept in the original language`,
          message: 'The model skipped them — you can edit those lines by hand.',
        });
      }
    } catch (err) {
      notify({
        kind: 'error',
        title: "Couldn't translate the transcript",
        message: err instanceof Error ? err.message : 'Unknown error.',
        action: { label: 'Retry', onClick: () => handleTranslate(target) },
      });
    } finally {
      setTranslatingTo(null);
    }
  };

  const handleShowOriginal = () => {
    if (!originalTranscript) return;
    setTranscript(originalTranscript.text);
    setTranscriptSegments(originalTranscript.segments);
    setTranslatedTo(null);
  };

  const handleAnalyze = async () => {
    if (!hasTranscript || isAnalyzing) return;
    const previousScenes = scenes;
    setIsAnalyzing(true);
    try {
      const analyzeRes = await fetch('/api/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          targetLength: targetVideoLength || undefined,
          segments: transcriptSegments.length > 0 ? transcriptSegments : undefined,
          useRelatableVisualSearch: mediaSettings.useRelatableVisualSearch !== false,
        }),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error || 'Transcript analysis failed.');

      const matchRes = await fetch('/api/match-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: analyzeData.scenes, mediaSettings }),
      });
      const matchData = await matchRes.json();
      if (!matchRes.ok) throw new Error(matchData.error || 'Image matching failed.');

      const next = withIds(matchData.matches as Scene[]);
      setScenes(next);
      setActiveSceneId(next[0]?.id ?? null);
      setBrokenIds(new Set());
      triedAssets.current.clear();
      setPreviewTab('preview');

      const fallbackCount = next.filter((s) => s.isFallback).length;
      notify({
        kind: 'success',
        title: `${next.length} scenes ready`,
        message: fallbackCount
          ? `${fallbackCount} used a fallback image — try "Find another" on those.`
          : 'Review the scenes, then generate your video.',
        action: previousScenes.length
          ? {
              label: 'Undo',
              onClick: () => {
                setScenes(previousScenes);
                setActiveSceneId(previousScenes[0]?.id ?? null);
              },
            }
          : undefined,
      });
      document.getElementById('step-scenes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Analysis failed',
        message: err instanceof Error ? err.message : 'Unknown error.',
        action: { label: 'Retry', onClick: () => handleAnalyze() },
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTargetLengthChange = (val: string) => {
    const num = parseFloat(val);
    if (val === '' || isNaN(num) || num <= 0) {
      setTargetVideoLength('');
      return;
    }
    setTargetVideoLength(num);
    // Existing scenes scale proportionally so their sum matches the new length.
    if (scenes.length > 0) setScenes((prev) => rescaleSceneDurations(prev, num));
  };

  // ---- Step 2: scene editing -----------------------------------------------
  const reorderScenes = (from: number, to: number) => {
    if (to < 0 || to >= scenes.length || from === to) return;
    setScenes((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const duplicateScene = (id: string) => {
    setScenes((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      if (i < 0) return prev;
      const copy = { ...prev[i], id: newSceneId() };
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
  };

  const deleteScene = (id: string) => {
    const index = scenes.findIndex((s) => s.id === id);
    if (index < 0) return;
    const removed = scenes[index];
    setScenes((prev) => prev.filter((s) => s.id !== id));
    if (activeSceneId === id) {
      setActiveSceneId(scenes[index + 1]?.id ?? scenes[index - 1]?.id ?? null);
    }
    notify({
      kind: 'info',
      title: `Scene ${index + 1} deleted`,
      action: {
        label: 'Undo',
        onClick: () =>
          setScenes((prev) => [...prev.slice(0, index), removed, ...prev.slice(index)]),
      },
    });
  };

  const handleFindAnother = async (id: string) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene || regeneratingIds.has(id)) return;
    const tried = triedAssets.current.get(id) ?? [scene.image];
    setRegeneratingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch('/api/match-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: [scene],
          // A lone scene would otherwise be treated as the avatar intro hook.
          mediaSettings: { ...mediaSettings, enableAvatarHost: false },
          excludeAssets: tried,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not find another match.');
      const match: Scene | undefined = data.matches?.[0];
      if (!match?.image) throw new Error('No media was returned.');

      if (tried.includes(match.image)) {
        notify({ kind: 'info', title: 'No other match found', message: 'Try Replace to pick from your library.' });
        return;
      }
      triedAssets.current.set(id, [...tried, match.image]);
      updateScene(id, {
        image: match.image,
        isFallback: match.isFallback,
        matchedTier: match.matchedTier,
        matchedQuery: match.matchedQuery,
      });
      setBrokenIds((prev) => withoutKey(prev, id));
    } catch (err) {
      notify({
        kind: 'error',
        title: "Couldn't find another shot",
        message: err instanceof Error ? err.message : 'Unknown error.',
        action: { label: 'Retry', onClick: () => handleFindAnother(id) },
      });
    } finally {
      setRegeneratingIds((prev) => withoutKey(prev, id));
    }
  };

  const handleSaveLocally = async (id: string) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene || !isRemoteUrl(scene.image) || savingIds.has(id)) return;
    setSavingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch('/api/save-remote-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scene.image }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save media locally.');
      updateScene(id, { image: data.filename });
      fetchLibraryImages();
      notify({ kind: 'success', title: 'Saved to My Library' });
    } catch (err) {
      notify({
        kind: 'error',
        title: "Couldn't save to library",
        message: err instanceof Error ? err.message : 'Unknown error.',
        action: { label: 'Retry', onClick: () => handleSaveLocally(id) },
      });
    } finally {
      setSavingIds((prev) => withoutKey(prev, id));
    }
  };

  const openReplaceHost = async (id: string) => {
    setReplacing({ id, target: 'host' });
    // The general library scan skips avatars/, so load host clips separately.
    try {
      const category = mediaSettings.avatarCategory || DEFAULT_MEDIA_SETTINGS.avatarCategory || 'women_avatars';
      const res = await fetch(`/api/list-avatars?videos=1&category=${encodeURIComponent(category)}`);
      const data = await res.json();
      if (Array.isArray(data.videos)) setHostVideos(data.videos);
    } catch (err) {
      console.error('Failed to load host videos:', err);
    }
  };

  const handleSelectReplacement = (filename: string) => {
    if (!replacing) return;
    updateScene(
      replacing.id,
      replacing.target === 'host' ? { avatarAsset: filename } : { image: filename, isFallback: false },
    );
    if (replacing.target === 'image') setBrokenIds((prev) => withoutKey(prev, replacing.id));
    setReplacing(null);
  };

  const handleSaveDua = (_sceneIndex: number, updatedDua: DuaInfo | undefined) => {
    if (editingDuaId) updateScene(editingDuaId, { duaInfo: updatedDua });
  };

  // ---- Step 3/4: generation, SEO, history ------------------------------------
  const generateSeo = async (): Promise<SeoMetadata | null> => {
    setSeoState({ status: 'loading' });
    try {
      const res = await fetch('/api/generate-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          videoTitle,
          channelName,
          keywords: scenes.map((s) => s.keyword).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate SEO metadata.');
      setSeoState({ status: 'ready', seo: data.seo });
      return data.seo;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error.';
      setSeoState({ status: 'error', message });
      notify({ kind: 'error', title: "Couldn't write title & hashtags", message });
      return null;
    }
  };

  // Best-effort: the video already compiled, so failures here stay quiet.
  const recordGenerationHistory = async (savedFilename?: string) => {
    if (mediaSettings.saveHistoryEnabled === false) return;
    const seo = await generateSeo();
    if (!seo) return;
    const entryPayload = {
      videoTitle: videoTitle || 'Untitled Video',
      channelName: channelName || 'Unknown Channel',
      seo,
      savedFilename,
    };
    try {
      if ((mediaSettings.historyStorageMode || 'server') === 'local') {
        const entry: HistoryEntry = {
          id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
          ...entryPayload,
        };
        addLocalHistoryEntry(entry);
      } else {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entryPayload),
        });
      }
    } catch (err) {
      console.error('Failed to record generation history:', err);
    }
  };

  const showExport = () => {
    setPreviewTab('final');
    requestAnimationFrame(() =>
      document.getElementById('step-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  const generation = useVideoGeneration({
    onComplete: ({ videoUrl: url, savedFilename }) => {
      setVideoUrl(url);
      setSavedVideoFilename(savedFilename || DEFAULT_VIDEO_FILENAME);
      setPreviewTab('final');
      notify({
        kind: 'success',
        title: 'Your video is ready',
        action: { label: 'View & export', onClick: showExport },
      });
      recordGenerationHistory(savedFilename);
    },
    onError: (message) => {
      notify({
        kind: 'error',
        title: 'Video generation failed',
        message,
        action: { label: 'Retry', onClick: () => handleGenerate() },
      });
    },
  });

  const handleGenerate = () => {
    if (scenes.length === 0 || generation.isGenerating) return;
    setSeoState({ status: 'idle' });
    generation.start({ scenes, mediaSettings, videoTitle, channelName });
  };

  // ---- Keyboard shortcuts ----------------------------------------------------
  // Ctrl/⌘+Enter runs the current step's primary action.
  const shortcutRef = useRef({ handleAnalyze, handleGenerate, sceneCount: scenes.length });
  shortcutRef.current = { handleAnalyze, handleGenerate, sceneCount: scenes.length };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      const { handleAnalyze: analyze, handleGenerate: generate, sceneCount } = shortcutRef.current;
      if (sceneCount === 0 || document.activeElement === transcriptRef.current) analyze();
      else generate();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ---- Steps -----------------------------------------------------------------
  const currentStep: DashboardStep = videoUrl ? 4 : generation.isGenerating ? 3 : scenes.length ? 2 : 1;
  const maxReached: DashboardStep = videoUrl ? 4 : scenes.length ? 3 : 1;

  const goToStep = (step: DashboardStep) => {
    const targets: Record<DashboardStep, string> = {
      1: 'step-transcript',
      2: 'step-scenes',
      3: 'step-preview',
      4: 'step-preview',
    };
    if (step === 3) setPreviewTab('preview');
    if (step === 4) setPreviewTab('final');
    requestAnimationFrame(() =>
      document.getElementById(targets[step])?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  const settingsSummary = [
    mediaSettings.aspectRatio || '9:16',
    mediaSettings.textOverlayMode === 'graphics'
      ? 'Animated text'
      : mediaSettings.textOverlayMode === 'none'
        ? 'No text'
        : 'Captions',
    `${Object.values(mediaSettings.sources || DEFAULT_MEDIA_SETTINGS.sources).filter(Boolean).length} sources`,
  ].join(' · ');

  const editingDuaIndex = scenes.findIndex((s) => s.id === editingDuaId);
  const replacingScene = replacing ? scenes.find((s) => s.id === replacing.id) : undefined;
  const isBusy = isAnalyzing || isFetchingTranscript || translatingTo !== null;

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans antialiased">
      <TopNav
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        settingsSummary={settingsSummary}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-32">
        <div className="mb-6">
          <StepIndicator current={currentStep} maxReached={maxReached} onStepClick={goToStep} />
        </div>

        {/*
          DOM order = mobile order (input → preview → scenes). On lg the
          preview becomes a sticky right column spanning both rows.
        */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-7 lg:row-start-1">
            <InputPanel
              ref={transcriptRef}
              value={transcript}
              onChange={(v) => {
                setTranscript(v);
                // Editing the text breaks the link to YouTube's timing.
                if (transcriptSegments.length && !v.trim()) setTranscriptSegments([]);
                if (!v.trim()) clearTranslation();
              }}
              onImportYoutube={handleImportYoutube}
              onUseSample={() => {
                setTranscript(SAMPLE_TRANSCRIPT);
                setTranscriptSegments([]);
                clearTranslation();
                setTargetVideoLength(30);
              }}
              onReset={resetProject}
              isFetching={isFetchingTranscript}
              isBusy={isBusy}
              sourceTitle={youtubeLink ? videoTitle : ''}
              transcriptSegments={transcriptSegments}
              onUnlinkSegments={() => {
                setTranscriptSegments([]);
                notify({ kind: 'info', title: 'Audio sync unlinked', message: 'Scene timing will be estimated from speech rate.' });
              }}
              targetVideoLength={targetVideoLength}
              onTargetLengthChange={handleTargetLengthChange}
              onReanalyze={scenes.length ? handleAnalyze : undefined}
              sourceLanguage={sourceLanguage}
              translatedTo={translatedTo}
              translatingTo={translatingTo}
              onTranslate={handleTranslate}
              onShowOriginal={handleShowOriginal}
            />
          </div>

          <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24">
            <PreviewPanel
              tab={previewTab}
              onTabChange={setPreviewTab}
              scenes={scenes}
              activeIndex={activeIndex}
              onSelectScene={selectSceneIndex}
              mediaSettings={mediaSettings}
              onChangeCaptionPosition={(pos) => handleSaveSettings({ ...mediaSettings, captionPosition: pos })}
              onOpenDuaEditor={(i) => setEditingDuaId(scenes[i]?.id ?? null)}
              isAnalyzing={isAnalyzing}
              isGenerating={generation.isGenerating}
              isCancelling={generation.isCancelling}
              progress={generation.progress}
              onCancel={generation.cancel}
              videoUrl={videoUrl}
              savedFilename={savedVideoFilename}
              seoState={seoState}
              onGenerateSeo={generateSeo}
              notify={notify}
            />
          </div>

          {scenes.length > 0 && (
            <div className="lg:col-span-7 lg:row-start-2">
              <Storyboard
                scenes={scenes}
                sceneStartTimes={sceneStartTimes}
                activeIndex={activeIndex}
                textOverlayMode={mediaSettings.textOverlayMode}
                brokenIds={brokenIds}
                savingIds={savingIds}
                regeneratingIds={regeneratingIds}
                onSelect={selectSceneIndex}
                onReorder={reorderScenes}
                handlersFor={(scene) => {
                  const id = scene.id!;
                  return {
                    onReplace: () => setReplacing({ id, target: 'image' }),
                    onReplaceHost: () => openReplaceHost(id),
                    onFindAnother: () => handleFindAnother(id),
                    onDuplicate: () => duplicateScene(id),
                    onDelete: () => deleteScene(id),
                    onSaveLocally: () => handleSaveLocally(id),
                    onEditDua: () => setEditingDuaId(id),
                    onChangeEmoji: (emoji) => updateScene(id, { emoji }),
                    onEditCaption: (ci, text) =>
                      updateScene(id, (s) => ({
                        captions: s.captions?.map((c, i) => (i === ci ? { ...c, text } : c)),
                      })),
                    onEditGraphic: (gi, heroWord) =>
                      updateScene(id, (s) => ({
                        graphics: s.graphics?.map((g, i) => (i === gi ? { ...g, heroWord } : g)),
                      })),
                    onImageError: () => setBrokenIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id))),
                    onImageLoad: () => setBrokenIds((prev) => withoutKey(prev, id)),
                  };
                }}
              />
            </div>
          )}
        </div>
      </main>

      <StickyActionBar
        hasTranscript={hasTranscript}
        sceneCount={scenes.length}
        totalDuration={totalDuration}
        isAnalyzing={isAnalyzing}
        isGenerating={generation.isGenerating}
        isCancelling={generation.isCancelling}
        progress={generation.progress}
        hasVideo={Boolean(videoUrl)}
        onAnalyze={handleAnalyze}
        onGenerate={handleGenerate}
        onCancel={generation.cancel}
        onShowExport={showExport}
      />

      <Toaster toasts={toasts} onDismiss={dismiss} />

      <ReplaceImageModal
        isOpen={replacing !== null}
        onClose={() => setReplacing(null)}
        onSelectImage={handleSelectReplacement}
        allImages={replacing?.target === 'host' ? hostVideos : allLibraryImages}
        title={replacing?.target === 'host' ? 'Select Replacement Host' : undefined}
        currentImage={replacing?.target === 'host' ? replacingScene?.avatarAsset : replacingScene?.image}
        sceneIndex={replacingScene ? scenes.indexOf(replacingScene) : null}
        sceneKeyword={replacingScene?.keyword}
        onLibraryRefresh={fetchLibraryImages}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={mediaSettings}
        onSave={handleSaveSettings}
      />

      <DuaEditModal
        isOpen={editingDuaId !== null}
        onClose={() => setEditingDuaId(null)}
        sceneIndex={editingDuaIndex >= 0 ? editingDuaIndex : null}
        sceneKeyword={scenes[editingDuaIndex]?.keyword}
        initialDua={scenes[editingDuaIndex]?.duaInfo}
        cardTheme={mediaSettings.duaCardTheme || 'cream'}
        cardPosition={mediaSettings.duaCardPosition || 'center'}
        aspectRatio={mediaSettings.aspectRatio || '9:16'}
        onSaveDua={handleSaveDua}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        storageMode={mediaSettings.historyStorageMode || 'server'}
      />
    </div>
  );
}
