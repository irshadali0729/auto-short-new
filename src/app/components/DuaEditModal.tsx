'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  BookOpen,
  Eye,
  Sparkles,
  Smartphone,
  Monitor,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  Palette,
  LayoutTemplate,
  Sliders,
  Trash2,
} from 'lucide-react';
import {
  DuaInfo,
  DuaCardTheme,
  DuaCardPosition,
  DuaCardStyle,
  generateDuaCardSvg,
} from '@/app/utils/dua-card-svg';

interface DuaEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneIndex: number | null;
  sceneKeyword?: string;
  initialDua?: DuaInfo;
  cardTheme?: DuaCardTheme;
  aspectRatio?: '9:16' | '16:9';
  onSaveDua: (sceneIndex: number, updatedDua: DuaInfo | undefined) => void;
}

export default function DuaEditModal({
  isOpen,
  onClose,
  sceneIndex,
  sceneKeyword,
  initialDua,
  cardTheme = 'cream',
  aspectRatio = '9:16',
  onSaveDua,
}: DuaEditModalProps) {
  const [draftHindi, setDraftHindi] = useState('');
  const [draftArabic, setDraftArabic] = useState('');
  const [draftTitle, setDraftTitle] = useState('DUA • दुआ • دعاء');
  const [draftReference, setDraftReference] = useState('');
  const [draftIsDua, setDraftIsDua] = useState(true);
  const [activeTheme, setActiveTheme] = useState<DuaCardTheme>(cardTheme);
  const [activePosition, setActivePosition] = useState<DuaCardPosition>('center');
  const [activeStyle, setActiveStyle] = useState<DuaCardStyle>('classic');
  const [previewAspectRatio, setPreviewAspectRatio] = useState<'9:16' | '16:9'>(aspectRatio);

  useEffect(() => {
    if (isOpen) {
      if (initialDua) {
        setDraftHindi(initialDua.hindi || '');
        setDraftArabic(initialDua.arabic || '');
        setDraftTitle(initialDua.title || 'DUA • दुआ • دعاء');
        setDraftReference(initialDua.reference || '');
        setDraftIsDua(initialDua.isDua !== false);
        setActiveTheme(initialDua.theme || cardTheme || 'cream');
        setActivePosition(initialDua.position || 'center');
        setActiveStyle(initialDua.cardStyle || 'classic');
      } else {
        setDraftHindi('ला इलाहा इल्लल्लाहु वह्दहू ला शरी-क लहू, लहुल-मुल्कु व लहुल-हम्दु, व हुवा \'अला कुल्लि शैइन क़दीर');
        setDraftArabic('لَا إِلٰهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ');
        setDraftTitle('सुबह और शाम की हिफ़ाज़त की दुआ');
        setDraftReference('तिर्मिज़ी / Abu Dawud');
        setDraftIsDua(true);
        setActiveTheme(cardTheme || 'cream');
        setActivePosition('center');
        setActiveStyle('classic');
      }
      setPreviewAspectRatio(aspectRatio);
    }
  }, [isOpen, initialDua, cardTheme, aspectRatio]);

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || sceneIndex === null) return null;

  const targetWidth = previewAspectRatio === '16:9' ? 1920 : 1080;
  const targetHeight = previewAspectRatio === '16:9' ? 1080 : 1920;

  const previewDuaObj: DuaInfo = {
    isDua: draftIsDua,
    hindi: draftHindi,
    arabic: draftArabic,
    title: draftTitle,
    reference: draftReference,
    theme: activeTheme,
    position: activePosition,
    cardStyle: activeStyle,
  };

  const previewSvg = generateDuaCardSvg(previewDuaObj, targetWidth, targetHeight, activeTheme);

  const themeOptions: {
    id: DuaCardTheme;
    label: string;
    sublabel: string;
    color: string;
    border: string;
    textColor: string;
    isDark?: boolean;
  }[] = [
    {
      id: 'cream',
      label: 'Cream Ivory',
      sublabel: 'Warm parchment & gold',
      color: '#FAF6ED',
      border: '#E2D3B3',
      textColor: '#1E293B',
    },
    {
      id: 'white',
      label: 'Pure White',
      sublabel: 'Minimal luxe & gold',
      color: '#FFFFFF',
      border: '#E5E7EB',
      textColor: '#111827',
    },
    {
      id: 'light_grey',
      label: 'Slate Soft',
      sublabel: 'Modern grey & navy',
      color: '#F4F6F8',
      border: '#CBD5E1',
      textColor: '#0F172A',
    },
    {
      id: 'emerald_dark',
      label: 'Emerald Night',
      sublabel: 'Islamic velvet & gold',
      color: '#06281E',
      border: '#D4AF37',
      textColor: '#FCD34D',
      isDark: true,
    },
    {
      id: 'midnight_gold',
      label: 'Midnight Onyx',
      sublabel: 'Obsidian & gold foil',
      color: '#0F1117',
      border: '#F59E0B',
      textColor: '#FBBF24',
      isDark: true,
    },
  ];

  const positionOptions: {
    id: DuaCardPosition;
    label: string;
    description: string;
    icon: React.ElementType;
  }[] = [
    {
      id: 'top',
      label: 'Top Header',
      description: 'Upper third (leaves center free)',
      icon: AlignVerticalJustifyStart,
    },
    {
      id: 'center',
      label: 'Center Focus',
      description: 'Hero highlight (balanced view)',
      icon: AlignVerticalJustifyCenter,
    },
    {
      id: 'bottom',
      label: 'Lower Third',
      description: 'Classic subtitle placement',
      icon: AlignVerticalJustifyEnd,
    },
  ];

  const styleOptions: {
    id: DuaCardStyle;
    label: string;
    badge: string;
  }[] = [
    {
      id: 'classic',
      label: 'Classic Card',
      badge: 'Dual Border',
    },
    {
      id: 'floating_pill',
      label: 'Floating Pill',
      badge: 'Rounded',
    },
    {
      id: 'full_banner',
      label: 'Full Banner',
      badge: 'Cinematic Strip',
    },
  ];

  const handleSave = () => {
    if (!draftIsDua || (!draftHindi.trim() && !draftArabic.trim())) {
      onSaveDua(sceneIndex, undefined);
    } else {
      onSaveDua(sceneIndex, {
        isDua: true,
        hindi: draftHindi.trim(),
        arabic: draftArabic.trim(),
        title: draftTitle.trim() || undefined,
        reference: draftReference.trim() || undefined,
        theme: activeTheme,
        position: activePosition,
        cardStyle: activeStyle,
      });
    }
    onClose();
  };

  const handleRemoveDua = () => {
    onSaveDua(sceneIndex, undefined);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dua-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-5xl rounded-2xl border border-hairline bg-white shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 my-auto max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-4.5 border-b border-hairline-soft flex items-center justify-between gap-4 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-full bg-[#FAF6ED] border border-[#E2D3B3] text-[#8C682A] shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="dua-dialog-title" className="text-base sm:text-lg font-bold text-ink tracking-tight truncate">
                  Islamic Dua & Zikr Card Studio
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF6ED] text-[#8C682A] border border-[#E2D3B3]">
                  Scene {sceneIndex + 1}
                </span>
                {sceneKeyword && (
                  <span className="text-[10px] text-muted truncate hidden sm:inline">
                    • {sceneKeyword}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5 truncate">
                Design, reposition, and customize verified Hindi & Arabic prayer cards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Aspect Ratio Preview Selector */}
            <div className="hidden sm:flex items-center p-1 bg-surface-soft rounded-lg border border-hairline text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPreviewAspectRatio('9:16')}
                className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${
                  previewAspectRatio === '9:16'
                    ? 'bg-white text-ink shadow-xs font-bold'
                    : 'text-muted hover:text-ink'
                }`}
                title="Preview in 9:16 Portrait (Shorts)"
              >
                <Smartphone className="w-3.5 h-3.5 text-rausch" />
                <span>9:16</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewAspectRatio('16:9')}
                className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${
                  previewAspectRatio === '16:9'
                    ? 'bg-white text-ink shadow-xs font-bold'
                    : 'text-muted hover:text-ink'
                }`}
                title="Preview in 16:9 Landscape"
              >
                <Monitor className="w-3.5 h-3.5 text-rausch" />
                <span>16:9</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white border border-hairline text-ink hover:bg-surface-soft transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ink shrink-0"
              aria-label="Close Dua editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split 2 columns (Left: Controls & Inputs, Right: Live Interactive Card Canvas) */}
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto flex-1">
          {/* Left Column: Design & Content Controls */}
          <div className="lg:col-span-7 flex flex-col gap-4.5">
            {/* Active Toggle Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setDraftIsDua((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDraftIsDua((prev) => !prev);
                }
              }}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                draftIsDua
                  ? 'bg-[#fff8f9] border-rausch shadow-xs'
                  : 'bg-surface-soft border-hairline text-muted'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                    draftIsDua ? 'border-rausch bg-rausch text-white' : 'border-hairline bg-white'
                  }`}
                >
                  {draftIsDua && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <div>
                  <span className="text-xs font-bold text-ink block">Enable Dua Card on this Scene</span>
                  <span className="text-[10px] text-muted block">Replaces standard subtitle with high-contrast prayer card</span>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                  draftIsDua ? 'bg-[#fff0f2] text-rausch border border-[#ffd1da]' : 'bg-white text-muted border border-hairline'
                }`}
              >
                {draftIsDua ? 'Active' : 'Disabled'}
              </span>
            </div>

            {/* Template / Theme Aesthetic Selector */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 mb-2">
                <Palette className="w-3.5 h-3.5 text-rausch" />
                <span>Card Theme & Color Aesthetics</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {themeOptions.map((t) => {
                  const isSelected = activeTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTheme(t.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#fff0f2] border-rausch shadow-sm ring-1 ring-rausch'
                          : 'bg-white border-hairline hover:bg-surface-soft'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <div
                          className="w-5 h-5 rounded-md border shadow-xs"
                          style={{
                            backgroundColor: t.color,
                            borderColor: t.border,
                          }}
                        />
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-rausch" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-ink block leading-tight">
                          {t.label}
                        </span>
                        <span className="text-[10px] text-muted block mt-0.5 leading-tight">
                          {t.sublabel}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card Position & Layout Format Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Vertical Position */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 mb-1.5">
                  <Sliders className="w-3.5 h-3.5 text-rausch" />
                  <span>Vertical Position</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {positionOptions.map((p) => {
                    const isSelected = activePosition === p.id;
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActivePosition(p.id)}
                        className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-[#fff0f2] border-rausch text-rausch font-bold shadow-xs'
                            : 'bg-white border-hairline hover:bg-surface-soft text-ink'
                        }`}
                        title={p.description}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[10px] leading-none">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card Style / Template */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 mb-1.5">
                  <LayoutTemplate className="w-3.5 h-3.5 text-rausch" />
                  <span>Card Template Frame</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {styleOptions.map((s) => {
                    const isSelected = activeStyle === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveStyle(s.id)}
                        className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                          isSelected
                            ? 'bg-[#fff0f2] border-rausch text-rausch font-bold shadow-xs'
                            : 'bg-white border-hairline hover:bg-surface-soft text-ink'
                        }`}
                      >
                        <span className="text-[11px] font-bold leading-tight">{s.label}</span>
                        <span className="text-[9px] text-muted">{s.badge}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Hindi Text Input (Top Display) */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center justify-between mb-1">
                <span>1. Hindi / Devanagari Pronunciation</span>
                <span className="text-[10px] text-rausch font-bold">Top Display</span>
              </label>
              <textarea
                rows={3}
                value={draftHindi}
                onChange={(e) => setDraftHindi(e.target.value)}
                placeholder="Enter or edit Hindi Devanagari text..."
                className="w-full p-3 text-sm rounded-xl border border-hairline focus:border-rausch focus:ring-1 focus:ring-rausch outline-none text-ink font-medium resize-none leading-relaxed"
              />
            </div>

            {/* Arabic Text Input (Below Hindi) */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center justify-between mb-1">
                <span>2. Authentic Arabic with Tashkeel</span>
                <span className="text-[10px] text-emerald-700 font-bold">Below Hindi</span>
              </label>
              <textarea
                rows={3}
                dir="rtl"
                value={draftArabic}
                onChange={(e) => setDraftArabic(e.target.value)}
                placeholder="أدخل النص العربي مع التشكيل..."
                className="w-full p-3 text-base rounded-xl border border-hairline focus:border-rausch focus:ring-1 focus:ring-rausch outline-none text-emerald-900 font-semibold resize-none leading-loose font-arabic"
              />
            </div>

            {/* Optional Title & Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                  Card Header Title
                </label>
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="DUA • दुआ • دعاء"
                  className="w-full p-2.5 text-xs rounded-xl border border-hairline focus:border-rausch outline-none text-ink font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                  Hadith / Quran Reference
                </label>
                <input
                  type="text"
                  value={draftReference}
                  onChange={(e) => setDraftReference(e.target.value)}
                  placeholder="तिर्मिज़ी / Sahih Hadith"
                  className="w-full p-2.5 text-xs rounded-xl border border-hairline focus:border-rausch outline-none text-ink font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Live Card Canvas Preview */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="sticky top-0 p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden shadow-inner min-h-[380px] lg:min-h-[500px]">
              {/* Header Badges */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10 pointer-events-none">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 text-white text-[10px] font-bold backdrop-blur-md border border-white/10">
                  <Eye className="w-3 h-3 text-rausch" />
                  <span>Live Card Preview</span>
                </div>

                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 text-[9px] font-medium backdrop-blur-md">
                  <span className="capitalize">{activePosition}</span>
                  <span>•</span>
                  <span className="uppercase">{previewAspectRatio}</span>
                </div>
              </div>

              {/* Smartphone / Screen Frame Mockup */}
              <div className="w-full flex items-center justify-center my-auto py-6">
                <div
                  className={`relative rounded-2xl overflow-hidden border-2 border-zinc-700 bg-zinc-900 shadow-2xl transition-all flex items-center justify-center ${
                    previewAspectRatio === '16:9'
                      ? 'w-full max-w-[380px] aspect-[16/9]'
                      : 'w-[240px] sm:w-[260px] aspect-[9/16]'
                  }`}
                  style={{
                    backgroundImage: 'radial-gradient(ellipse at center, #1e293b 0%, #090d16 100%)',
                  }}
                >
                  {/* Subtle video footage simulation lines */}
                  <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

                  {/* SVG Container rendered with perfect responsive containment */}
                  <div
                    className="w-full h-full flex items-center justify-center transition-all duration-200"
                    dangerouslySetInnerHTML={{ __html: previewSvg }}
                  />
                </div>
              </div>

              {/* Bottom description */}
              <span className="text-[10px] text-zinc-400 text-center italic mt-auto">
                Overlayed precisely onto scene video in final render
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-hairline-soft bg-white flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleRemoveDua}
            className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove Dua Card</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-hairline bg-white text-xs font-bold text-ink hover:bg-surface-soft transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-lg bg-rausch hover:bg-rausch-active text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              Save Dua Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
