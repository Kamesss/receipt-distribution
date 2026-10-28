/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  Plus,
  Trash2,
  Users,
  Check,
  Copy,
  FileText,
  AlertCircle,
  Loader2,
  UserPlus,
  Sparkles,
  RotateCcw,
  Share2,
  Receipt,
  Calculator,
} from 'lucide-react';
import {
  GroupParticipant,
  ItemAssignmentMap,
  ParsedReceiptData,
  ReceiptLineItem,
  TaxTipDistributionConfig,
} from './types/receipt.ts';
import { calculateBillSplit, fromCents, toCents } from './services/billSplitCalculator.ts';
import {
  formatPhp,
  INITIAL_PARTICIPANTS,
  PARTICIPANT_COLORS,
  renderSampleReceiptImageBase64,
  SAMPLE_RECEIPT_PRESETS,
} from './data/sampleReceipts.ts';
import { ReceiptCameraModal } from './components/ReceiptCameraModal.tsx';
import { WorkerArchitectureDrawer } from './components/WorkerArchitectureDrawer.tsx';

type MobileTab = 'items' | 'group' | 'settle' | 'receipt';

function getInitials(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function App() {
  const preset0 = SAMPLE_RECEIPT_PRESETS[0];

  const [receipt, setReceipt] = useState<ParsedReceiptData>(preset0.receipt);
  const [participants, setParticipants] = useState<GroupParticipant[]>(INITIAL_PARTICIPANTS);
  const [assignments, setAssignments] = useState<ItemAssignmentMap>(preset0.defaultAssignments);
  const [activeParticipantFilter, setActiveParticipantFilter] = useState<string>('all');
  const [mobileTab, setMobileTab] = useState<MobileTab>('items');

  const [taxTipConfig, setTaxTipConfig] = useState<TaxTipDistributionConfig>({
    mode: 'proportional',
    customTaxAmount: preset0.receipt.tax,
    customServiceFeeAmount: preset0.receipt.serviceFee,
    customDiscountAmount: preset0.receipt.discount,
    tipMode: 'percentage',
    tipPercentage: 10,
    tipFixedAmount: preset0.receipt.tip,
  });

  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [isScanningOcr, setIsScanningOcr] = useState<boolean>(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrStatusBanner, setOcrStatusBanner] = useState<string | null>(null);

  // Modals & Drawers
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isArchDrawerOpen, setIsArchDrawerOpen] = useState<boolean>(false);

  // Add Participant inline state
  const [newPersonName, setNewPersonName] = useState<string>('');

  // Add Manual Item inline state
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemQty, setNewItemQty] = useState<string>('1');
  const [newItemPrice, setNewItemPrice] = useState<string>('');

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraCaptureInputRef = useRef<HTMLInputElement | null>(null);

  // Live deterministic calculation using our segregated `billSplitCalculator.ts`
  const splitResult = useMemo(() => {
    return calculateBillSplit(receipt.items, participants, assignments, taxTipConfig);
  }, [receipt.items, participants, assignments, taxTipConfig]);

  // Execute OCR against `/api/receipt/parse` (handled by `workers.ts`)
  const runReceiptOcr = async (dataUrl: string, mimeType: string, sourceLabel: string) => {
    setReceiptPreviewUrl(dataUrl);
    setIsScanningOcr(true);
    setOcrError(null);
    setOcrStatusBanner(`Extracting itemized lines from ${sourceLabel} via Edge OCR...`);

    try {
      const response = await fetch('/api/receipt/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType,
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error || `OCR failed with status ${response.status}`);
      }

      const parsed: ParsedReceiptData = {
        ...payload.receipt,
        currency: 'PHP',
      };
      setReceipt(parsed);

      const initialMap: ItemAssignmentMap = {};
      parsed.items.forEach((item) => {
        initialMap[item.id] = participants.length === 1 ? [participants[0].id] : [];
      });
      setAssignments(initialMap);

      setTaxTipConfig((prev) => ({
        ...prev,
        customTaxAmount: parsed.tax,
        customServiceFeeAmount: parsed.serviceFee,
        customDiscountAmount: parsed.discount,
        tipMode: parsed.tip > 0 ? 'fixed' : 'percentage',
        tipFixedAmount: parsed.tip,
      }));

      setMobileTab('items');
      setOcrStatusBanner(
        `Parsed ${parsed.items.length} line items from ${parsed.merchantName} (${formatPhp(parsed.total)}). Tap initials on each item to split.`
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to parse receipt image. Please check image clarity or add items manually.';
      setOcrError(message);
      setOcrStatusBanner(null);
    } finally {
      setIsScanningOcr(false);
    }
  };

  const handleGalleryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        runReceiptOcr(reader.result, file.type || 'image/jpeg', file.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLoadSamplePreset = (presetId: string) => {
    const found = SAMPLE_RECEIPT_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setReceipt(found.receipt);
    setAssignments(found.defaultAssignments);
    setTaxTipConfig({
      mode: 'proportional',
      customTaxAmount: found.receipt.tax,
      customServiceFeeAmount: found.receipt.serviceFee,
      customDiscountAmount: found.receipt.discount,
      tipMode: 'percentage',
      tipPercentage: 10,
      tipFixedAmount: found.receipt.tip,
    });
    const renderedImg = renderSampleReceiptImageBase64(found.receipt);
    setReceiptPreviewUrl(renderedImg);
    setOcrError(null);
    setOcrStatusBanner(
      `Loaded "${found.label}" preset (${formatPhp(found.receipt.total)}).`
    );
  };

  const handleRunLiveOcrOnCurrentSample = () => {
    const imgDataUrl = renderSampleReceiptImageBase64(receipt);
    if (!imgDataUrl) return;
    runReceiptOcr(imgDataUrl, 'image/png', `${receipt.merchantName} receipt`);
  };

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPersonName.trim();
    if (!trimmed) return;

    const nextId = `p-${Date.now()}`;
    const colorHex = PARTICIPANT_COLORS[participants.length % PARTICIPANT_COLORS.length];
    const newPerson: GroupParticipant = {
      id: nextId,
      name: trimmed,
      initials: getInitials(trimmed),
      colorHex,
    };

    setParticipants((prev) => [...prev, newPerson]);
    setNewPersonName('');
  };

  const handleRemoveParticipant = (participantId: string) => {
    if (participants.length <= 1) return;
    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    setAssignments((prev) => {
      const next: ItemAssignmentMap = {};
      for (const [itemId, pList] of Object.entries(prev)) {
        next[itemId] = pList.filter((id) => id !== participantId);
      }
      return next;
    });
    if (activeParticipantFilter === participantId) {
      setActiveParticipantFilter('all');
    }
  };

  const toggleParticipantOnItem = (itemId: string, participantId: string) => {
    setAssignments((prev) => {
      const current = prev[itemId] || [];
      const exists = current.includes(participantId);
      const updated = exists
        ? current.filter((id) => id !== participantId)
        : [...current, participantId];
      return { ...prev, [itemId]: updated };
    });
  };

  const assignEveryoneToItem = (itemId: string) => {
    const allIds = participants.map((p) => p.id);
    setAssignments((prev) => {
      const current = prev[itemId] || [];
      const isAlreadyAll = current.length === allIds.length;
      return {
        ...prev,
        [itemId]: isAlreadyAll ? [] : allIds,
      };
    });
  };

  const assignAllItemsEqually = () => {
    const allIds = participants.map((p) => p.id);
    const next: ItemAssignmentMap = {};
    receipt.items.forEach((item) => {
      next[item.id] = [...allIds];
    });
    setAssignments(next);
  };

  const clearAllAssignments = () => {
    const next: ItemAssignmentMap = {};
    receipt.items.forEach((item) => {
      next[item.id] = [];
    });
    setAssignments(next);
  };

  const handleUpdateLineItem = (
    itemId: string,
    field: 'name' | 'quantity' | 'totalPrice',
    value: string
  ) => {
    setReceipt((prev) => {
      const updatedItems = prev.items.map((item) => {
        if (item.id !== itemId) return item;
        if (field === 'name') {
          return { ...item, name: value };
        }
        const numeric = parseFloat(value);
        if (field === 'quantity') {
          const qty = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
          return {
            ...item,
            quantity: qty,
            unitPrice: fromCents(Math.round(toCents(item.totalPrice) / qty)),
          };
        }
        const total = Number.isFinite(numeric) && numeric >= 0 ? fromCents(toCents(numeric)) : 0;
        return {
          ...item,
          totalPrice: total,
          unitPrice:
            item.quantity > 0 ? fromCents(Math.round(toCents(total) / item.quantity)) : total,
        };
      });

      const newSubtotal = fromCents(
        updatedItems.reduce((sum, it) => sum + toCents(it.totalPrice), 0)
      );
      return {
        ...prev,
        items: updatedItems,
        subtotal: newSubtotal,
      };
    });
  };

  const handleDeleteLineItem = (itemId: string) => {
    setReceipt((prev) => {
      const updatedItems = prev.items.filter((i) => i.id !== itemId);
      const newSubtotal = fromCents(
        updatedItems.reduce((sum, it) => sum + toCents(it.totalPrice), 0)
      );
      return {
        ...prev,
        items: updatedItems,
        subtotal: newSubtotal,
      };
    });
    setAssignments((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newItemName.trim();
    const qty = parseFloat(newItemQty) || 1;
    const price = parseFloat(newItemPrice);
    if (!name || !Number.isFinite(price) || price <= 0) return;

    const totalPrice = fromCents(toCents(price));
    const unitPrice = fromCents(Math.round(toCents(totalPrice) / qty));
    const newItem: ReceiptLineItem = {
      id: `item-${Date.now()}`,
      name,
      quantity: qty,
      unitPrice,
      totalPrice,
      category: 'Manual Entry',
    };

    setReceipt((prev) => {
      const nextItems = [...prev.items, newItem];
      const nextSub = fromCents(nextItems.reduce((acc, it) => acc + toCents(it.totalPrice), 0));
      return { ...prev, items: nextItems, subtotal: nextSub };
    });

    setAssignments((prev) => ({
      ...prev,
      [newItem.id]: activeParticipantFilter !== 'all' ? [activeParticipantFilter] : [],
    }));

    setNewItemName('');
    setNewItemQty('1');
    setNewItemPrice('');
  };

  const handleCopySummary = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const buildFullSettlementReport = (): string => {
    const lines: string[] = [
      `${receipt.merchantName} (${receipt.receiptDate})`,
      `Subtotal: ${formatPhp(splitResult.receiptSubtotal)} | VAT/Tax: ${formatPhp(splitResult.effectiveTax)} | Service/Tip: ${formatPhp(splitResult.effectiveTip)} | Grand Total: ${formatPhp(splitResult.grandTotal)}`,
      '----------------------------------------',
    ];
    for (const p of splitResult.participants) {
      const itemNames = p.assignedItems
        .map(
          (i) =>
            `${i.name}${i.sharedByCount > 1 ? ` (1/${i.sharedByCount})` : ''}: ${formatPhp(i.sharePrice)}`
        )
        .join(', ');
      lines.push(
        `${p.participant.name}: ${formatPhp(p.totalOwed)} [Items: ${formatPhp(p.itemsSubtotal)}, VAT: ${formatPhp(p.taxShare)}, Tip: ${formatPhp(p.tipShare)}]${itemNames ? ` — ${itemNames}` : ''}`
      );
    }
    return lines.join('\n');
  };

  const handleNativeShareSummary = async () => {
    const report = buildFullSettlementReport();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${receipt.merchantName} Bill Split`,
          text: report,
        });
        return;
      } catch {
        // Fallback to clipboard copy if user cancels or share fails
      }
    }
    handleCopySummary(report, 'all-settlement');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 pb-20 lg:pb-0">
      {/* Hidden Gallery Input & Native Mobile Camera Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleGalleryFileSelect}
        className="hidden"
      />
      <input
        ref={cameraCaptureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleGalleryFileSelect}
        className="hidden"
      />

      {/* Top Bar Contract: Compact 52px-56px height on mobile, 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 sm:gap-8 border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-md">
        <a
          href="#top"
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          TabSplit PH
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#receipt-capture"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Receipt OCR
          </a>
          <button
            type="button"
            onClick={() => setIsArchDrawerOpen(true)}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Worker Architecture
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Receipt</span>
          </button>
        </div>
      </header>

      {/* Main Responsive Workspace Container */}
      <main
        id="top"
        className="mx-auto w-full max-w-[1440px] flex-1 px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6"
      >
        {/* Top Action & Mobile Quick-Scan Card */}
        <section
          id="receipt-capture"
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span>PHP (₱)</span>
                  <span aria-hidden="true">·</span>
                  <span>{receipt.items.length} Items</span>
                  <span aria-hidden="true">·</span>
                  <span>{participants.length} People</span>
                </div>
                <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
                  {receipt.merchantName}
                </h1>
              </div>

              {/* Mobile Live Total Summary */}
              <div className="text-right lg:hidden shrink-0">
                <span className="block text-[11px] font-medium text-slate-500">Grand Total</span>
                <span className="text-lg font-bold font-mono tabular-nums text-blue-600">
                  {formatPhp(splitResult.grandTotal)}
                </span>
              </div>
            </div>

            {/* Ergonomic Touch Action Buttons (min-h-[44px] on mobile) */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                disabled={isScanningOcr}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Camera Scan</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanningOcr}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>From Gallery</span>
              </button>

              <button
                type="button"
                onClick={handleRunLiveOcrOnCurrentSample}
                disabled={isScanningOcr}
                className="col-span-2 sm:col-span-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                title="Renders a Philippine Peso thermal receipt image and sends it through the /api/receipt/parse Worker OCR endpoint"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Test Live AI OCR</span>
              </button>

              <div className="col-span-2 sm:col-span-1 flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                {SAMPLE_RECEIPT_PRESETS.map((preset) => {
                  const isActive = receipt.merchantName === preset.receipt.merchantName;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleLoadSamplePreset(preset.id)}
                      className={`flex-1 sm:flex-initial min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {preset.label.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* OCR Progress / Error / Status Notification */}
          {isScanningOcr && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs text-blue-900">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
              <span>{ocrStatusBanner || 'Running Gemini Vision OCR via workers.ts...'}</span>
            </div>
          )}

          {!isScanningOcr && ocrError && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{ocrError}</span>
              </div>
              <button
                type="button"
                onClick={() => setOcrError(null)}
                className="font-medium underline hover:text-red-950 whitespace-nowrap shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {!isScanningOcr && !ocrError && ocrStatusBanner && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-900">
              <span>{ocrStatusBanner}</span>
              <button
                type="button"
                onClick={() => setOcrStatusBanner(null)}
                className="text-emerald-700 hover:text-emerald-950 font-medium whitespace-nowrap shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}
        </section>

        {/* Main 3-Column Desktop Workbench / Tab-Switched Mobile View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (3 cols): Group Roster & Receipt Image Preview */}
          <div
            className={`lg:col-span-3 space-y-6 ${
              mobileTab === 'group' || mobileTab === 'receipt' ? 'block' : 'hidden lg:block'
            }`}
          >
            {/* Group Roster Panel */}
            <section
              className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${
                mobileTab === 'receipt' ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-700" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Barkada / Group ({participants.length})
                  </h2>
                </div>
                {activeParticipantFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setActiveParticipantFilter('all')}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap shrink-0"
                  >
                    Show All
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-500 mb-4">
                Add everyone sharing the bill. Tap a person to filter their assigned dishes.
              </p>

              {/* Add Person Form with 44px touch height */}
              <form onSubmit={handleAddParticipant} className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="Add person name..."
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  Add
                </button>
              </form>

              {/* Participant List */}
              <div className="space-y-2">
                {splitResult.participants.map((pb) => {
                  const p = pb.participant;
                  const isFocused = activeParticipantFilter === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`flex min-h-[52px] items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 transition-colors ${
                        isFocused
                          ? 'border-blue-600 bg-blue-50/50'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setActiveParticipantFilter((prev) => (prev === p.id ? 'all' : p.id))
                        }
                        className="flex items-center gap-3 text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: p.colorHex }}
                        >
                          {p.initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm sm:text-xs font-semibold text-slate-900">
                            {p.name}
                          </p>
                          <p className="text-xs sm:text-[11px] text-slate-500 font-mono tabular-nums">
                            {pb.assignedItems.length} items · {formatPhp(pb.totalOwed)}
                          </p>
                        </div>
                      </button>

                      {participants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(p.id)}
                          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-red-600 transition-colors"
                          aria-label={`Remove ${p.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Receipt Image & Metadata Panel */}
            <section
              className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4 ${
                mobileTab === 'group' ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-700" />
                  <h2 className="text-sm font-semibold text-slate-900">Receipt Details</h2>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-600">PHP (₱)</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Merchant / Restaurant Name
                  </label>
                  <input
                    type="text"
                    value={receipt.merchantName}
                    onChange={(e) =>
                      setReceipt((prev) => ({ ...prev, merchantName: e.target.value }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm sm:text-xs font-medium text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Receipt Date
                  </label>
                  <input
                    type="date"
                    value={receipt.receiptDate}
                    onChange={(e) =>
                      setReceipt((prev) => ({ ...prev, receiptDate: e.target.value }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm sm:text-xs font-mono text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {receiptPreviewUrl ? (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Scanned Receipt Photo</span>
                    <button
                      type="button"
                      onClick={() => setReceiptPreviewUrl(null)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="max-h-80 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    <img
                      src={receiptPreviewUrl}
                      alt="Scanned receipt"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain max-h-72"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-xs text-slate-500 mb-2">
                    No receipt image preview active. Capture a photo or test live OCR on the current sample.
                  </p>
                  <button
                    type="button"
                    onClick={handleRunLiveOcrOnCurrentSample}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    Generate &amp; Scan Sample Receipt
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* CENTER COLUMN (5 cols): Interactive Itemized Assignment Matrix */}
          <section
            id="item-matrix"
            className={`lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4 ${
              mobileTab === 'items' ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Tap Who Ordered Each Item
                </h2>
                <p className="text-xs text-slate-500">
                  Select one person for solo dishes or multiple people to split shared platters.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={assignAllItemsEqually}
                  className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Split All Equally
                </button>
                <button
                  type="button"
                  onClick={clearAllAssignments}
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Clear all item selections"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </div>

            {/* Mobile Horizontal Quick-Filter Bar for Participants */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:hidden">
              <button
                type="button"
                onClick={() => setActiveParticipantFilter('all')}
                className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeParticipantFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                All Items ({receipt.items.length})
              </button>
              {splitResult.participants.map((pb) => {
                const p = pb.participant;
                const active = activeParticipantFilter === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setActiveParticipantFilter((prev) => (prev === p.id ? 'all' : p.id))
                    }
                    className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: p.colorHex }}
                    />
                    <span>{p.name.split(' ')[0]}</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {formatPhp(pb.totalOwed)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Unassigned Items Warning Banner */}
            {!splitResult.isFullyAssigned && receipt.items.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    {splitResult.unassignedItemIds.length} item(s) totaling{' '}
                    <strong className="font-mono tabular-nums">
                      {formatPhp(splitResult.unassignedItemsSubtotal)}
                    </strong>{' '}
                    still unassigned.
                  </span>
                </div>
              </div>
            )}

            {/* Line Items Table / Touch Matrix */}
            <div className="divide-y divide-slate-200">
              {receipt.items.map((item) => {
                const assignedIds = assignments[item.id] || [];
                const isUnassigned = assignedIds.length === 0;
                const isAllAssigned =
                  participants.length > 0 && assignedIds.length === participants.length;
                const perPersonShare =
                  assignedIds.length > 0 ? item.totalPrice / assignedIds.length : item.totalPrice;

                const isHighlightedByFilter =
                  activeParticipantFilter === 'all' ||
                  assignedIds.includes(activeParticipantFilter);

                return (
                  <div
                    key={item.id}
                    className={`py-4 first:pt-1 transition-opacity ${
                      isHighlightedByFilter ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    {/* Top Row: Qty, Item Name, Price in PHP, Delete */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          aria-label="Quantity"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateLineItem(item.id, 'quantity', e.target.value)
                          }
                          className="min-h-[40px] w-12 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-center text-xs font-mono tabular-nums text-slate-700 focus:border-blue-600 focus:bg-white focus:outline-hidden"
                        />
                        <input
                          type="text"
                          aria-label="Item name"
                          value={item.name}
                          onChange={(e) => handleUpdateLineItem(item.id, 'name', e.target.value)}
                          className="min-h-[40px] flex-1 min-w-0 rounded-lg border border-transparent hover:border-slate-200 focus:border-blue-600 bg-transparent px-2 py-1 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-hidden"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="relative flex items-center">
                          <span className="pointer-events-none absolute left-2.5 text-xs font-mono text-slate-400">
                            ₱
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            aria-label="Item total price in Philippine Peso"
                            value={item.totalPrice}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, 'totalPrice', e.target.value)
                            }
                            className="min-h-[40px] w-28 rounded-lg border border-slate-200 bg-slate-50 pl-6 pr-2 py-1 text-right text-sm font-mono font-semibold tabular-nums text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteLineItem(item.id)}
                          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-colors"
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Thumb-Friendly Participant Selector Row (min-h-[44px] touch targets) */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {participants.map((person) => {
                          const isSelected = assignedIds.includes(person.id);
                          return (
                            <button
                              key={person.id}
                              type="button"
                              onClick={() => toggleParticipantOnItem(item.id, person.id)}
                              className={`inline-flex min-h-[42px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.96] whitespace-nowrap shrink-0 cursor-pointer ${
                                isSelected
                                  ? 'border-transparent text-white shadow-2xs'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              }`}
                              style={
                                isSelected ? { backgroundColor: person.colorHex } : undefined
                              }
                            >
                              <span className="font-bold">{person.initials}</span>
                              <span>{person.name.split(' ')[0]}</span>
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => assignEveryoneToItem(item.id)}
                          className={`min-h-[42px] rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.96] whitespace-nowrap shrink-0 cursor-pointer ${
                            isAllAssigned
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          All ({participants.length})
                        </button>
                      </div>

                      <div className="text-xs font-mono tabular-nums text-slate-500 ml-auto">
                        {isUnassigned ? (
                          <span className="text-amber-700 font-sans font-semibold">
                            Tap to assign
                          </span>
                        ) : assignedIds.length === 1 ? (
                          <span>Solo · {formatPhp(item.totalPrice)}</span>
                        ) : (
                          <span>
                            {assignedIds.length}-way · {formatPhp(perPersonShare)}/ea
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add New Manual Line Item Form */}
            <form
              onSubmit={handleAddManualItem}
              className="grid grid-cols-12 sm:flex sm:flex-nowrap items-center gap-2 border-t border-slate-200 pt-4"
            >
              <input
                type="number"
                min="1"
                step="1"
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                placeholder="Qty"
                className="col-span-3 sm:w-16 min-h-[44px] rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-center text-sm sm:text-xs font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-hidden"
              />
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Item name (e.g. Extra Rice)"
                className="col-span-9 sm:flex-1 min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden"
              />
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="₱ Price"
                className="col-span-7 sm:w-28 min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-right text-sm sm:text-xs font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden"
              />
              <button
                type="submit"
                className="col-span-5 sm:w-auto inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            </form>
          </section>

          {/* RIGHT COLUMN (4 cols): VAT, Service Charge & Individual Settlement Ledger */}
          <div
            id="settlement-ledger"
            className={`lg:col-span-4 space-y-6 ${
              mobileTab === 'settle' ? 'block' : 'hidden lg:block'
            }`}
          >
            {/* VAT, Service Charge & Split Method Controls */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    VAT, Service Charge &amp; Split Math
                  </h2>
                  <p className="text-xs text-slate-500">
                    Distribute tax and tip proportionally or equally.
                  </p>
                </div>

                {/* Proportional vs Equal Segmented Toggle */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() =>
                      setTaxTipConfig((prev) => ({ ...prev, mode: 'proportional' }))
                    }
                    className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      taxTipConfig.mode === 'proportional'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Proportional
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxTipConfig((prev) => ({ ...prev, mode: 'equal' }))}
                    className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      taxTipConfig.mode === 'equal'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Equal
                  </button>
                </div>
              </div>

              {/* Tax, Service Fee, Discount Inputs in PHP */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    VAT / Tax (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxTipConfig.customTaxAmount}
                    onChange={(e) =>
                      setTaxTipConfig((prev) => ({
                        ...prev,
                        customTaxAmount: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-xs font-mono font-semibold tabular-nums text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Other Fee (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxTipConfig.customServiceFeeAmount}
                    onChange={(e) =>
                      setTaxTipConfig((prev) => ({
                        ...prev,
                        customServiceFeeAmount: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-xs font-mono font-semibold tabular-nums text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Discount (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxTipConfig.customDiscountAmount}
                    onChange={(e) =>
                      setTaxTipConfig((prev) => ({
                        ...prev,
                        customDiscountAmount: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-xs font-mono font-semibold tabular-nums text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Service Charge / Tip Presets (Philippine restaurants commonly charge 10% SC) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">
                    Service Charge / Tip
                  </span>
                  <span className="text-xs font-mono font-semibold tabular-nums text-slate-900">
                    {formatPhp(splitResult.effectiveTip)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[0, 10, 12, 15].map((pct) => {
                    const isSelected =
                      taxTipConfig.tipMode === 'percentage' &&
                      taxTipConfig.tipPercentage === pct;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() =>
                          setTaxTipConfig((prev) => ({
                            ...prev,
                            tipMode: 'percentage',
                            tipPercentage: pct,
                          }))
                        }
                        className={`flex-1 min-h-[42px] rounded-xl border py-1.5 text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pct}%
                      </button>
                    );
                  })}

                  <div className="relative w-28">
                    <span className="pointer-events-none absolute left-2.5 top-3 text-xs font-mono text-slate-400">
                      ₱
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      aria-label="Custom fixed tip in Philippine Peso"
                      placeholder="Custom"
                      value={
                        taxTipConfig.tipMode === 'fixed' ? taxTipConfig.tipFixedAmount : ''
                      }
                      onChange={(e) =>
                        setTaxTipConfig((prev) => ({
                          ...prev,
                          tipMode: 'fixed',
                          tipFixedAmount: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className={`min-h-[42px] w-full rounded-xl border pl-6 pr-2 py-1.5 text-right text-xs font-mono tabular-nums focus:outline-hidden ${
                        taxTipConfig.tipMode === 'fixed'
                          ? 'border-blue-600 bg-blue-50/40 font-semibold text-slate-900'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Receipt Totals Reconciliation Summary */}
              <div className="space-y-1.5 border-t border-slate-200 pt-3 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Items Subtotal</span>
                  <span className="font-mono tabular-nums">
                    {formatPhp(splitResult.receiptSubtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>VAT / Tax + Fees</span>
                  <span className="font-mono tabular-nums">
                    {formatPhp(splitResult.effectiveTax + splitResult.effectiveServiceFee)}
                  </span>
                </div>
                {splitResult.effectiveDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount Deducted</span>
                    <span className="font-mono tabular-nums">
                      -{formatPhp(splitResult.effectiveDiscount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Service Charge / Tip</span>
                  <span className="font-mono tabular-nums">
                    {formatPhp(splitResult.effectiveTip)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                  <span>Grand Total</span>
                  <span className="font-mono tabular-nums text-blue-600">
                    {formatPhp(splitResult.grandTotal)}
                  </span>
                </div>
              </div>
            </section>

            {/* Individual Settlement Ledger */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Per-Person Share (PHP)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Exact centavo breakdown ready for GCash, Maya, or bank transfer.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleNativeShareSummary}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Share</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopySummary(buildFullSettlementReport(), 'all-settlement')
                    }
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedId === 'all-settlement' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-200">
                {splitResult.participants.map((pb) => {
                  const p = pb.participant;
                  const sharePct = Math.round(pb.subtotalShareRatio * 100);
                  const singleCopyText = `${p.name}: ${formatPhp(pb.totalOwed)} for ${receipt.merchantName} (Items: ${formatPhp(pb.itemsSubtotal)}, VAT/Fee: ${formatPhp(pb.taxShare + pb.serviceFeeShare - pb.discountShare)}, Tip: ${formatPhp(pb.tipShare)})`;

                  return (
                    <div key={p.id} className="py-3.5 first:pt-1 last:pb-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: p.colorHex }}
                          >
                            {p.initials}
                          </span>
                          <div className="min-w-0">
                            <span className="text-sm font-bold text-slate-900">{p.name}</span>
                            <span className="ml-2 text-xs text-slate-500 font-mono tabular-nums">
                              {sharePct}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                            {formatPhp(pb.totalOwed)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopySummary(singleCopyText, p.id)}
                            className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                            title={`Copy ${p.name}'s share`}
                          >
                            {copiedId === p.id ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Assigned Item Lines */}
                      {pb.assignedItems.length > 0 ? (
                        <div className="pl-9 space-y-1">
                          {pb.assignedItems.map((ai) => (
                            <div
                              key={ai.itemId}
                              className="flex items-center justify-between text-xs text-slate-600"
                            >
                              <span className="truncate pr-2">
                                {ai.name}
                                {ai.sharedByCount > 1 && (
                                  <span className="ml-1.5 text-[11px] font-mono text-slate-400">
                                    (1/{ai.sharedByCount})
                                  </span>
                                )}
                              </span>
                              <span className="font-mono tabular-nums shrink-0">
                                {formatPhp(ai.sharePrice)}
                              </span>
                            </div>
                          ))}

                          {/* Proportional Tax & Tip sub-row */}
                          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 font-mono tabular-nums border-t border-slate-100">
                            <span>
                              Items {formatPhp(pb.itemsSubtotal)} · VAT{' '}
                              {formatPhp(pb.taxShare + pb.serviceFeeShare - pb.discountShare)} ·
                              Tip {formatPhp(pb.tipShare)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="pl-9 text-xs text-slate-400 italic">
                          No receipt items assigned yet.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Quiet Desktop Footer */}
      <footer className="hidden lg:block border-t border-slate-200 bg-white px-6 py-4 mt-12">
        <div className="mx-auto max-w-[1440px] flex flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            TabSplit PH — Receipt OCR &amp; Proportional Expense Splitter in Philippine Peso (₱) built for Cloudflare Workers (`workers.ts`).
          </span>
          <button
            type="button"
            onClick={() => setIsArchDrawerOpen(true)}
            className="font-medium text-slate-700 hover:text-slate-900 underline cursor-pointer"
          >
            Inspect Segregated Worker Architecture &amp; Run Unit Tests
          </button>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar (4 Tabs, Natural Thumb Zone, <15% Sticky Cap) */}
      <nav
        aria-label="Mobile workspace navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-4 items-center border-t border-slate-200 bg-white/95 px-2 backdrop-blur-md lg:hidden"
      >
        <button
          type="button"
          onClick={() => setMobileTab('items')}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            mobileTab === 'items' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Receipt className="h-5 w-5" />
          <span className="mt-0.5 text-[11px] font-semibold tracking-tight">
            Items ({receipt.items.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('group')}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            mobileTab === 'group' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="mt-0.5 text-[11px] font-semibold tracking-tight">
            Barkada ({participants.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('settle')}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            mobileTab === 'settle' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Calculator className="h-5 w-5" />
          <span className="mt-0.5 text-[11px] font-semibold tracking-tight">
            Split &amp; Pay
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('receipt')}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            mobileTab === 'receipt' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText className="h-5 w-5" />
          <span className="mt-0.5 text-[11px] font-semibold tracking-tight">
            Receipt
          </span>
        </button>
      </nav>

      {/* Modals */}
      <ReceiptCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCaptureDataUrl={(dataUrl, mime) =>
          runReceiptOcr(dataUrl, mime, 'Camera Capture')
        }
      />

      <WorkerArchitectureDrawer
        isOpen={isArchDrawerOpen}
        onClose={() => setIsArchDrawerOpen(false)}
      />
    </div>
  );
}
