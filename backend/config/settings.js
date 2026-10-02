import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export const config = {
  port: Number(process.env.PORT || 3001),
  frontendPort: Number(process.env.FRONTEND_PORT || 5173),
  rootDir,
  allowedRoots: (process.env.ALLOWED_ROOTS || `${rootDir},${path.join(process.env.HOMEDRIVE || 'C:', process.env.HOMEPATH || 'Users/PC1/Documents')}`).split(',').map((value) => value.trim()).filter(Boolean),
  aiProvider: process.env.AI_PROVIDER || 'local',
  openAiKey: process.env.OPENAI_API_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'development-secret',
  maxHistory: Number(process.env.MAX_HISTORY || 200),
};
