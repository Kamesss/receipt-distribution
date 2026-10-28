/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Segregated OCR Extraction Service using @google/genai.
 * Accepts an explicit API key string so it works identically in Cloudflare Workers (`env.GEMINI_API_KEY`)
 * and Node.js server runtimes (`process.env.GEMINI_API_KEY`) without global state coupling.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { ParsedReceiptData } from '../types/receipt.ts';
import { normalizeParsedReceipt, OcrParseRequestPayload } from './receiptValidator.ts';

export interface ReceiptOcrExtractor {
  extractReceiptFromImage(payload: OcrParseRequestPayload): Promise<ParsedReceiptData>;
}

/**
 * Factory creating a loosely coupled Gemini OCR extractor instance.
 */
export function createGeminiReceiptOcrExtractor(apiKey: string): ReceiptOcrExtractor {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  return {
    async extractReceiptFromImage(payload: OcrParseRequestPayload): Promise<ParsedReceiptData> {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: payload.mimeType,
                data: payload.imageBase64,
              },
            },
            {
              text:
                'Perform high-precision OCR on this receipt image. Extract the merchant name, receipt date (YYYY-MM-DD), currency code (default to PHP for Philippine Peso unless another currency is explicitly printed), every individual purchased line item with its quantity, unit price, and total line price, plus the receipt subtotal, tax (VAT), tip/service charge, any discount, and the final total. Do not include subtotal, tax, or tip lines inside the items array.',
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              merchantName: {
                type: Type.STRING,
                description: 'Name of the restaurant, store, or merchant.',
              },
              receiptDate: {
                type: Type.STRING,
                description: 'Date on the receipt in YYYY-MM-DD format if visible.',
              },
              currency: {
                type: Type.STRING,
                description: 'Three-letter ISO currency code, defaulting to PHP (Philippine Peso).',
              },
              items: {
                type: Type.ARRAY,
                description: 'List of individual purchased line items excluding tax, tip, and subtotals.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: {
                      type: Type.STRING,
                      description: 'Unique identifier for the line item such as item-1, item-2.',
                    },
                    name: {
                      type: Type.STRING,
                      description: 'Clean, human-readable item name from the receipt.',
                    },
                    quantity: {
                      type: Type.NUMBER,
                      description: 'Quantity purchased for this line item (default 1).',
                    },
                    unitPrice: {
                      type: Type.NUMBER,
                      description: 'Price of a single unit of this item.',
                    },
                    totalPrice: {
                      type: Type.NUMBER,
                      description: 'Total extended price for this line item (quantity * unitPrice).',
                    },
                    category: {
                      type: Type.STRING,
                      description: 'Optional category such as Food, Beverage, Shared, Entree.',
                    },
                  },
                  required: ['name', 'quantity', 'unitPrice', 'totalPrice'],
                },
              },
              subtotal: {
                type: Type.NUMBER,
                description: 'Subtotal before tax, tip, and fees.',
              },
              tax: {
                type: Type.NUMBER,
                description: 'Total sales tax or VAT amount.',
              },
              tip: {
                type: Type.NUMBER,
                description: 'Gratuity or tip amount if already included on the receipt, else 0.',
              },
              serviceFee: {
                type: Type.NUMBER,
                description: 'Any additional service charge, delivery fee, or surcharge, else 0.',
              },
              discount: {
                type: Type.NUMBER,
                description: 'Total discount or promotion deducted from the bill, else 0.',
              },
              total: {
                type: Type.NUMBER,
                description: 'Grand total printed on the receipt.',
              },
            },
            required: ['merchantName', 'items', 'subtotal', 'tax', 'total'],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error('OCR model returned an empty response.');
      }

      const parsedJson = JSON.parse(rawText.trim());
      return normalizeParsedReceipt(parsedJson);
    },
  };
}
