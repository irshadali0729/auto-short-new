'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, BookOpen, Eye, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { DuaInfo, DuaCardTheme, generateDuaCardSvg } from '@/app/utils/dua-card-svg';

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

  useEffect(() => {
    if (isOpen) {
      if (initialDua) {
        setDraftHindi(initialDua.hindi || '');
        setDraftArabic(initialDua.arabic || '');
        setDraftTitle(initialDua.title || 'DUA • दुआ • دعاء');
        setDraftReference(initialDua.reference || '');
        setDraftIsDua(initialDua.isDua !== false);
      } else {
        setDraftHindi('ला इलाहा इल्लल्लाहु वह्दहू ला शरी-क लहू, लहुल-मुल्कु व लहुल-हम्दु, व हुवा \'अला कुल्लि शैइन क़दीर');
        setDraftArabic('لَا إِلٰهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ');
        setDraftTitle('सुबह और शाम की हिफ़ाज़त की दुआ');
        setDraftReference('तिर्मिज़ी / Abu Dawud');
        setDraftIsDua(true);
      }
      setActiveTheme(cardTheme);
    }
  }, [isOpen, initialDua, cardTheme]);

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

  const targetWidth = aspectRatio === '16:9' ? 1920 : 1080;
  const targetHeight = aspectRatio === '16:9' ? 1080 : 1920;

  const previewDuaObj: DuaInfo = {
    isDua: draftIsDua,
    hindi: draftHindi,
    arabic: draftArabic,
    title: draftTitle,
    reference: draftReference,
  };

  const previewSvg = generateDuaCardSvg(previewDuaObj, targetWidth, targetHeight, activeTheme);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dua-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-4xl rounded-2xl border border-hairline bg-white shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-hairline-soft flex items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-[#FAF6ED] border border-[#E2D3B3] text-[#8C682A]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="dua-dialog-title" className="text-lg sm:text-xl font-bold text-ink tracking-tight">
                  Islamic Dua & Zikr Card Editor
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF6ED] text-[#8C682A] border border-[#E2D3B3]">
                  Scene {sceneIndex + 1}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Inspect and tweak the verified Hindi Devanagari and authentic Arabic script with Tashkeel.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-hairline text-ink hover:bg-surface-soft transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ink"
            aria-label="Close Dua editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Split 2 columns (Left: Inputs, Right: Live Card Preview) */}
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
          {/* Left Column: Form Fields */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* Active Toggle */}
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-hairline bg-surface-soft cursor-pointer select-none">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-rausch" />
                <div>
                  <span className="text-xs font-bold text-ink block">Enable Dua Card on this Scene</span>
                  <span className="text-[10px] text-muted block">Replaces standard subtitle with high-contrast prayer card</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={draftIsDua}
                onChange={(e) => setDraftIsDua(e.target.checked)}
                className="w-4 h-4 text-rausch rounded focus:ring-rausch"
              />
            </label>

            {/* Theme Selector for Preview */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1.5">
                Card Background Aesthetic
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cream' as DuaCardTheme, label: 'Cream Ivory', color: '#FAF6ED' },
                  { id: 'white' as DuaCardTheme, label: 'Pure White', color: '#FFFFFF' },
                  { id: 'light_grey' as DuaCardTheme, label: 'Slate Soft', color: '#F4F6F8' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTheme(t.id)}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      activeTheme === t.id
                        ? 'bg-[#fff0f2] border-rausch text-rausch shadow-xs'
                        : 'bg-white border-hairline hover:bg-surface-soft text-ink'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-hairline"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hindi Text Input (Top) */}
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
                className="w-full p-3 text-sm rounded-xl border border-hairline focus:border-rausch focus:ring-1 focus:ring-rausch outline-none text-ink font-medium resize-none"
              />
            </div>

            {/* Arabic Text Input (Bottom) */}
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
                className="w-full p-3 text-base rounded-xl border border-hairline focus:border-rausch focus:ring-1 focus:ring-rausch outline-none text-emerald-900 font-semibold resize-none font-arabic"
              />
            </div>

            {/* Optional Title & Reference */}
            <div className="grid grid-cols-2 gap-3">
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

          {/* Right Column: Live Card Preview */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900 border border-zinc-800 relative overflow-hidden min-h-[320px]">
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 text-white text-[10px] font-bold backdrop-blur-md">
              <Eye className="w-3 h-3 text-rausch" />
              <span>Real-Time Overlay Preview</span>
            </div>

            <div className="w-full flex items-center justify-center pt-5">
              <div
                className="w-full max-w-[340px] drop-shadow-2xl transition-all"
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            </div>

            <span className="text-[10px] text-zinc-400 mt-2 italic">
              Rendered precisely as shown over scene video footage
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-hairline-soft bg-white flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleRemoveDua}
            className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
          >
            Remove Dua Card
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-hairline bg-white text-xs font-bold text-ink hover:bg-surface-soft transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-lg bg-rausch hover:bg-rausch-active text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
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
