/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Full-stack Express server that bridges incoming `/api/*` requests directly to
 * the segregated Cloudflare Workers handler (`routeWorkerRequest` in `workers.ts`)
 * and serves the Vite SPA frontend on port 3000.
 */

import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { routeWorkerRequest } from './workers.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for high-resolution receipt photos
  app.use(express.json({ limit: '25mb' }));

  // Forward all `/api/*` requests through the Cloudflare Workers `routeWorkerRequest` handler
  app.all('/api/*splat', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        dotenv.config({ override: true });
      }
      const protocol = req.protocol || 'http';
      const host = req.get('host') || `localhost:${PORT}`;
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          headers.set(key, value);
        } else if (Array.isArray(value)) {
          headers.set(key, value.join(', '));
        }
      }

      const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
      const workerRequest = new Request(fullUrl, {
        method: req.method,
        headers,
        body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
      });

      const workerResponse = await routeWorkerRequest(workerRequest, {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.API_KEY || '',
      });

      res.status(workerResponse.status);
      workerResponse.headers.forEach((val, key) => {
        res.setHeader(key, val);
      });

      const responseText = await workerResponse.text();
      res.send(responseText);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Internal server error in worker bridge.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*splat', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
