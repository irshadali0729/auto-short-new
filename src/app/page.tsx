'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  Play, 
  Download, 
  AlertCircle, 
  RefreshCw,
  Film,
  CheckCircle2,
  Clock,
  Sliders,
  Settings,
  MessageSquareText,
  Type,
  BookOpen,
  Edit3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import SettingsModal, { 
  MediaSettings, 
  DEFAULT_MEDIA_SETTINGS 
} from '@/app/components/SettingsModal';
import ReplaceImageModal from '@/app/components/ReplaceImageModal';
import DuaEditModal from '@/app/components/DuaEditModal';
import { DuaInfo } from '@/app/utils/dua-card-svg';
import { getMediaUrl, isVideoAsset } from '@/app/utils/media-url';

interface GraphicBeat {
  prefixText?: string;
  heroWord: string;
  suffixText?: string;
  style?: "stacked-kinetic" | "top-hero" | "thought-bubble" | "breakdown-card";
  text?: string;
  accent?: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
  end: number;
}

export interface CaptionSlice {
  text: string;
  start: number;
  end: number;
  emoji?: string;
}

interface Scene {
  keyword: string;
  duration: number;
  image: string;
  isFallback: boolean;
  isHostScene?: boolean;
  isSplitScreen?: boolean;
  hostAsset?: string;
  stockAsset?: string;
  visualQuery?: string;
  fallbackQuery?: string;
  moodQuery?: string;
  matchedTier?: "visual" | "fallback" | "mood" | "local" | "random" | "legacy";
  matchedQuery?: string;
  emoji?: string;
  graphics?: GraphicBeat[];
  captions?: CaptionSlice[];
  duaInfo?: DuaInfo;
}




export default function Home() {
  const [transcript, setTranscript] = useState('');
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [youtubeLink, setYoutubeLink] = useState('');
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [targetVideoLength, setTargetVideoLength] = useState<number | ''>(30);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [pollCount, setPollCount] = useState<number>(0);

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
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Dua Edit Modal state
  const [editingDuaSceneIdx, setEditingDuaSceneIdx] = useState<number | null>(null);
  const [isDuaModalOpen, setIsDuaModalOpen] = useState(false);

  // Accordion expansion state for scene overlays (captions / graphics / dua)
  const [expandedCaptions, setExpandedCaptions] = useState<Record<number, boolean>>({});
  const [expandedGraphics, setExpandedGraphics] = useState<Record<number, boolean>>({});
  const [expandedDua, setExpandedDua] = useState<Record<number, boolean>>({});

  const toggleCaptionsAccordion = (sceneIdx: number) => {
    setExpandedCaptions((prev) => ({
      ...prev,
      [sceneIdx]: prev[sceneIdx] === undefined ? false : !prev[sceneIdx],
    }));
  };

  const toggleGraphicsAccordion = (sceneIdx: number) => {
    setExpandedGraphics((prev) => ({
      ...prev,
      [sceneIdx]: prev[sceneIdx] === undefined ? false : !prev[sceneIdx],
    }));
  };

  const toggleDuaAccordion = (sceneIdx: number) => {
    setExpandedDua((prev) => ({
      ...prev,
      [sceneIdx]: prev[sceneIdx] === undefined ? false : !prev[sceneIdx],
    }));
  };

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
      const currentSum = scenes.reduce((acc, s) => acc + s.duration, 0);
      if (currentSum > 0) {
        const updatedScenes = scenes.map(s => ({
          ...s,
          duration: Number((s.duration * (num / currentSum)).toFixed(2))
        }));
        // Correct rounding error on the last scene
        const newSum = updatedScenes.reduce((acc, s) => acc + s.duration, 0);
        const difference = num - newSum;
        if (Math.abs(difference) > 0.001 && updatedScenes.length > 0) {
          updatedScenes[updatedScenes.length - 1].duration = Number((updatedScenes[updatedScenes.length - 1].duration + difference).toFixed(2));
        }
        setScenes(updatedScenes);
      }
    }
  };

  const handleReplaceClick = (index: number) => {
    setReplacingIndex(index);
    setIsModalOpen(true);
  };

  const handleSelectImage = (filename: string) => {
    if (replacingIndex !== null) {
      const updatedScenes = [...scenes];
      updatedScenes[replacingIndex] = {
        ...updatedScenes[replacingIndex],
        image: filename,
        isFallback: false // Reset fallback status since it is manually selected
      };
      setScenes(updatedScenes);
      setIsModalOpen(false);
      setReplacingIndex(null);
    }
  };

  const handleGenerateVideo = async () => {
    if (scenes.length === 0) return;

    setErrorMessage('');
    setIsGenerating(true);
    setVideoUrl('');
    setPollCount(0);
    setGenerationStep('Initializing background video compilation worker...');

    const runId = 'run_' + Date.now();

    try {
      const initRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scenes,
          runId,
          zoomSpeed: mediaSettings.zoomSpeed ?? 1.0,
          transitionDuration: mediaSettings.transitionDuration ?? 0.3,
          textOverlayMode: mediaSettings.textOverlayMode || (mediaSettings.enableGraphicMotion ? 'graphics' : 'captions'),
          captionPosition: mediaSettings.captionPosition || 'bottom',
          enableGraphicMotion: mediaSettings.textOverlayMode === 'graphics',
          enableCaptions: mediaSettings.textOverlayMode === 'captions',
          aspectRatio: mediaSettings.aspectRatio || '9:16',
          enableEmojiCaptions: mediaSettings.enableEmojiCaptions !== false,
          emojiStyle: mediaSettings.emojiStyle || 'fluent',
          enableDuaOverlay: mediaSettings.enableDuaOverlay !== false,
          duaCardTheme: mediaSettings.duaCardTheme || 'cream',
          enableVideoHost: mediaSettings.enableVideoHost !== false,
          videoHostType: mediaSettings.videoHostType || 'women_host',
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok) {
        throw new Error(initData.error || 'Failed to initialize video generation.');
      }

      setGenerationStep('Processing video clips in background...');

      let localPollCount = 0;
      // Polling interval set to 30 seconds (30000ms)
      const pollInterval = setInterval(async () => {
        try {
          localPollCount++;
          setPollCount(localPollCount);

          const progRes = await fetch(`/api/generate-video/progress?runId=${runId}`);
          if (!progRes.ok) {
            console.error('Failed to query progress status.');
            return;
          }
          const progData = await progRes.json();

          if (progData.complete) {
            clearInterval(pollInterval);
            setIsGenerating(false);
            setGenerationStep('');
            if (progData.error) {
              setErrorMessage(progData.error);
            } else if (progData.videoPath) {
              setVideoUrl(progData.videoPath);
            } else {
              setErrorMessage('Video generation completed, but output path was not returned.');
            }
          } else {
            // Update UI subtext for each poll count
            if (localPollCount === 1) {
              setGenerationStep('Check 1 (30s): Still rendering scene clips...');
            } else if (localPollCount === 2) {
              setGenerationStep('Check 2 (60s): Merging video tracks...');
            } else if (localPollCount === 3) {
              setGenerationStep('Check 3 (90s): Finalizing compile files...');
            } else {
              setGenerationStep(`Check ${localPollCount} (${localPollCount * 30}s): Final steps...`);
            }
          }
        } catch (pollErr) {
          console.error('Error polling background job status:', pollErr);
        }
      }, 30000);

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Video generation failed to start.';
      setErrorMessage(errMsg);
      setIsGenerating(false);
      setGenerationStep('');
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
              Hadith <span className="text-rausch">Shorts</span>
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
          <span className="text-muted hover:text-ink py-2 cursor-pointer transition-colors">
            Media Library
          </span>
          <span className="text-muted hover:text-ink py-2 cursor-pointer transition-colors">
            Render Pipeline
          </span>
        </div>

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
            Hadith Shorts Maker
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
                .filter(([_, enabled]) => enabled)
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
            <span className="font-medium text-ink">Host:</span>
            <span className={`font-bold ${mediaSettings.enableVideoHost !== false ? 'text-emerald-700' : 'text-muted'}`}>
              {mediaSettings.enableVideoHost !== false ? 'Active' : 'Off'}
            </span>
            <span className="text-hairline">•</span>
            <span className="font-medium text-ink">Zoom:</span>
            <span className="font-bold text-ink tabular-nums">{(mediaSettings.zoomSpeed ?? 1.0).toFixed(1)}x</span>
            <span className="text-hairline">•</span>
            <span className="font-medium text-ink">Fade:</span>
            <span className="font-bold text-ink tabular-nums">{(mediaSettings.transitionDuration ?? 0.3).toFixed(1)}s</span>
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
                    className={`w-10 h-10 rounded-full font-bold flex items-center justify-center shrink-0 transition-all ${
                      isFetchingTranscript
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
                  className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                    isAnalyzing 
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
                    className={`px-5 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                      isGenerating 
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
                        Generate Shorts Video
                      </>
                    )}
                  </button>
                </div>

                {/* Storyboard Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {scenes.map((scene, idx) => {
                    const sceneStart = scenes.slice(0, idx).reduce((acc, s) => acc + s.duration, 0);
                    const sceneEnd = sceneStart + scene.duration;
                    return (
                    <div key={idx} className="rounded-2xl border border-hairline bg-white overflow-hidden flex flex-col relative group hover:shadow-airbnb hover:border-border-strong transition-all">
                      
                      {/* Scene Media Preview (Video or Image or Dual Split Screen) */}
                      <div className="relative h-44 bg-surface-soft flex items-center justify-center overflow-hidden">
                        {scene.isSplitScreen && scene.hostAsset ? (
                          /* Dual Split-Screen Preview (Top: Host Video, Bottom: Stock Media) */
                          <div className="w-full h-full flex flex-col relative">
                            <div className="h-1/2 w-full relative overflow-hidden bg-black/40 border-b border-white/40">
                              <video
                                src={getMediaUrl(scene.hostAsset)}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 text-white backdrop-blur-xs">
                                Host Top
                              </span>
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
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.opacity = '0.3';
                                  }}
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
                            onError={(e) => {
                              (e.target as HTMLElement).style.opacity = '0.3';
                            }}
                          />
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
                            {scene.isHostScene ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-700 text-white shadow-sm flex items-center gap-1">
                                🎙️ Host Hook
                              </span>
                            ) : scene.isSplitScreen ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white shadow-sm flex items-center gap-1">
                                ⚡ Split Screen
                              </span>
                            ) : /\.(mp4|webm|mov)$/i.test(scene.image) ? (
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
                          ) : scene.matchedTier === "local" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-sm">
                              Local Match
                            </span>
                          ) : null}
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
                                          className={`h-9 rounded-lg text-lg flex items-center justify-center transition-all hover:scale-125 ${
                                            scene.emoji === em ? 'bg-[#fff0f2] border border-rausch' : 'hover:bg-surface-soft'
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
                          {mediaSettings.textOverlayMode === 'captions' ? (
                            scene.captions && scene.captions.length > 0 ? (() => {
                              const isCaptionsOpen = expandedCaptions[idx] !== undefined ? expandedCaptions[idx] : false;
                              return (
                                <div className="mt-2.5 pt-2 border-t border-hairline-soft flex flex-col gap-1.5">
                                  {/* Accordion Header */}
                                  <button
                                    type="button"
                                    onClick={() => toggleCaptionsAccordion(idx)}
                                    className="w-full flex items-center justify-between p-1 rounded-md hover:bg-emerald-50/80 text-[9px] font-bold uppercase tracking-wider text-emerald-700 transition-all cursor-pointer select-none"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <MessageSquareText className="w-3 h-3 text-emerald-700" />
                                      <span>Spoken Captions (Synced)</span>
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[8px] font-extrabold border border-emerald-200">
                                        {scene.captions.length}
                                      </span>
                                    </span>
                                    <span className="flex items-center gap-1 text-[9px] text-emerald-600 font-semibold">
                                      <span>{isCaptionsOpen ? 'Hide' : 'Show All'}</span>
                                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isCaptionsOpen ? 'rotate-180' : ''}`} />
                                    </span>
                                  </button>

                                  {/* Accordion Body */}
                                  {isCaptionsOpen ? (
                                    <div className="flex flex-col gap-1 animate-in fade-in duration-150">
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
                                  ) : (
                                    /* Collapsed compact 1-line teaser */
                                    <div
                                      onClick={() => toggleCaptionsAccordion(idx)}
                                      className="px-2.5 py-1.5 rounded-lg bg-surface-soft/80 border border-hairline text-[11px] font-medium text-ink flex items-center justify-between gap-2 shadow-xs cursor-pointer hover:bg-surface-soft transition-colors"
                                    >
                                      <span className="truncate italic text-muted">
                                        “{scene.captions[0]?.text || '...'}”
                                      </span>
                                      {scene.captions.length > 1 && (
                                        <span className="shrink-0 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                          +{scene.captions.length - 1} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })() : null
                          ) : mediaSettings.textOverlayMode === 'graphics' ? (
                            scene.graphics && scene.graphics.length > 0 ? (() => {
                              const isGraphicsOpen = expandedGraphics[idx] !== undefined ? expandedGraphics[idx] : false;
                              return (
                                <div className="mt-2.5 pt-2 border-t border-hairline-soft flex flex-col gap-1.5">
                                  {/* Accordion Header */}
                                  <button
                                    type="button"
                                    onClick={() => toggleGraphicsAccordion(idx)}
                                    className="w-full flex items-center justify-between p-1 rounded-md hover:bg-[#fff0f2] text-[9px] font-bold uppercase tracking-wider text-rausch transition-all cursor-pointer select-none"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <Sparkles className="w-3 h-3 text-rausch" />
                                      <span>Kinetic Graphics</span>
                                      <span className="px-1.5 py-0.2 rounded bg-[#fff0f2] text-rausch text-[8px] font-extrabold border border-[#ffd1da]">
                                        {scene.graphics.length}
                                      </span>
                                    </span>
                                    <span className="flex items-center gap-1 text-[9px] text-rausch font-semibold">
                                      <span>{isGraphicsOpen ? 'Hide' : 'Show All'}</span>
                                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isGraphicsOpen ? 'rotate-180' : ''}`} />
                                    </span>
                                  </button>

                                  {/* Accordion Body */}
                                  {isGraphicsOpen ? (
                                    <div className="flex flex-col gap-1 animate-in fade-in duration-150">
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
                                  ) : (
                                    /* Collapsed compact 1-line teaser */
                                    <div
                                      onClick={() => toggleGraphicsAccordion(idx)}
                                      className="px-2.5 py-1.5 rounded-lg bg-[#fff8f9]/70 border border-[#ffd1da] text-[11px] font-semibold text-ink flex items-center justify-between gap-1.5 shadow-xs cursor-pointer hover:bg-[#fff8f9] transition-colors"
                                    >
                                      <span className="text-rausch font-bold uppercase bg-[#fff0f2] px-1 rounded truncate">
                                        {scene.graphics[0]?.heroWord || 'FOCUS'}
                                      </span>
                                      {scene.graphics.length > 1 && (
                                        <span className="shrink-0 text-[9px] font-bold text-rausch bg-white px-1.5 py-0.5 rounded border border-[#ffd1da]">
                                          +{scene.graphics.length - 1} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })() : null
                          ) : null}

                          {/* Spiritual Dua Card Highlight if present (with Accordion) */}
                          {scene.duaInfo?.isDua ? (() => {
                            const isDuaOpen = expandedDua[idx] !== undefined ? expandedDua[idx] : true;
                            return (
                              <div className="mt-2.5 p-2.5 rounded-xl border border-[#E2D3B3] bg-[#FAF6ED] flex flex-col gap-1.5 shadow-xs">
                                <div className="flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleDuaAccordion(idx)}
                                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8C682A] hover:opacity-80 transition-opacity cursor-pointer select-none"
                                  >
                                    <BookOpen className="w-3 h-3 text-[#8C682A]" />
                                    <span>🤲 Dua Card</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDuaOpen ? 'rotate-180' : ''}`} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDuaEditor(idx)}
                                    className="text-[10px] font-bold text-rausch hover:underline flex items-center gap-0.5"
                                  >
                                    <Edit3 className="w-2.5 h-2.5" /> Edit / Preview
                                  </button>
                                </div>

                                {isDuaOpen ? (
                                  <div className="flex flex-col gap-1 animate-in fade-in duration-150">
                                    <div className="text-xs font-bold text-[#1E293B] leading-tight line-clamp-2">
                                      {scene.duaInfo.hindi}
                                    </div>
                                    <div className="text-xs font-semibold text-[#064E3B] text-right dir-rtl leading-snug line-clamp-2 font-arabic">
                                      {scene.duaInfo.arabic}
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => toggleDuaAccordion(idx)}
                                    className="text-[11px] font-medium text-[#1E293B]/70 truncate italic cursor-pointer"
                                  >
                                    {scene.duaInfo.hindi}
                                  </div>
                                )}
                              </div>
                            );
                          })() : (
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

                        {/* Secondary Button: Replace Image */}
                        <button
                          onClick={() => handleReplaceClick(idx)}
                          className="w-full py-2 rounded-lg border border-hairline bg-white text-xs font-bold text-ink hover:bg-surface-soft hover:border-border-strong transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Replace Image
                        </button>
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
                    <div className={`flex-1 h-full rounded-sm transition-all duration-500 ${
                      pollCount >= 1 
                        ? 'bg-rausch opacity-100' 
                        : 'bg-hairline opacity-40'
                    }`} />
                    {/* Bar 2 */}
                    <div className={`flex-1 h-full rounded-sm transition-all duration-500 ${
                      pollCount >= 2 
                        ? 'bg-rausch opacity-100' 
                        : 'bg-hairline opacity-40'
                    }`} />
                    {/* Bar 3 */}
                    <div className={`flex-1 h-full rounded-sm transition-all duration-500 ${
                      pollCount >= 3 
                        ? 'bg-rausch opacity-100' 
                        : 'bg-hairline opacity-40'
                    }`} />
                  </div>
                  {/* Battery tip */}
                  <div className="w-1.5 h-3 bg-rausch rounded-r-sm shadow-sm" />
                </div>

                <p className="text-muted text-xs max-w-xs">{generationStep}</p>
              </section>
            )}

            {/* Empty Video Preview State */}
            {!videoUrl && !isGenerating && (
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

            {/* Video Preview and Action Panel */}
            {videoUrl && !isGenerating && (
              <section className="airbnb-card p-6 shadow-airbnb border border-hairline bg-white flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                    <Play className="w-4 h-4 text-rausch" />
                    Preview & Download
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rausch/10 text-rausch border border-rausch/20">
                    {mediaSettings.aspectRatio || '9:16'}
                  </span>
                </div>

                {/* Responsive Video Screen */}
                <div className={`relative w-full ${
                  mediaSettings.aspectRatio === '16:9'
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
                      <p className="text-[10px] text-emerald-700 truncate mt-0.5">/generated/output.mp4</p>
                    </div>
                  </div>

                  <a
                    href={videoUrl ? `${videoUrl}&download=true` : ''}
                    download="hadith_shorts.mp4"
                    className="w-full py-3.5 rounded-lg font-bold text-sm bg-rausch hover:bg-rausch-active text-white flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98"
                  >
                    <Download className="w-4 h-4" />
                    Download MP4
                  </a>
                </div>
              </section>
            )}

          </div>

        </div>

        {/* Searchable Replace Image Selection Modal */}
        <ReplaceImageModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setReplacingIndex(null);
          }}
          onSelectImage={handleSelectImage}
          allImages={allLibraryImages}
          currentImage={replacingIndex !== null && scenes[replacingIndex] ? scenes[replacingIndex].image : undefined}
          sceneIndex={replacingIndex}
          sceneKeyword={replacingIndex !== null && scenes[replacingIndex] ? scenes[replacingIndex].keyword : undefined}
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
          aspectRatio={mediaSettings.aspectRatio || '9:16'}
          onSaveDua={handleSaveDua}
        />
      </main>
    </div>
  );
}
