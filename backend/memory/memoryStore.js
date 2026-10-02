import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/settings.js';

const memoryDir = path.resolve(config.rootDir, 'backend', 'data');
const memoryFile = path.join(memoryDir, 'memory.json');

function ensureMemoryFile() {
  fs.mkdirSync(memoryDir, { recursive: true });
  if (!fs.existsSync(memoryFile)) {
    fs.writeFileSync(memoryFile, JSON.stringify({}, null, 2), 'utf8');
  }
}

class MemoryStore {
  constructor() {
    this.data = {};
    ensureMemoryFile();
    this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(memoryFile, 'utf8');
      this.data = JSON.parse(raw || '{}');
    } catch (error) {
      this.data = {};
    }
  }

  save() {
    fs.writeFileSync(memoryFile, JSON.stringify(this.data, null, 2), 'utf8');
  }

  list() {
    return Object.entries(this.data).map(([key, value]) => ({ key, value }));
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
    return this.data[key];
  }

  delete(key) {
    const deleted = this.data[key];
    delete this.data[key];
    this.save();
    return deleted;
  }

  clear() {
    this.data = {};
    this.save();
  }
}

export const memoryStore = new MemoryStore();
