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
  Type
} from 'lucide-react';
import SettingsModal, { 
  MediaSettings, 
  DEFAULT_MEDIA_SETTINGS 
} from '@/app/components/SettingsModal';
import ReplaceImageModal from '@/app/components/ReplaceImageModal';

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
}

interface Scene {
  keyword: string;
  duration: number;
  image: string;
  isFallback: boolean;
  graphics?: GraphicBeat[];
  captions?: CaptionSlice[];
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
          enableGraphicMotion: mediaSettings.textOverlayMode === 'graphics',
          enableCaptions: mediaSettings.textOverlayMode === 'captions',
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
    <main className="relative min-h-screen px-4 py-8 md:py-16 max-w-6xl mx-auto z-10">
      {/* Background Radial Glow decoration */}
      <div className="radial-glow top-10 left-10" />
      <div className="radial-glow bottom-10 right-10" />

      {/* Header */}
      <header className="flex flex-col items-center mb-12 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-4">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-400 text-sm font-medium backdrop-blur-md">
            <Film className="w-4 h-4" />
            <span>Hadith Shorts Maker — Local Sandbox Edition</span>
          </div>

          {/* Clearly labeled Settings Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-700/80 bg-zinc-900/90 hover:bg-zinc-800 hover:border-purple-500/40 text-zinc-300 hover:text-white text-xs font-bold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
            aria-label="Open Media Source and Type Settings"
            id="settings-open-button"
          >
            <Settings className="w-3.5 h-3.5 text-purple-400" />
            <span>Settings</span>
            <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black border border-purple-500/30">
              {Object.values(mediaSettings.sources).filter(Boolean).length} Sources
            </span>
          </button>
        </div>

        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-3 bg-gradient-to-r from-white via-zinc-200 to-purple-400 bg-clip-text text-transparent">
          Hadith Shorts Maker
        </h1>
        <p className="text-zinc-400 max-w-xl text-base md:text-lg">
          Generate gorgeous, vertical YouTube Shorts instantly using localized AI keyword scene matching and FFmpeg rendering.
        </p>

        {/* Live configuration indicator badge */}
        <div className="mt-3.5 inline-flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-400 shadow-inner">
          <Sliders className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-zinc-500 font-medium">Filter:</span>
          <span className="font-bold text-zinc-200 capitalize">{mediaSettings.mediaType.replace(/_/g, ' ')}</span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-500 font-medium">Sources:</span>
          <span className="font-bold text-zinc-200">
            {Object.entries(mediaSettings.sources)
              .filter(([_, enabled]) => enabled)
              .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1))
              .join(', ')}
          </span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-500 font-medium">Overlay:</span>
          <span className="font-bold text-purple-400 capitalize">
            {mediaSettings.textOverlayMode === 'graphics'
              ? 'Graphic Motion'
              : mediaSettings.textOverlayMode === 'none'
                ? 'None'
                : 'Captions'}
          </span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-500 font-medium">Zoom:</span>
          <span className="font-bold text-zinc-200 tabular-nums">{(mediaSettings.zoomSpeed ?? 1.0).toFixed(1)}x</span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-500 font-medium">Fade:</span>
          <span className="font-bold text-zinc-200 tabular-nums">{(mediaSettings.transitionDuration ?? 0.3).toFixed(1)}s</span>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="text-purple-400 hover:text-purple-300 ml-1 font-bold underline text-[11px] transition-colors"
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
          <section className="rounded-2xl glass-panel p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-400" />
              1. Enter Hadith Transcript
            </h2>

            {/* YouTube Import Option */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Import Transcript from YouTube
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-red-500 fill-current" viewBox="0 0 24 24">
                      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </div>
                  <input
                    type="url"
                    placeholder="Enter YouTube Video URL..."
                    value={youtubeLink}
                    onChange={(e) => setYoutubeLink(e.target.value)}
                    disabled={isFetchingTranscript || isAnalyzing || isGenerating}
                    className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-zinc-100 placeholder-zinc-500 text-sm outline-none transition-all focus:border-purple-500/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleFetchTranscript}
                  disabled={isFetchingTranscript || isAnalyzing || isGenerating || !youtubeLink.trim()}
                  className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 shrink-0 ${
                    isFetchingTranscript
                      ? 'bg-purple-600/30 text-purple-300 cursor-not-allowed border border-purple-500/30'
                      : !youtubeLink.trim()
                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700/50'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:-translate-y-0.5 border border-purple-400/20'
                  }`}
                >
                  {isFetchingTranscript ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Get Transcript
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Target Video Length Input */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Target Video Length (seconds)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Clock className="w-4 h-4 text-purple-400" />
                </div>
                <input
                  type="number"
                  min="1"
                  max="300"
                  step="0.1"
                  placeholder="Target duration in seconds (e.g. 37)..."
                  value={targetVideoLength}
                  onChange={(e) => handleTargetLengthChange(e.target.value)}
                  disabled={isAnalyzing || isGenerating}
                  className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-zinc-100 placeholder-zinc-500 text-sm outline-none transition-all focus:border-purple-500/50"
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Specifies the exact length of the final generated video. Existing scene durations scale dynamically.
              </p>
            </div>

            {/* Visual Divider */}
            <div className="relative flex py-2 items-center mb-4">
              <div className="flex-grow border-t border-zinc-800/80"></div>
              <span className="flex-shrink mx-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Or Enter Manually
              </span>
              <div className="flex-grow border-t border-zinc-800/80"></div>
            </div>

            {/* Audio Timeline Sync Status Banner */}
            {transcriptSegments.length > 0 && (
              <div className="flex items-center justify-between px-3.5 py-2 mb-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 shadow-sm transition-all animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-semibold">
                    Timeline Synced: <span className="text-emerald-100 font-bold tabular-nums">{transcriptSegments.length}</span> YouTube audio caption slices
                  </span>
                  <span className="text-emerald-400/70 hidden sm:inline">
                    (audio length: <span className="tabular-nums font-bold text-emerald-200">{transcriptSegments[transcriptSegments.length - 1]?.end.toFixed(1)}s</span>)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTranscriptSegments([]);
                    setInfoMessage('Unlinked YouTube timeline sync. AI will now calculate scene timing using natural spoken rate estimation.');
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-200 underline font-medium transition-colors ml-2"
                  title="Unlink segments to switch to speech rate estimation"
                >
                  Unlink Sync
                </button>
              </div>
            )}

            <textarea
              className="w-full h-44 rounded-xl glass-input p-4 text-zinc-100 placeholder-zinc-500 resize-none font-sans text-base transition-all"
              placeholder="Paste your Hindi, Urdu, or English transcript here..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              disabled={isAnalyzing || isGenerating}
            />
            
            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="text-xs text-zinc-500">
                Supports Multi-lingual Inputs
              </span>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || isGenerating || !transcript.trim()}
                className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all duration-300 ${
                  isAnalyzing 
                    ? 'bg-purple-600/30 text-purple-300 cursor-not-allowed border border-purple-500/30'
                    : !transcript.trim()
                      ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700/50'
                      : 'bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] hover:-translate-y-0.5 border border-purple-400/20'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing Script...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Analyze Transcript
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 flex items-start gap-3 shadow-lg">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Execution Interrupted</p>
                <p className="text-xs opacity-90 mt-1">{errorMessage}</p>
              </div>
            </div>
          )}

          {infoMessage && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-300 flex items-start gap-3 shadow-lg">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Keyword Matching Warning</p>
                <p className="text-xs opacity-90 mt-1">{infoMessage}</p>
              </div>
            </div>
          )}

          {/* Extracted/Matched Scenes Panel */}
          {scenes.length > 0 && (
            <section className="rounded-2xl glass-panel p-6 shadow-2xl">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-purple-400" />
                    2. Matched Visual Storyboard
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Review matching scenes and customize the storyboard.
                  </p>
                </div>

                <button
                  onClick={handleGenerateVideo}
                  disabled={isGenerating || isAnalyzing}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
                    isGenerating 
                      ? 'bg-zinc-800 text-zinc-600 border border-zinc-700/50 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:-translate-y-0.5'
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
                  <div key={idx} className="rounded-xl glass-card overflow-hidden flex flex-col relative group">
                    
                    {/* Scene Media Preview (Video or Image) */}
                    <div className="relative h-44 bg-zinc-950 flex items-center justify-center overflow-hidden">
                      {/\.(mp4|webm|mov)$/i.test(scene.image) ? (
                        <video
                          src={`/api/images/${encodeURIComponent(scene.image)}`}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={`/api/images/${encodeURIComponent(scene.image)}`}
                          alt={scene.keyword}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            // Fallback if image fails to render
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      )}

                      {/* Scene Badge Indicator */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1.5">
                        <div className="flex items-center gap-1">
                          <span className="px-2.5 py-1 rounded-md text-xs font-black bg-black/75 text-white border border-white/10 backdrop-blur-sm shadow-md">
                            Scene {idx + 1}
                          </span>
                          {/\.(mp4|webm|mov)$/i.test(scene.image) && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-600/90 text-white shadow-md flex items-center gap-1">
                              <Film className="w-2.5 h-2.5" /> Video
                            </span>
                          )}
                        </div>
                        
                        {scene.isFallback && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/90 text-zinc-950 shadow-md">
                            Fallback Match
                          </span>
                        )}
                      </div>

                      {/* Duration Tag with Timeline Sync Range */}
                      <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1.5 border border-white/10 tabular-nums shadow-lg">
                        <Clock className="w-3 h-3 text-purple-400" />
                        <span className="font-bold">{scene.duration.toFixed(1)}s</span>
                        <span className="text-zinc-400 text-[10px]">({sceneStart.toFixed(1)}s - {sceneEnd.toFixed(1)}s)</span>
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-4 flex flex-col justify-between flex-grow bg-zinc-900/40">
                      <div className="mb-3">
                        <span className="text-[10px] tracking-wider uppercase font-semibold text-zinc-500 block">Keyword Match</span>
                        <span className="text-sm font-bold text-white truncate block capitalize">
                          {scene.keyword || 'Random Scene'}
                        </span>
                        <span className="text-xs text-zinc-400 truncate block mt-0.5 opacity-75">
                          {scene.image}
                        </span>

                        {/* Overlay Section based on mutually exclusive textOverlayMode */}
                        {mediaSettings.textOverlayMode === 'captions' ? (
                          scene.captions && scene.captions.length > 0 ? (
                            <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex flex-col gap-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 text-emerald-400">
                                <MessageSquareText className="w-2.5 h-2.5" />
                                Spoken Captions (Synced)
                              </span>
                              <div className="flex flex-col gap-1">
                                {scene.captions.map((c, cIdx) => {
                                  const absStart = sceneStart + c.start;
                                  return (
                                    <div key={cIdx} className="px-2.5 py-1.5 rounded-lg bg-zinc-950/80 border border-emerald-500/20 text-[11px] font-medium text-zinc-200 flex items-center justify-between gap-2 shadow-sm">
                                      <span className="truncate italic">“{c.text}”</span>
                                      <span className="shrink-0 text-[10px] text-zinc-400 tabular-nums ml-1">
                                        +{c.start.toFixed(1)}s <span className="text-zinc-500">(at {absStart.toFixed(1)}s)</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null
                        ) : mediaSettings.textOverlayMode === 'graphics' ? (
                          scene.graphics && scene.graphics.length > 0 ? (
                            <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex flex-col gap-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 text-purple-400">
                                <Sparkles className="w-2.5 h-2.5" />
                                Kinetic Graphic
                              </span>
                              <div className="flex flex-col gap-1">
                                {scene.graphics.map((g, gIdx) => {
                                  const absStart = sceneStart + g.start;
                                  return (
                                    <div key={gIdx} className="px-2.5 py-1.5 rounded-lg bg-zinc-950/80 border border-purple-500/20 text-[11px] font-semibold text-zinc-300 flex items-center justify-between gap-1.5 shadow-sm">
                                      <div className="flex items-center gap-1 truncate">
                                        {g.prefixText && <span className="text-zinc-400 font-normal">{g.prefixText}</span>}
                                        <span className="text-amber-400 font-black uppercase bg-amber-400/10 px-1 rounded">{g.heroWord}</span>
                                        {g.suffixText && <span className="text-zinc-400 font-normal">{g.suffixText}</span>}
                                      </div>
                                      <span className="shrink-0 text-[10px] text-zinc-400 font-medium tabular-nums ml-1">
                                        +{g.start.toFixed(1)}s <span className="text-zinc-500">(at {absStart.toFixed(1)}s)</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null
                        ) : (
                          <div className="mt-2.5 pt-2 border-t border-zinc-800/80">
                            <span className="text-[10px] text-zinc-500 italic">
                              Text overlays disabled in settings (clean video)
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleReplaceClick(idx)}
                        className="w-full py-2 rounded-lg border border-zinc-700/60 bg-zinc-800/40 text-xs font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-zinc-500 transition-colors flex items-center justify-center gap-1.5"
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

        {/* Right Column: Generation Progress & Preview */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {/* Compilation Load State */}
          {isGenerating && (
            <section className="rounded-2xl glass-panel p-6 flex flex-col items-center justify-center text-center shadow-2xl">
              <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-purple-500/10 border-t-purple-500 animate-spin" />
                <Film className="w-8 h-8 text-purple-400 animate-pulse" />
              </div>
              
              <h3 className="text-lg font-bold text-white mb-1">Compiling Vertical Short</h3>
              
              {/* Battery-like progress meter */}
              <div className="flex items-center justify-center gap-1.5 my-3">
                <div className="relative w-24 h-8 border-2 border-purple-500/80 rounded-lg p-1 flex gap-1 bg-zinc-950/60 backdrop-blur-sm shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                  {/* Bar 1 */}
                  <div className={`flex-1 h-full rounded-sm transition-all duration-500 ${
                    pollCount >= 1 
                      ? 'bg-gradient-to-t from-purple-600 to-indigo-500 opacity-100 shadow-[0_0_8px_rgba(168,85,247,0.5)]' 
                      : 'bg-zinc-800 opacity-20'
                  }`} />
                  {/* Bar 2 */}
                  <div className={`flex-1 h-full rounded-sm transition-all duration-500 ${
                    pollCount >= 2 
                      ? 'bg-gradient-to-t from-purple-600 to-indigo-500 opacity-100 shadow-[0_0_8px_rgba(168,85,247,0.5)]' 
                      : 'bg-zinc-800 opacity-20'
                  }`} />
                  {/* Bar 3 */}
                  <div className={`flex-1 h-full rounded-sm transition-all duration-500 ${
                    pollCount >= 3 
                      ? 'bg-gradient-to-t from-purple-600 to-indigo-500 opacity-100 shadow-[0_0_8px_rgba(168,85,247,0.5)]' 
                      : 'bg-zinc-800 opacity-20'
                  }`} />
                </div>
                {/* Battery tip */}
                <div className="w-1.5 h-3 bg-purple-500/80 rounded-r-sm shadow-[2px_0_5px_rgba(168,85,247,0.2)]" />
              </div>

              <p className="text-zinc-400 text-xs max-w-xs">{generationStep}</p>
            </section>
          )}

          {/* Empty Video Preview State */}
          {!videoUrl && !isGenerating && (
            <section className="rounded-2xl glass-panel p-8 text-center flex flex-col items-center justify-center h-[500px] border border-dashed border-zinc-800 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 shadow-inner">
                <Play className="w-6 h-6 text-zinc-600" />
              </div>
              <h3 className="text-lg font-bold text-zinc-300 mb-1">Shorts Video Player</h3>
              <p className="text-xs text-zinc-500 max-w-[240px]">
                Create visual matches and compile the story board to preview your 9:16 vertical short.
              </p>
            </section>
          )}

          {/* Video Preview and Action Panel */}
          {videoUrl && !isGenerating && (
            <section className="rounded-2xl glass-panel p-6 shadow-2xl flex flex-col items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 self-start mb-6">
                <Play className="w-5 h-5 text-purple-400" />
                4. Preview & Download
              </h2>

              {/* 9:16 Vertical Video Screen */}
              <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-[0_20px_50px_-20px_rgba(168,85,247,0.3)]">
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Download actions */}
              <div className="w-full mt-6 flex flex-col gap-3">
                <div className="rounded-xl bg-zinc-900/50 border border-zinc-800 p-3 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-zinc-200">Video successfully generated!</p>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">/generated/output.mp4</p>
                  </div>
                </div>

                 <a
                  href={videoUrl ? `${videoUrl}&download=true` : ''}
                  download="hadith_shorts.mp4"
                  className="w-full py-3.5 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]"
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
    </main>
  );
}
