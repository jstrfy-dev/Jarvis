import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config/settings.js';
import { processCommand, confirmAction } from './ai/intentRouter.js';
import { memoryStore } from './memory/memoryStore.js';
import { getSystemOverview } from './services/systemService.js';
import { activityLogger } from './services/activityLogger.js';
import { toolRegistry } from './tools/toolRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

const sendToClients = (payload) => {
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(payload));
    }
  }
};

activityLogger.setSocketBroadcast(sendToClients);

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'status', payload: { online: true, message: 'JARVIS Core connection restored.' } }));
  activityLogger.add('Connection established to JARVIS Core');

  ws.on('close', () => {
    clients.delete(ws);
    activityLogger.add('JARVIS Core connection closed');
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'JARVIS core online',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/system', (req, res) => {
  res.json(getSystemOverview());
});

app.get('/api/tools', (req, res) => {
  res.json(toolRegistry.list());
});

app.get('/api/memory', (req, res) => {
  res.json(memoryStore.list());
});

app.post('/api/memory', (req, res) => {
  const { key, value, mode = 'set' } = req.body || {};
  if (mode === 'delete') {
    const deleted = memoryStore.delete(key);
    return res.json({ status: 'completed', deleted, message: 'Memory entry removed.' });
  }

  if (!key || !value) {
    return res.status(400).json({ status: 'error', message: 'Memory requires both a key and value.' });
  }

  memoryStore.set(key, value);
  return res.json({ status: 'completed', key, value });
});

app.post('/api/command', async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) {
    return res.status(400).json({ status: 'error', message: 'No command was provided.' });
  }

  try {
    const result = await processCommand(text, { directory: req.body?.directory || process.cwd() });
    if (result.requiresConfirmation) {
      activityLogger.add(`Pending confirmation: ${result.pendingAction?.description || 'high-risk action'}`);
    }
    return res.json(result);
  } catch (error) {
    activityLogger.add(`Command error: ${error.message}`, 'error');
    return res.status(500).json({ status: 'error', response: 'Unable to complete the requested action.' });
  }
});

app.post('/api/confirm', async (req, res) => {
  const actionId = String(req.body?.actionId || '');
  const confirmed = Boolean(req.body?.confirmed);

  if (!actionId) {
    return res.status(400).json({ status: 'error', message: 'A pending action identifier is required.' });
  }

  try {
    const result = await confirmAction(actionId, confirmed);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ status: 'error', response: 'Unable to confirm the requested action.' });
  }
});

app.post('/api/activity/clear', (req, res) => {
  activityLogger.clear();
  res.json({ status: 'completed', message: 'Activity log cleared.' });
});

const distDir = path.resolve(rootDir, 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

server.listen(config.port, '0.0.0.0', () => {
  activityLogger.add(`JARVIS backend started on port ${config.port}`);
  console.log(`JARVIS backend listening on http://localhost:${config.port}`);
});
