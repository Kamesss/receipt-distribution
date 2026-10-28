/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Check, Terminal, Layers, ShieldCheck, Cpu } from 'lucide-react';
import { calculateBillSplit, distributeCentsProportionally } from '../services/billSplitCalculator.ts';

interface WorkerArchitectureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SelfTestResult {
  name: string;
  moduleName: string;
  passed: boolean;
  assertionDetail: string;
}

export const WorkerArchitectureDrawer: React.FC<WorkerArchitectureDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [testResults, setTestResults] = useState<SelfTestResult[] | null>(null);

  if (!isOpen) return null;

  const runDeterministicUnitTests = () => {
    const results: SelfTestResult[] = [];

    // Test 1: Centavo remainder distribution (Hare-Niemeyer)
    const shares = distributeCentsProportionally(1000, [1, 1, 1]);
    const sumShares = shares.reduce((a, b) => a + b, 0);
    results.push({
      name: '3-Way ₱10.00 Odd-Centavo Remainder Split',
      moduleName: 'billSplitCalculator.distributeCentsProportionally',
      passed: sumShares === 1000 && shares.includes(334) && shares.filter((x) => x === 333).length === 2,
      assertionDetail: `Input 1000c across [1,1,1] -> [${shares.join('c, ')}c] (Sum = ${sumShares}c)`,
    });

    // Test 2: Proportional Tax & Tip Calculation
    const split = calculateBillSplit(
      [
        { id: '1', name: 'Item A', quantity: 1, unitPrice: 200, totalPrice: 200 },
        { id: '2', name: 'Item B', quantity: 1, unitPrice: 600, totalPrice: 600 },
      ],
      [
        { id: 'u1', name: 'Maya', initials: 'MS', colorHex: '#2563EB' },
        { id: 'u2', name: 'Marco', initials: 'MR', colorHex: '#059669' },
      ],
      { '1': ['u1'], '2': ['u2'] },
      {
        mode: 'proportional',
        customTaxAmount: 96.0,
        customServiceFeeAmount: 0,
        customDiscountAmount: 0,
        tipMode: 'fixed',
        tipPercentage: 0,
        tipFixedAmount: 80.0,
      }
    );
    const maya = split.participants[0];
    const marco = split.participants[1];
    results.push({
      name: '25% / 75% Proportional VAT & Service Charge Allocation',
      moduleName: 'billSplitCalculator.calculateBillSplit',
      passed:
        maya.taxShare === 24.0 &&
        marco.taxShare === 72.0 &&
        maya.tipShare === 20.0 &&
        marco.tipShare === 60.0 &&
        maya.totalOwed + marco.totalOwed === 976.0,
      assertionDetail: `Maya (25%): ₱${maya.totalOwed.toFixed(2)} (VAT ₱${maya.taxShare.toFixed(2)}, Tip ₱${maya.tipShare.toFixed(2)}) · Marco (75%): ₱${marco.totalOwed.toFixed(2)}`,
    });

    // Test 3: Shared Multi-Person Item & Unassigned Detection
    const sharedSplit = calculateBillSplit(
      [
        { id: 'shared-1', name: 'Sisig Platter', quantity: 1, unitPrice: 550, totalPrice: 550 },
        { id: 'unassigned-2', name: 'Garlic Rice', quantity: 1, unitPrice: 240, totalPrice: 240 },
      ],
      [
        { id: 'u1', name: 'Maya', initials: 'MS', colorHex: '#2563EB' },
        { id: 'u2', name: 'Marco', initials: 'MR', colorHex: '#059669' },
      ],
      { 'shared-1': ['u1', 'u2'] },
      {
        mode: 'proportional',
        customTaxAmount: 0,
        customServiceFeeAmount: 0,
        customDiscountAmount: 0,
        tipMode: 'fixed',
        tipPercentage: 0,
        tipFixedAmount: 0,
      }
    );
    results.push({
      name: 'Shared Dish Division & Unassigned Item Tracking',
      moduleName: 'billSplitCalculator.calculateBillSplit',
      passed:
        !sharedSplit.isFullyAssigned &&
        sharedSplit.unassignedItemsSubtotal === 240.0 &&
        sharedSplit.participants[0].itemsSubtotal === 275.0 &&
        sharedSplit.participants[1].itemsSubtotal === 275.0,
      assertionDetail: `Assigned: ₱${sharedSplit.assignedItemsSubtotal.toFixed(2)} (₱275.00 each) · Unassigned: ₱${sharedSplit.unassignedItemsSubtotal.toFixed(2)}`,
    });

    setTestResults(results);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="worker-arch-title"
    >
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="worker-arch-title" className="text-base font-semibold text-slate-900">
              Cloudflare Workers Segregated Architecture (`workers.ts`)
            </h2>
            <p className="text-xs text-slate-500">
              Decoupled domain layers for edge execution, dependency injection, and deterministic testing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 mb-1.5">
                <Layers className="h-4 w-4 text-blue-600" />
                <span>1. Edge Transport Router (`workers.ts`)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Implements standard Web Fetch API (`ExportedHandler&lt;Env&gt;`). Handles CORS,
                JSON serialization, and routes `/api/receipt/parse` and `/api/split/calculate`
                via injected service interfaces (`WorkerDependencies`).
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 mb-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>2. Input & Schema Validator (`receiptValidator.ts`)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pure validation functions (`validateOcrRequest`, `normalizeParsedReceipt`) that
                sanitize MIME types, strip data URL prefixes, and reconcile line-item subtotals
                independently of the HTTP or AI layer.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 mb-1.5">
                <Cpu className="h-4 w-4 text-violet-600" />
                <span>3. OCR Extraction Service (`receiptOcrService.ts`)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Encapsulates `@google/genai` multimodal receipt parsing behind the
                `ReceiptOcrExtractor` interface. Accepts `env.GEMINI_API_KEY` explicitly so
                mock extractors can be injected during tests.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 mb-1.5">
                <Terminal className="h-4 w-4 text-amber-600" />
                <span>4. Financial Split Engine (`billSplitCalculator.ts`)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Zero-dependency cent-integer calculator implementing the Hare-Niemeyer Largest
                Remainder algorithm so shared items, proportional tax, and tip always sum to
                the exact receipt total.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  In-Browser Domain Unit Test Runner
                </h3>
                <p className="text-xs text-slate-500">
                  Verify the decoupled `billSplitCalculator.ts` invariants directly in the client.
                </p>
              </div>
              <button
                type="button"
                onClick={runDeterministicUnitTests}
                className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Run Suite (3 Tests)
              </button>
            </div>

            {testResults && (
              <div className="space-y-2">
                {testResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-semibold text-slate-900">{result.name}</span>
                      </div>
                      <p className="text-xs font-mono text-slate-500">{result.assertionDetail}</p>
                    </div>
                    <span className="text-xs font-mono text-emerald-700 shrink-0">
                      {result.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
