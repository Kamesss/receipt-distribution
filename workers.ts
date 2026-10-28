/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cloudflare Workers Entrypoint (`workers.ts`)
 *
 * Architectural Segregation:
 * 1. HTTP Transport & CORS Layer (`jsonResponse`, `handleOptions`, `routeWorkerRequest`)
 * 2. Input Validation Layer (`src/services/receiptValidator.ts`)
 * 3. OCR AI Extraction Layer (`src/services/receiptOcrService.ts`)
 * 4. Pure Financial Calculation Engine (`src/services/billSplitCalculator.ts`)
 *
 * Each layer is loosely coupled via explicit interfaces (`WorkerDependencies`) so routes
 * can be unit-tested in isolation without network calls or global state.
 */

import { calculateBillSplit } from './src/services/billSplitCalculator.ts';
import {
  createGeminiReceiptOcrExtractor,
  ReceiptOcrExtractor,
} from './src/services/receiptOcrService.ts';
import {
  validateCalculateSplitRequest,
  validateOcrRequest,
} from './src/services/receiptValidator.ts';

export interface Env {
  GEMINI_API_KEY: string;
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
}

export interface WorkerDependencies {
  getOcrExtractor?: (apiKey: string) => ReceiptOcrExtractor;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Standardized JSON response builder with CORS and cache-control headers.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Segregated request router for Cloudflare Workers Web Fetch API (`Request` -> `Response`).
 * Accepts optional dependency overrides (`deps`) for deterministic unit testing.
 */
export async function routeWorkerRequest(
  request: Request,
  env: Env,
  deps: WorkerDependencies = {}
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    // 1. Health & Architecture Inspection Endpoint
    if (pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse({
        status: 'ok',
        runtime: 'cloudflare-workers-compatible',
        modules: [
          'workers.ts (HTTP Router & Edge Handler)',
          'src/services/receiptValidator.ts (Schema & Payload Normalization)',
          'src/services/receiptOcrService.ts (Gemini Vision OCR Adapter)',
          'src/services/billSplitCalculator.ts (Hare-Niemeyer Cent-Exact Splitter)',
        ],
      });
    }

    // 2. Receipt OCR Extraction Endpoint
    if (pathname === '/api/receipt/parse' && request.method === 'POST') {
      const rawBody = await request.json();
      const validatedPayload = validateOcrRequest(rawBody);
      const factory = deps.getOcrExtractor ?? createGeminiReceiptOcrExtractor;
      const extractor = factory(env.GEMINI_API_KEY);
      const receipt = await extractor.extractReceiptFromImage(validatedPayload);

      return jsonResponse({ receipt }, 200);
    }

    // 3. Deterministic Bill Split Calculation Endpoint
    if (pathname === '/api/split/calculate' && request.method === 'POST') {
      const rawBody = await request.json();
      const validated = validateCalculateSplitRequest(rawBody);
      const calculation = calculateBillSplit(
        validated.items,
        validated.participants,
        validated.assignments,
        validated.config
      );

      return jsonResponse({ calculation }, 200);
    }

    // 4. Static Asset Fallback for Cloudflare Workers Assets binding
    if (env.ASSETS && (request.method === 'GET' || request.method === 'HEAD')) {
      return env.ASSETS.fetch(request);
    }

    return jsonResponse(
      { error: `Route not found: ${request.method} ${pathname}` },
      404
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unexpected error processing receipt request.';
    const status =
      message.includes('Missing') ||
      message.includes('must be') ||
      message.includes('requires')
        ? 400
        : 500;

    return jsonResponse({ error: message }, status);
  }
}

/**
 * Default Cloudflare Workers module export (`ExportedHandler<Env>`).
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return routeWorkerRequest(request, env);
  },
};
