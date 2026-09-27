'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Video,
  Play,
  Download,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Film,
  CheckCircle2,
  Clock,
  Sliders,
  Settings,
  BookOpen,
  Edit3,
  Plus,
  Loader2,
  History
} from 'lucide-react';
import SettingsModal, {
  MediaSettings,
  DEFAULT_MEDIA_SETTINGS
} from '@/app/components/SettingsModal';
import ReplaceImageModal from '@/app/components/ReplaceImageModal';
import DuaEditModal from '@/app/components/DuaEditModal';
import SceneLivePreviewPlayer from '@/app/components/SceneLivePreviewPlayer';
import HistoryModal from '@/app/components/HistoryModal';
import { getMediaUrl, isVideoAsset, isRemoteUrl } from '@/app/utils/media-url';
import { rescaleSceneDurations } from '@/app/utils/scene-timing';
import { addLocalHistoryEntry } from '@/app/utils/history-client';
import { VIDEO_PROGRESS_POLL_INTERVAL_MS, MAX_NOT_FOUND_POLLS } from '@/app/config/client-config';
import type { Scene, TranscriptSegment, DuaInfo } from '@/app/types/scene';
import type { HistoryEntry } from '@/app/types/history';

export type { Scene, TranscriptSegment, GraphicBeat, CaptionSlice } from '@/app/types/scene';

export default function Home() {
  const [transcript, setTranscript] = useState('');
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [youtubeLink, setYoutubeLink] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [channelName, setChannelName] = useState('');
  const [savingLocallyIndices, setSavingLocallyIndices] = useState<Set<number>>(new Set());
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);

  // Prefix-sum of scene durations, so each scene's absolute start time is a lookup
  // instead of an O(n) slice+reduce recomputed for every scene on every render.
  const sceneStartTimes = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const s of scenes) {
      starts.push(acc);
      acc += s.duration;
    }
    return starts;
  }, [scenes]);

  const [targetVideoLength, setTargetVideoLength] = useState<number | ''>(30);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [savedVideoFilename, setSavedVideoFilename] = useState('hadith_shorts.mp4');
  const [pollCount, setPollCount] = useState<number>(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRunIdRef = useRef<string | null>(null);

  // Clear any in-flight progress poll on unmount so it doesn't keep calling
  // setState after the component is gone.
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Settings Panel state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mediaSettings, setMediaSettings] = useState<MediaSettings>(DEFAULT_MEDIA_SETTINGS);

  // Load saved settings from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hadith_shorts_media_settings');
      if (saved) {
        setMediaSettings({
          ...DEFAULT_MEDIA_SETTINGS,
          ...JSON.parse(saved),
        });
      }
    } catch (err) {
      console.warn('Could not read media settings from localStorage:', err);
    }
  }, []);

  const handleSaveSettings = (newSettings: MediaSettings) => {
    setMediaSettings(newSettings);
    try {
      localStorage.setItem('hadith_shorts_media_settings', JSON.stringify(newSettings));
    } catch (err) {
      console.warn('Could not save media settings to localStorage:', err);
    }
  };

  // Image replacement state
  const [allLibraryImages, setAllLibraryImages] = useState<string[]>([]);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [replacingTarget, setReplacingTarget] = useState<'image' | 'host'>('image');
  const [hostVideos, setHostVideos] = useState<string[]>([]);
  // Scene indices whose stock image failed to load (broken/expired remote URL),
  // so we can show an explicit "replace this" message instead of a silent fade.
  const [brokenImageIndices, setBrokenImageIndices] = useState<Set<number>>(new Set());

  const markImageBroken = (index: number) => {
    setBrokenImageIndices((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
  };
  const markImageLoaded = (index: number) => {
    setBrokenImageIndices((prev) => {
      if (!prev.has(index)) return prev;
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Active Storyboard Scene Preview state
  const [activePreviewSceneIndex, setActivePreviewSceneIndex] = useState<number>(0);
  const [activeRightPanelTab, setActiveRightPanelTab] = useState<'preview' | 'compiled'>('preview');

  // Dua Edit Modal state
  const [editingDuaSceneIdx, setEditingDuaSceneIdx] = useState<number | null>(null);
  const [isDuaModalOpen, setIsDuaModalOpen] = useState(false);

  const handleOpenDuaEditor = (sceneIdx: number) => {
    setEditingDuaSceneIdx(sceneIdx);
    setIsDuaModalOpen(true);
  };

  const handleSaveDua = (sceneIndex: number, updatedDua: DuaInfo | undefined) => {
    setScenes((prev) => {
      const updated = [...prev];
      if (updated[sceneIndex]) {
        updated[sceneIndex] = {
          ...updated[sceneIndex],
          duaInfo: updatedDua,
        };
      }
      return updated;
    });
  };

  // Quick Emoji Picker state
  const [activeEmojiPickerIdx, setActiveEmojiPickerIdx] = useState<number | null>(null);
  const QUICK_EMOJIS = ['💔', '🤲', '🔥', '⏳', '⚠️', '✨', '💰', '💡', '🥀', '😢', '🕌', '👑', '🕊️', '📖', '⚖️', '❤️'];

  const handleSelectSceneEmoji = (sceneIdx: number, emoji: string) => {
    setScenes((prev) => {
      const updated = [...prev];
      if (updated[sceneIdx]) {
        updated[sceneIdx] = { ...updated[sceneIdx], emoji };
      }
      return updated;
    });
    setActiveEmojiPickerIdx(null);
  };

  // Load all images from the library on load for manual overriding
  useEffect(() => {
    fetchLibraryImages();
  }, []);

  const fetchLibraryImages = async () => {
    try {
      const res = await fetch('/api/list-images');
      const data = await res.json();
      if (data.images) {
        setAllLibraryImages(data.images);
      }
    } catch (err) {
      console.error('Failed to load library images:', err);
    }
  };

  const handleFetchTranscript = async () => {
    if (!youtubeLink.trim()) {
      setErrorMessage('Please enter a YouTube link first.');
      return;
    }

    setErrorMessage('');
    setInfoMessage('');
    setIsFetchingTranscript(true);

    try {
      const res = await fetch('/api/fetch-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ youtubeUrl: youtubeLink.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to fetch transcript from the API.');
      }

      setVideoTitle(typeof data.videoTitle === 'string' ? data.videoTitle : '');
      setChannelName(typeof data.channelName === 'string' ? data.channelName : '');

      if (data.transcript && Array.isArray(data.transcript)) {
        const rawSegments = data.transcript;
        const tempSegments: { text: string; start: number; rawEnd: number }[] = [];

        for (const s of rawSegments) {
          if (s && typeof s === 'object') {
            const txt = (s.text || s.phrase || '').trim();
            if (!txt) continue;
            const start = Number(s.start ?? s.offset ?? 0);
            const duration = Number(s.duration ?? 0);
            tempSegments.push({
              text: txt,
              start: Number(start.toFixed(2)),
              rawEnd: Number((start + duration).toFixed(2)),
            });
          }
        }

        // Sort by start timestamp
        tempSegments.sort((a, b) => a.start - b.start);

        // De-overlap segments: YouTube captions overlap on-screen, but actual spoken time ends when the next segment begins
        const parsedSegments: TranscriptSegment[] = tempSegments.map((seg, i) => {
          const nextSeg = tempSegments[i + 1];
          const end = nextSeg && nextSeg.start > seg.start && nextSeg.start < seg.rawEnd
            ? nextSeg.start
            : seg.rawEnd;
          const duration = Number(Math.max(0.5, end - seg.start).toFixed(2));
          return {
            text: seg.text,
            start: seg.start,
            duration,
            end: Number(end.toFixed(2)),
          };
        });

        const text = parsedSegments.length > 0
          ? parsedSegments.map(s => s.text).join(' ')
          : rawSegments
            .map((s: { text?: string; phrase?: string } | string) => typeof s === 'string' ? s : (s.text || s.phrase || ''))
            .join(' ');

        setTranscript(text);
        setTranscriptSegments(parsedSegments);

        const maxEndTime = parsedSegments.length > 0
          ? parsedSegments[parsedSegments.length - 1].end
          : (data.length_seconds ? Number(data.length_seconds) : 0);

        if (parsedSegments.length > 0) {
          const durationSec = Math.round(maxEndTime);
          setTargetVideoLength(durationSec);
          setInfoMessage(
            `Successfully imported ${parsedSegments.length} timestamped spoken segments (${maxEndTime.toFixed(1)}s audio duration) from YouTube. Audio timeline is accurately synchronized.`
          );
        } else if (data.length_seconds) {
          setTargetVideoLength(Number(data.length_seconds));
          setInfoMessage(`Successfully imported transcript from YouTube video. Target length set to ${data.lengthText || data.length_seconds + 's'}.`);
        } else {
          setInfoMessage('Successfully imported transcript from YouTube video.');
        }
      } else {
        throw new Error('Transcript not found or invalid format in response.');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'An error occurred while fetching the transcript.';
      setErrorMessage(errMsg);
    } finally {
      setIsFetchingTranscript(false);
    }
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      setErrorMessage('Please paste a transcript first.');
      return;
    }

    setErrorMessage('');
    setInfoMessage('');
    setIsAnalyzing(true);
    setScenes([]);
    setVideoUrl('');
    setBrokenImageIndices(new Set());

    try {
      // 1. Analyze transcript to get keywords/durations (with real timeline segments if present)
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
      if (!analyzeRes.ok) {
        throw new Error(analyzeData.error || 'Transcript analysis failed.');
      }

      const extractedScenes = analyzeData.scenes;

      // 2. Match images based on keywords & user mediaSettings
      const matchRes = await fetch('/api/match-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: extractedScenes,
          mediaSettings,
        }),
      });

      const matchData = await matchRes.json();
      if (!matchRes.ok) {
        throw new Error(matchData.error || 'Image matching failed.');
      }

      setScenes(matchData.matches);
      setActivePreviewSceneIndex(0);
      setActiveRightPanelTab('preview');

      // Check if any matched images are fallback matches
      const fallbackCount = matchData.matches.filter((s: Scene) => s.isFallback).length;
      if (fallbackCount > 0) {
        setInfoMessage(`${fallbackCount} scenes did not find direct keyword matches and were assigned fallback images. You can manually replace them.`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'An error occurred during analysis.';
      setErrorMessage(errMsg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleResetInput = () => {
    setYoutubeLink('');
    setTranscript('');
    setTranscriptSegments([]);
    setVideoTitle('');
    setChannelName('');
    setErrorMessage('');
    setInfoMessage('');
  };

  const handleTargetLengthChange = (val: string) => {
    if (val === '') {
      setTargetVideoLength('');
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      setTargetVideoLength('');
      return;
    }
    setTargetVideoLength(num);

    // If scenes already exist, proportionally scale them so their sum matches the new target length
    if (scenes.length > 0) {
      setScenes(rescaleSceneDurations(scenes, num));
    }
  };

  const handleReplaceClick = (index: number) => {
    setReplacingIndex(index);
    setReplacingTarget('image');
    setIsModalOpen(true);
  };

  const handleSaveImageLocally = async (index: number) => {
    const scene = scenes[index];
    if (!scene || !isRemoteUrl(scene.image) || savingLocallyIndices.has(index)) return;

    setSavingLocallyIndices((prev) => new Set(prev).add(index));
    try {
      const res = await fetch('/api/save-remote-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scene.image }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save media locally.');
      }
      setScenes((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], image: data.filename };
        }
        return updated;
      });
      fetchLibraryImages();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save media locally.');
    } finally {
      setSavingLocallyIndices((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const handleReplaceHostClick = async (index: number) => {
    setReplacingIndex(index);
    setReplacingTarget('host');
    setIsModalOpen(true);
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

  const handleSelectImage = (filename: string) => {
    if (replacingIndex !== null) {
      const updatedScenes = [...scenes];
      updatedScenes[replacingIndex] =
        replacingTarget === 'host'
          ? { ...updatedScenes[replacingIndex], avatarAsset: filename }
          : {
              ...updatedScenes[replacingIndex],
              image: filename,
              isFallback: false // Reset fallback status since it is manually selected
            };
      setScenes(updatedScenes);
      setIsModalOpen(false);
      setReplacingIndex(null);
      setReplacingTarget('image');
    }
  };

  // Generates SEO metadata for the just-compiled video and appends it to the
  // generation history (server file or browser storage, per settings) —
  // best-effort: a failure here shouldn't surface as a generation error since
  // the video itself already compiled successfully.
  const recordGenerationHistory = async (savedFilename?: string) => {
    if (mediaSettings.saveHistoryEnabled === false) return;
    try {
      const seoRes = await fetch('/api/generate-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          videoTitle,
          channelName,
          keywords: scenes.map((s) => s.keyword).filter(Boolean),
        }),
      });
      const seoData = await seoRes.json();
      if (!seoRes.ok) {
        throw new Error(seoData.error || 'Failed to generate SEO metadata.');
      }

      const entryPayload = {
        videoTitle: videoTitle || 'Untitled Video',
        channelName: channelName || 'Unknown Channel',
        seo: seoData.seo,
        savedFilename,
      };

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

  const handleGenerateVideo = async () => {
    if (scenes.length === 0) return;

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setErrorMessage('');
    setIsGenerating(true);
    setVideoUrl('');
    setSavedVideoFilename('hadith_shorts.mp4');
    setPollCount(0);
    setGenerationStep('Initializing background video compilation worker...');

    const runId = 'run_' + Date.now();
    activeRunIdRef.current = runId;

    try {
      const initRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes,
          runId,
          videoTitle,
          channelName,
          zoomSpeed: mediaSettings.zoomSpeed ?? DEFAULT_MEDIA_SETTINGS.zoomSpeed,
          transitionDuration: mediaSettings.transitionDuration ?? DEFAULT_MEDIA_SETTINGS.transitionDuration,
          textOverlayMode: mediaSettings.textOverlayMode || (mediaSettings.enableGraphicMotion ? 'graphics' : 'captions'),
          captionPosition: mediaSettings.captionPosition || DEFAULT_MEDIA_SETTINGS.captionPosition,
          captionTheme: mediaSettings.captionTheme || DEFAULT_MEDIA_SETTINGS.captionTheme,
          enableGraphicMotion: mediaSettings.textOverlayMode === 'graphics',
          graphicMotionTheme: mediaSettings.graphicMotionTheme || 'auto',
          enableCaptions: mediaSettings.textOverlayMode === 'captions',
          aspectRatio: mediaSettings.aspectRatio || '9:16',
          enableEmojiCaptions: mediaSettings.enableEmojiCaptions !== false,
          emojiStyle: mediaSettings.emojiStyle || 'fluent',
          enableDuaOverlay: mediaSettings.enableDuaOverlay !== false,
          duaCardTheme: mediaSettings.duaCardTheme || 'cream',
          duaCardPosition: mediaSettings.duaCardPosition || 'center',
          enableAvatarHost: mediaSettings.enableAvatarHost !== false,
          avatarCategory: mediaSettings.avatarCategory || 'women_avatars',
          avatarId: mediaSettings.avatarId || 'Avatar-1',
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok) {
        throw new Error(initData.error || 'Failed to initialize video generation.');
      }

      setGenerationStep('Processing video clips in background...');

      let localPollCount = 0;
      let notFoundStreak = 0;
      const pollSeconds = VIDEO_PROGRESS_POLL_INTERVAL_MS / 1000;
      pollIntervalRef.current = setInterval(async () => {
        try {
          localPollCount++;
          setPollCount(localPollCount);

          const progRes = await fetch(`/api/generate-video/progress?runId=${runId}`);
          if (!progRes.ok) {
            console.error('Failed to query progress status.');
            return;
          }
          const progData = await progRes.json();

          if (progData.found === false) {
            // The job genuinely isn't tracked server-side anymore (e.g. the dev
            // server restarted mid-generation). Don't poll forever in silence —
            // give it one more try in case of a transient blip, then surface it.
            notFoundStreak++;
            if (notFoundStreak >= MAX_NOT_FOUND_POLLS) {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
              activeRunIdRef.current = null;
              setIsGenerating(false);
              setGenerationStep('');
              setErrorMessage('Lost track of this generation job (the server may have restarted). Please try generating again.');
            }
            return;
          }
          notFoundStreak = 0;

          if (progData.complete) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            activeRunIdRef.current = null;
            setIsGenerating(false);
            setGenerationStep('');
            if (progData.error) {
              setErrorMessage(progData.error);
            } else if (progData.videoPath) {
              setVideoUrl(progData.videoPath);
              if (progData.savedFilename) setSavedVideoFilename(progData.savedFilename);
              setActiveRightPanelTab('compiled');
              recordGenerationHistory(progData.savedFilename);
            } else {
              setErrorMessage('Video generation completed, but output path was not returned.');
            }
          } else {
            // Driven by the backend's actual stage/scene-count instead of
            // fabricated copy that guessed what was happening from poll count.
            const elapsed = `${localPollCount * pollSeconds}s`;
            if (progData.stage === 'merging') {
              setGenerationStep(`Merging video tracks... (${elapsed})`);
            } else if (progData.stage === 'rendering_scenes' && progData.totalScenes) {
              setGenerationStep(
                `Rendering scene ${Math.min(progData.scenesCompleted + 1, progData.totalScenes)}/${progData.totalScenes}... (${elapsed})`,
              );
            } else {
              setGenerationStep(`Preparing video compile... (${elapsed})`);
            }
          }
        } catch (pollErr) {
          console.error('Error polling background job status:', pollErr);
        }
      }, VIDEO_PROGRESS_POLL_INTERVAL_MS);

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Video generation failed to start.';
      setErrorMessage(errMsg);
      setIsGenerating(false);
      setGenerationStep('');
      activeRunIdRef.current = null;
    }
  };

  const handleCancelGeneration = async () => {
    const runId = activeRunIdRef.current;
    if (!runId || isCancelling) return;

    setIsCancelling(true);
    try {
      await fetch('/api/generate-video/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
    } catch (err) {
      console.error('Error cancelling generation job:', err);
    } finally {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      activeRunIdRef.current = null;
      setIsGenerating(false);
      setGenerationStep('');
      setIsCancelling(false);
      setErrorMessage('Video generation cancelled.');
    }
  };

  return (
    <div className="min-h-screen bg-white text-ink font-sans antialiased">
      {/* Airbnb 80px Top Navigation Bar */}
      <nav className="sticky top-0 z-40 h-20 bg-white border-b border-hairline-soft px-4 sm:px-8 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-[#fff0f2] flex items-center justify-center text-rausch shadow-sm">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg text-ink tracking-tight">
              auto-<span className="text-rausch">short</span>
            </span>
            <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-full bg-surface-soft text-muted text-[10px] font-bold border border-hairline-soft">
              Local Studio
            </span>
          </div>
        </div>

        {/* Center Product Tabs */}
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold">
          <span className="text-ink border-b-2 border-ink py-2 cursor-pointer">
            Shorts Studio
          </span>
          <button
            type="button"
            onClick={() => setIsHistoryModalOpen(true)}
            className="text-muted hover:text-ink py-2 cursor-pointer transition-colors"
          >
            History
          </button>
          <span className="text-muted hover:text-ink py-2 cursor-pointer transition-colors">
            Render Pipeline
          </span>
        </div>

        {/* Mobile-only History Icon Button (desktop uses the tab in Center Product Tabs) */}
        <button
          type="button"
          onClick={() => setIsHistoryModalOpen(true)}
          className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-full border border-hairline bg-white hover:bg-surface-soft text-ink transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-ink cursor-pointer"
          aria-label="Open Generation History"
        >
          <History className="w-4 h-4 text-rausch" />
        </button>

        {/* Right Settings Pill Button */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="inline-flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-full border border-hairline bg-white hover:bg-surface-soft text-ink text-xs font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-ink cursor-pointer"
          aria-label="Open Media Source and Type Settings"
          id="settings-open-button"
        >
          <Settings className="w-4 h-4 text-rausch" />
          <span className="hidden sm:inline">Settings</span>
          <span className="hidden sm:inline px-1.5 py-0.5 rounded-full bg-[#fff0f2] text-rausch text-[10px] font-bold border border-[#ffd1da]">
            {Object.values(mediaSettings?.sources || DEFAULT_MEDIA_SETTINGS.sources).filter(Boolean).length} Sources
          </span>
        </button>
      </nav>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-16">

        {/* Header Section */}
        <header className="flex flex-col items-center mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink mb-1">
            Auto Shorts Maker
          </h1>

          {/* Live configuration indicator badge */}
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-surface-soft border border-hairline-soft text-xs text-muted shadow-sm">
            <Sliders className="w-3.5 h-3.5 text-rausch" />
            <span className="font-medium text-ink">Filter:</span>
            <span className="font-bold text-ink capitalize">{(mediaSettings?.mediaType || 'both').replace(/_/g, ' ')}</span>
            <span className="text-hairline">•</span>
            <span className="font-medium text-ink">Sources:</span>
            <span className="font-bold text-ink">
              {Object.entries(mediaSettings?.sources || DEFAULT_MEDIA_SETTINGS.sources)
                .filter(([, enabled]) => enabled)
                .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1))
                .join(', ')}
            </span>
            <span className="text-hairline">•</span>
            <span className="font-medium text-ink">Overlay:</span>
            <span className="font-bold text-rausch capitalize">
              {mediaSettings?.textOverlayMode === 'graphics'
                ? 'Graphic Motion'
                : mediaSettings?.textOverlayMode === 'none'
                  ? 'None'
                  : `Captions (${mediaSettings?.captionPosition || 'bottom'})`}
            </span>
            <span className="text-hairline">•</span>
            <span className="font-medium text-ink">Avatar:</span>
            <span className={`font-bold ${mediaSettings.enableAvatarHost !== false ? 'text-emerald-700' : 'text-muted'}`}>
              {mediaSettings.enableAvatarHost !== false ? 'Active' : 'Off'}
            </span>
            <span className="text-hairline">•</span>
            <span className="font-medium text-ink">Zoom:</span>
            <span className="font-bold text-ink tabular-nums">{(mediaSettings.zoomSpeed ?? DEFAULT_MEDIA_SETTINGS.zoomSpeed).toFixed(1)}x</span>
            <span className="text-hairline">•</span>
            <span className="font-medium text-ink">Fade:</span>
            <span className="font-bold text-ink tabular-nums">{(mediaSettings.transitionDuration ?? DEFAULT_MEDIA_SETTINGS.transitionDuration).toFixed(1)}s</span>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="text-rausch hover:text-rausch-active ml-1 font-bold underline text-[11px] transition-colors"
            >
              Configure
            </button>
          </div>
        </header>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Column: Input and Setup */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            {/* Transcript input Panel */}
            <section className="airbnb-card p-6 shadow-sm border border-hairline bg-white">
              <h2 className="text-lg font-bold text-ink flex items-center gap-2 mb-5">
                <Sparkles className="w-4 h-4 text-rausch" />
                Enter Youtube Link
              </h2>

              {/* YouTube Import Option (Airbnb Signature Pill Search Bar) */}
              <div className="mb-6">
                <div className="flex items-center rounded-full border border-hairline bg-white shadow-airbnb p-1.5 pl-4 hover:shadow-airbnb-hover transition-all">
                  <div className="flex-grow flex items-center gap-2.5 min-w-0">
                    <svg className="w-5 h-5 text-red-600 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    <input
                      type="url"
                      placeholder="Paste YouTube video URL here..."
                      value={youtubeLink}
                      onChange={(e) => setYoutubeLink(e.target.value)}
                      disabled={isFetchingTranscript || isAnalyzing || isGenerating}
                      className="w-full bg-transparent text-sm text-ink placeholder-muted outline-none"
                    />
                  </div>

                  {/* Circular Rausch Search Orb Button */}
                  <button
                    type="button"
                    onClick={handleFetchTranscript}
                    disabled={isFetchingTranscript || isAnalyzing || isGenerating || !youtubeLink.trim()}
                    aria-label="Get Transcript"
                    title="Get Transcript"
                    className={`w-10 h-10 rounded-full font-bold flex items-center justify-center shrink-0 transition-all ${isFetchingTranscript
                        ? 'bg-rausch-disabled text-white cursor-not-allowed'
                        : !youtubeLink.trim()
                          ? 'bg-surface-soft text-muted cursor-not-allowed border border-hairline'
                          : 'bg-rausch hover:bg-rausch-active text-white shadow-sm active:scale-95'
                      }`}
                  >
                    {isFetchingTranscript ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {(youtubeLink || transcript || transcriptSegments.length > 0) && (
                  <button
                    type="button"
                    onClick={handleResetInput}
                    disabled={isFetchingTranscript || isAnalyzing || isGenerating}
                    className="mt-2 ml-4 inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-rausch transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Clear the YouTube link and transcript"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>

              {/* Target Video Length Input */}
              <div className="mb-5">
                <label className="block text-[11px] font-bold text-ink uppercase tracking-wider mb-2">
                  Target Video Length (seconds)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Clock className="w-4 h-4 text-rausch" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    step="0.1"
                    placeholder="Target duration in seconds (e.g. 32)..."
                    value={targetVideoLength}
                    onChange={(e) => handleTargetLengthChange(e.target.value)}
                    disabled={isAnalyzing || isGenerating}
                    className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-hairline bg-white text-ink placeholder-muted text-sm outline-none transition-all focus:border-ink"
                  />
                </div>
                <p className="text-[11px] text-muted mt-1">
                  Specifies the exact length of the final generated video. Existing scene durations scale dynamically.
                </p>
              </div>

              {/* Visual Divider */}
              <div className="relative flex py-2 items-center mb-4">
                <div className="flex-grow border-t border-hairline-soft"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold text-muted uppercase tracking-widest">
                  Or Enter Script Manually
                </span>
                <div className="flex-grow border-t border-hairline-soft"></div>
              </div>

              {/* Audio Timeline Sync Status Banner */}
              {transcriptSegments.length > 0 && (
                <div className="flex items-center justify-between px-3.5 py-2 mb-3 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-xs text-[#065f46] shadow-sm transition-all animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                    </span>
                    <span className="font-semibold">
                      Timeline Synced: <span className="font-bold tabular-nums">{transcriptSegments.length}</span> audio caption slices
                    </span>
                    <span className="text-emerald-700/80 hidden sm:inline">
                      (audio length: <span className="tabular-nums font-bold">{transcriptSegments[transcriptSegments.length - 1]?.end.toFixed(1)}s</span>)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTranscriptSegments([]);
                      setInfoMessage('Unlinked YouTube timeline sync. AI will now calculate scene timing using natural spoken rate estimation.');
                    }}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 underline font-semibold transition-colors ml-2"
                    title="Unlink segments to switch to speech rate estimation"
                  >
                    Unlink Sync
                  </button>
                </div>
              )}

              <textarea
                className="w-full h-44 rounded-xl border border-hairline p-4 text-ink placeholder-muted resize-none font-sans text-sm transition-all focus:border-ink outline-none bg-white"
                placeholder="Paste your Hindi, Urdu, or English transcript here..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                disabled={isAnalyzing || isGenerating}
              />

              <div className="mt-5 flex justify-center">
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || isGenerating || !transcript.trim()}
                  className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${isAnalyzing
                      ? 'bg-rausch-disabled text-white cursor-not-allowed'
                      : !transcript.trim()
                        ? 'bg-surface-soft text-muted cursor-not-allowed border border-hairline'
                        : 'bg-rausch hover:bg-rausch-active text-white shadow-airbnb active:scale-95'
                    }`}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyzing Script...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Analyze Transcript</span>
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Feedback Messages */}
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-[#fff5f5] p-4 text-[#c13515] flex items-start gap-3 shadow-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                <div>
                  <p className="font-bold text-sm">Execution Interrupted</p>
                  <p className="text-xs mt-1">{errorMessage}</p>
                </div>
              </div>
            )}

            {infoMessage && (
              <div className="rounded-xl border border-amber-200 bg-[#fffbeb] p-4 text-[#92400e] flex items-start gap-3 shadow-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <p className="font-bold text-sm">Notice</p>
                  <p className="text-xs mt-1">{infoMessage}</p>
                </div>
              </div>
            )}

            {/* Extracted/Matched Scenes Panel */}
            {scenes.length > 0 && (
              <section className="airbnb-card p-6 shadow-sm border border-hairline bg-white">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-rausch" />
                      2. Matched Visual Storyboard
                    </h2>
                    <p className="text-xs text-muted mt-0.5">
                      Review matching scenes and customize the storyboard before compiling.
                    </p>
                  </div>

                  <button
                    onClick={handleGenerateVideo}
                    disabled={isGenerating || isAnalyzing}
                    className={`px-5 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${isGenerating
                        ? 'bg-surface-soft text-muted border border-hairline cursor-not-allowed'
                        : 'bg-rausch hover:bg-rausch-active text-white'
                      }`}
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4" />
                        Generate Video
                      </>
                    )}
                  </button>
                </div>

                {/* Storyboard Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {scenes.map((scene, idx) => {
                    const sceneStart = sceneStartTimes[idx];
                    const sceneEnd = sceneStart + scene.duration;
                    const isCurrentPreview = activePreviewSceneIndex === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => setActivePreviewSceneIndex(idx)}
                        className={`rounded-2xl border bg-white overflow-hidden flex flex-col relative group hover:shadow-airbnb hover:border-border-strong transition-all cursor-pointer ${
                          isCurrentPreview
                            ? 'border-rausch ring-2 ring-rausch/30 shadow-md'
                            : 'border-hairline'
                        }`}
                      >

                        {/* Scene Media Preview (Video or Image or Dual Split Screen) */}
                        <div className="relative h-44 bg-surface-soft flex items-center justify-center overflow-hidden">
                          {scene.isSplitScreen && scene.avatarAsset ? (
                            /* Dual Split-Screen Preview (Top: Avatar Video, Bottom: Stock Media) */
                            <div className="w-full h-full flex flex-col relative">
                              <div className="h-1/2 w-full relative overflow-hidden bg-black/40 border-b border-white/40">
                                <video
                                  src={getMediaUrl(scene.avatarAsset)}
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  className="w-full h-full object-cover object-[50%_25%]"
                                />
                                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 text-white backdrop-blur-xs">
                                  Avatar Top
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReplaceHostClick(idx);
                                  }}
                                  className="absolute top-1 right-1 z-10 px-2 py-1 rounded-md bg-white/90 text-ink text-[10px] font-bold hover:bg-white shadow-sm flex items-center gap-1"
                                >
                                  <RefreshCw className="w-3 h-3" /> Change Host
                                </button>
                              </div>
                              <div className="h-1/2 w-full relative overflow-hidden bg-black/40">
                                {isVideoAsset(scene.image) ? (
                                  <video
                                    src={getMediaUrl(scene.image)}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={getMediaUrl(scene.image)}
                                    alt={scene.keyword}
                                    className="w-full h-full object-cover"
                                    onError={() => markImageBroken(idx)}
                                    onLoad={() => markImageLoaded(idx)}
                                  />
                                )}
                                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 text-white backdrop-blur-xs">
                                  Stock Bottom
                                </span>
                              </div>
                            </div>
                          ) : isVideoAsset(scene.image) ? (
                            <video
                              src={getMediaUrl(scene.image)}
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={getMediaUrl(scene.image)}
                              alt={scene.keyword}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={() => markImageBroken(idx)}
                              onLoad={() => markImageLoaded(idx)}
                            />
                          )}

                          {/* Broken/expired remote image notice — replaces the old silent 30% opacity fade */}
                          {brokenImageIndices.has(idx) && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-ink/80 text-center p-3">
                              <AlertCircle className="w-6 h-6 text-white" />
                              <p className="text-xs font-semibold text-white leading-snug">
                                Image failed to load
                              </p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReplaceClick(idx);
                                }}
                                className="mt-1 px-3 py-1.5 rounded-lg bg-white text-ink text-xs font-bold hover:bg-surface-soft transition-colors cursor-pointer"
                              >
                                Replace Image
                              </button>
                            </div>
                          )}

                          {/* Guest Favorite-Style Floating Badges (Top Left) */}
                          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white text-ink border border-hairline-soft shadow-sm backdrop-blur-md">
                                Scene {idx + 1}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900/80 text-white shadow-sm border border-white/20 backdrop-blur-md">
                                {mediaSettings.aspectRatio === '16:9' ? '16:9' : '9:16'}
                              </span>
                              {scene.isAvatarScene ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-700 text-white shadow-sm flex items-center gap-1">
                                  🎙️ Avatar Hook
                                </span>
                              ) : scene.isSplitScreen ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white shadow-sm flex items-center gap-1">
                                  ⚡ Split Screen
                                </span>
                              ) : isVideoAsset(scene.image) ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rausch text-white shadow-sm flex items-center gap-1">
                                  <Film className="w-2.5 h-2.5" /> Video
                                </span>
                              ) : null}
                            </div>

                            {scene.isFallback ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 shadow-sm">
                                Fallback Match
                              </span>
                            ) : scene.matchedTier === "mood" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-200 shadow-sm">
                                Atmospheric Match
                              </span>
                            ) : scene.matchedTier === "fallback" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 shadow-sm">
                                Alt Shot Match
                              </span>
                            ) : null}
                          </div>

                          {/* Top Right Preview Status / Trigger */}
                          <div className="absolute top-2.5 right-2.5 z-10">
                            {isCurrentPreview ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rausch text-white shadow-sm flex items-center gap-1 animate-fadeIn">
                                ● Previewing
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 hover:bg-black/85 text-white backdrop-blur-md border border-white/20 shadow-sm transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                👁️ Preview
                              </span>
                            )}
                          </div>

                          {/* Duration Pill (Bottom Right) */}
                          <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1.5 tabular-nums shadow-sm">
                            <Clock className="w-3 h-3 text-white" />
                            <span className="font-bold">{scene.duration.toFixed(1)}s</span>
                            <span className="text-zinc-300 text-[10px]">({sceneStart.toFixed(1)}s - {sceneEnd.toFixed(1)}s)</span>
                          </div>
                        </div>

                        {/* Metadata & Actions */}
                        <div className="p-4 flex flex-col justify-between flex-grow bg-white">
                          <div className="mb-3">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-[10px] tracking-wider uppercase font-bold text-muted block">
                                {mediaSettings.useRelatableVisualSearch !== false ? "Scene Concept" : "Keyword Match"}
                              </span>
                              <div className="flex items-center gap-1.5 relative">
                                {/* Interactive 3D Emoji Chip */}
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setActiveEmojiPickerIdx(activeEmojiPickerIdx === idx ? null : idx)}
                                    title="Click to customize scene 3D emoji"
                                    className="px-2 py-0.5 rounded-full text-xs bg-[#fff0f2] border border-[#ffd1da] hover:border-rausch text-ink flex items-center gap-1 font-bold transition-all shadow-xs active:scale-95"
                                  >
                                    <span className="text-sm leading-none">{scene.emoji || '✨'}</span>
                                    <span className="text-[9px] uppercase font-bold text-rausch">Emoji</span>
                                  </button>

                                  {/* Quick Emoji Popover */}
                                  {activeEmojiPickerIdx === idx && (
                                    <div className="absolute right-0 top-full mt-1.5 z-30 p-2.5 rounded-xl bg-white border border-hairline shadow-airbnb w-52 flex flex-col gap-1.5">
                                      <div className="flex items-center justify-between border-b border-hairline-soft pb-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink">Choose 3D Emoji</span>
                                        <button
                                          type="button"
                                          onClick={() => setActiveEmojiPickerIdx(null)}
                                          className="text-xs text-muted hover:text-ink font-bold px-1"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                                        {QUICK_EMOJIS.map((em) => (
                                          <button
                                            key={em}
                                            type="button"
                                            onClick={() => handleSelectSceneEmoji(idx, em)}
                                            className={`h-9 rounded-lg text-lg flex items-center justify-center transition-all hover:scale-125 ${scene.emoji === em ? 'bg-[#fff0f2] border border-rausch' : 'hover:bg-surface-soft'
                                              }`}
                                          >
                                            {em}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {scene.matchedTier && scene.matchedTier !== "legacy" && scene.matchedTier !== "random" && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    {scene.matchedTier} match
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-bold text-ink truncate block capitalize">
                              {scene.keyword || 'Random Scene'}
                            </span>

                            {/* Relatable Visual Shot Description if available */}
                            {mediaSettings.useRelatableVisualSearch !== false && scene.visualQuery && (
                              <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-[#fff8f9] border border-[#ffd1da] text-[11px] text-ink flex items-start gap-1.5 shadow-sm">
                                <span className="text-rausch font-bold shrink-0 text-[10px] uppercase">Shot:</span>
                                <span className="font-medium italic truncate" title={scene.visualQuery}>
                                  “{scene.visualQuery}”
                                </span>
                              </div>
                            )}

                            <span className="text-xs text-muted truncate block mt-1.5 opacity-80" title={scene.image}>
                              {scene.image}
                            </span>

                            {/* Overlay Section based on mutually exclusive textOverlayMode */}
                            {mediaSettings.textOverlayMode === 'captions' && scene.captions && scene.captions.length > 0 && (
                              <div className="mt-2.5 flex flex-col gap-1">
                                {scene.captions.map((c, cIdx) => {
                                  const absStart = sceneStart + c.start;
                                  return (
                                    <div key={cIdx} className="px-2.5 py-1.5 rounded-lg bg-surface-soft border border-hairline text-[11px] font-medium text-ink flex items-center justify-between gap-2 shadow-xs">
                                      <span className="truncate italic">“{c.text}”</span>
                                      <span className="shrink-0 text-[10px] text-muted tabular-nums ml-1">
                                        +{c.start.toFixed(1)}s <span className="text-muted">(at {absStart.toFixed(1)}s)</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {mediaSettings.textOverlayMode === 'graphics' && scene.graphics && scene.graphics.length > 0 && (
                              <div className="mt-2.5 flex flex-col gap-1">
                                {scene.graphics.map((g, gIdx) => {
                                  const absStart = sceneStart + g.start;
                                  return (
                                    <div key={gIdx} className="px-2.5 py-1.5 rounded-lg bg-[#fff8f9] border border-[#ffd1da] text-[11px] font-semibold text-ink flex items-center justify-between gap-1.5 shadow-xs">
                                      <div className="flex items-center gap-1 truncate">
                                        {g.prefixText && <span className="text-muted font-normal">{g.prefixText}</span>}
                                        <span className="text-rausch font-bold uppercase bg-[#fff0f2] px-1 rounded">{g.heroWord}</span>
                                        {g.suffixText && <span className="text-muted font-normal">{g.suffixText}</span>}
                                      </div>
                                      <span className="shrink-0 text-[10px] text-muted font-medium tabular-nums ml-1">
                                        +{g.start.toFixed(1)}s <span className="text-muted">(at {absStart.toFixed(1)}s)</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Spiritual Dua Card Highlight if present */}
                            {scene.duaInfo?.isDua ? (
                              <div className="mt-2.5 p-2.5 rounded-xl border border-[#E2D3B3] bg-[#FAF6ED] flex flex-col gap-1 shadow-xs">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8C682A]">
                                    <BookOpen className="w-3 h-3 text-[#8C682A]" />
                                    <span>🤲 Dua Card</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDuaEditor(idx)}
                                    className="text-[10px] font-bold text-rausch hover:underline flex items-center gap-0.5"
                                  >
                                    <Edit3 className="w-2.5 h-2.5" /> Edit / Preview
                                  </button>
                                </div>
                                <div className="text-xs font-bold text-[#1E293B] leading-tight line-clamp-2">
                                  {scene.duaInfo.hindi}
                                </div>
                                <div className="text-xs font-semibold text-[#064E3B] text-right dir-rtl leading-snug line-clamp-2 font-arabic">
                                  {scene.duaInfo.arabic}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDuaEditor(idx)}
                                  className="text-[10px] font-semibold text-muted hover:text-rausch transition-colors flex items-center gap-1"
                                >
                                  <BookOpen className="w-2.5 h-2.5" /> + Add Dua Card
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Save-locally button for scenes still pointing at a live remote (Pexels/Unsplash/Pixabay) URL */}
                          {isRemoteUrl(scene.image) && (
                            <button
                              onClick={() => handleSaveImageLocally(idx)}
                              disabled={savingLocallyIndices.has(idx)}
                              className="w-full mb-2 py-2 rounded-lg border border-[#ffd1da] bg-[#fff8f9] text-xs font-bold text-rausch hover:bg-[#fff0f2] transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                              title="Download this online media into your local library"
                            >
                              {savingLocallyIndices.has(idx) ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                              {savingLocallyIndices.has(idx) ? 'Saving Locally…' : 'Save Locally'}
                            </button>
                          )}

                          {/* Secondary Button: Replace Image */}
                          <button
                            onClick={() => handleReplaceClick(idx)}
                            className="w-full py-2 rounded-lg border border-hairline bg-white text-xs font-bold text-ink hover:bg-surface-soft hover:border-border-strong transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Replace Image
                          </button>
                          {scene.isSplitScreen && scene.avatarAsset && (
                            <button
                              onClick={() => handleReplaceHostClick(idx)}
                              className="w-full mt-2 py-2 rounded-lg border border-hairline bg-white text-xs font-bold text-ink hover:bg-surface-soft hover:border-border-strong transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Replace Host
                            </button>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          </div>

          {/* Right Column: Generation Progress & Preview (Reservation Card Style) */}
          <div className="lg:col-span-5 flex flex-col gap-6 sticky top-24">

            {/* Compilation Load State */}
            {isGenerating && (
              <section className="airbnb-card p-6 flex flex-col items-center justify-center text-center shadow-airbnb border border-hairline bg-white">
                <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-[#ffd1da] border-t-rausch animate-spin" />
                  <Film className="w-8 h-8 text-rausch animate-pulse" />
                </div>

                <h3 className="text-lg font-bold text-ink mb-1">Compiling Vertical Short</h3>

                {/* Battery-like progress meter with Rausch branding */}
                <div className="flex items-center justify-center gap-1.5 my-3">
                  <div className="relative w-24 h-8 border-2 border-rausch rounded-lg p-1 flex gap-1 bg-surface-soft shadow-sm">
                    {/* Bar 1 */}
                    <div className={`flex-1 h-full rounded-sm transition-all duration-500 ${pollCount >= 1
                        ? 'bg-rausch opacity-100'
                        : 'bg-hairline opacity-40'
                      }`} />
                    {/* Bar 2 */}
                    <div className={`flex-1 h-full rounded-sm transition-all duration-500 ${pollCount >= 2
                        ? 'bg-rausch opacity-100'
                        : 'bg-hairline opacity-40'
                      }`} />
                    {/* Bar 3 */}
                    <div className={`flex-1 h-full rounded-sm transition-all duration-500 ${pollCount >= 3
                        ? 'bg-rausch opacity-100'
                        : 'bg-hairline opacity-40'
                      }`} />
                  </div>
                  {/* Battery tip */}
                  <div className="w-1.5 h-3 bg-rausch rounded-r-sm shadow-sm" />
                </div>

                <p className="text-muted text-xs max-w-xs">{generationStep}</p>

                <button
                  onClick={handleCancelGeneration}
                  disabled={isCancelling}
                  className="mt-4 px-4 py-1.5 rounded-lg text-xs font-bold text-muted border border-hairline hover:bg-surface-soft transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel'}
                </button>
              </section>
            )}

            {/* Storyboard Live Preview Player (When scenes exist and not compiling, and either no final video yet or preview tab is active) */}
            {scenes.length > 0 && !isGenerating && (!videoUrl || activeRightPanelTab === 'preview') && (
              <SceneLivePreviewPlayer
                scenes={scenes}
                activeSceneIndex={activePreviewSceneIndex}
                onSelectScene={setActivePreviewSceneIndex}
                mediaSettings={mediaSettings}
                onChangeCaptionPosition={(pos) => handleSaveSettings({ ...mediaSettings, captionPosition: pos })}
                onOpenDuaEditor={handleOpenDuaEditor}
                onGenerateVideo={handleGenerateVideo}
                isGenerating={isGenerating}
              />
            )}

            {/* Empty Video Preview State (When no scenes analyzed yet) */}
            {scenes.length === 0 && !videoUrl && !isGenerating && isAnalyzing && (
              <section className="rounded-2xl border border-dashed border-hairline p-8 text-center flex flex-col items-center justify-center h-[480px] bg-surface-soft/40 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-white border border-hairline flex items-center justify-center mb-4 shadow-airbnb">
                  <div className="w-6 h-6 rounded-full border-2 border-[#ffd1da] border-t-rausch animate-spin" />
                </div>
                <h3 className="text-base font-bold text-ink mb-1">Analyzing Transcript…</h3>
                <p className="text-xs text-muted max-w-[240px]">
                  Breaking your transcript into scenes and matching visuals — this can take a moment.
                </p>
              </section>
            )}

            {scenes.length === 0 && !videoUrl && !isGenerating && !isAnalyzing && (
              <section className="rounded-2xl border border-dashed border-hairline p-8 text-center flex flex-col items-center justify-center h-[480px] bg-surface-soft/40 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-white border border-hairline flex items-center justify-center mb-4 shadow-airbnb">
                  <Play className="w-6 h-6 text-muted" />
                </div>
                <h3 className="text-base font-bold text-ink mb-1">
                  {mediaSettings.aspectRatio === '16:9' ? 'Widescreen Video Player' : 'Shorts Video Player'}
                </h3>
                <p className="text-xs text-muted max-w-[240px]">
                  {mediaSettings.aspectRatio === '16:9'
                    ? 'Analyze your transcript, review visual storyboard matches, and compile your 16:9 widescreen video.'
                    : 'Analyze your transcript, review visual storyboard matches, and compile your 9:16 vertical short.'}
                </p>
              </section>
            )}

            {/* Compiled Video Preview and Action Panel (When video is generated and compiled tab is active) */}
            {videoUrl && !isGenerating && activeRightPanelTab === 'compiled' && (
              <section className="airbnb-card p-6 shadow-airbnb border border-hairline bg-white flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                    <Play className="w-4 h-4 text-rausch" />
                    Compiled Video
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveRightPanelTab('preview')}
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-surface-soft text-ink hover:bg-hairline-soft transition-all border border-hairline cursor-pointer"
                    >
                      📱 Storyboard Preview
                    </button>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rausch/10 text-rausch border border-rausch/20">
                      {mediaSettings.aspectRatio || '9:16'}
                    </span>
                  </div>
                </div>

                {/* Responsive Video Screen */}
                <div className={`relative w-full ${mediaSettings.aspectRatio === '16:9'
                    ? 'max-w-[420px] aspect-[16/9]'
                    : 'max-w-[280px] aspect-[9/16]'
                  } rounded-2xl overflow-hidden border border-hairline bg-black shadow-airbnb`}>
                  <video
                    src={videoUrl}
                    controls
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Download actions */}
                <div className="w-full mt-6 flex flex-col gap-3">
                  <div className="rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] p-3 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-emerald-900">Video successfully generated!</p>
                      <p className="text-[10px] text-emerald-700 truncate mt-0.5">{savedVideoFilename}</p>
                    </div>
                  </div>

                  <a
                    href={videoUrl ? `${videoUrl}&download=true` : ''}
                    download={savedVideoFilename}
                    className="w-full py-3.5 rounded-lg font-bold text-sm bg-rausch hover:bg-rausch-active text-white flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98"
                  >
                    <Download className="w-4 h-4" />
                    Download MP4
                  </a>
                </div>
              </section>
            )}

            {/* Quick Switcher back to compiled video if in preview tab */}
            {videoUrl && !isGenerating && activeRightPanelTab === 'preview' && (
              <div className="w-full p-3 rounded-xl bg-surface-soft border border-hairline flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-ink">🎬 Final video has been compiled.</span>
                <button
                  type="button"
                  onClick={() => setActiveRightPanelTab('compiled')}
                  className="px-3 py-1.5 rounded-lg bg-rausch text-white font-bold hover:bg-rausch-active transition-all shadow-xs cursor-pointer"
                >
                  View Final Video
                </button>
              </div>
            )}

          </div>

        </div>

        {/* Searchable Replace Image Selection Modal */}
        <ReplaceImageModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setReplacingIndex(null);
            setReplacingTarget('image');
          }}
          onSelectImage={handleSelectImage}
          allImages={
            replacingTarget === 'host' ? hostVideos : allLibraryImages
          }
          title={replacingTarget === 'host' ? 'Select Replacement Host' : undefined}
          currentImage={
            replacingIndex !== null && scenes[replacingIndex]
              ? replacingTarget === 'host'
                ? scenes[replacingIndex].avatarAsset
                : scenes[replacingIndex].image
              : undefined
          }
          sceneIndex={replacingIndex}
          sceneKeyword={replacingIndex !== null && scenes[replacingIndex] ? scenes[replacingIndex].keyword : undefined}
          onLibraryRefresh={fetchLibraryImages}
        />

        {/* Settings Configuration Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={mediaSettings}
          onSave={handleSaveSettings}
        />

        {/* Islamic Dua Card Editor & Live Preview Modal */}
        <DuaEditModal
          isOpen={isDuaModalOpen}
          onClose={() => {
            setIsDuaModalOpen(false);
            setEditingDuaSceneIdx(null);
          }}
          sceneIndex={editingDuaSceneIdx}
          sceneKeyword={editingDuaSceneIdx !== null && scenes[editingDuaSceneIdx] ? scenes[editingDuaSceneIdx].keyword : undefined}
          initialDua={editingDuaSceneIdx !== null && scenes[editingDuaSceneIdx] ? scenes[editingDuaSceneIdx].duaInfo : undefined}
          cardTheme={mediaSettings.duaCardTheme || 'cream'}
          cardPosition={mediaSettings.duaCardPosition || 'center'}
          aspectRatio={mediaSettings.aspectRatio || '9:16'}
          onSaveDua={handleSaveDua}
        />

        {/* Generation History Panel */}
        <HistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          storageMode={mediaSettings.historyStorageMode || 'server'}
        />
      </main>
    </div>
  );
}
