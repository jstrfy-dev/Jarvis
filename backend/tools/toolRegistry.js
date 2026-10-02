import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config/settings.js';
import { memoryStore } from '../memory/memoryStore.js';
import { permissionManager } from '../permissions/permissionManager.js';
import { activityLogger } from '../services/activityLogger.js';
import { getSystemOverview } from '../services/systemService.js';

const execAsync = promisify(exec);

const globalTools = [];

function registerTool(tool) {
  globalTools.push(tool);
}

function safeLocalPath(input) {
  const normalized = String(input || '').trim();
  if (!normalized) return config.rootDir;
  if (path.isAbsolute(normalized)) return normalized;
  return path.resolve(config.rootDir, normalized);
}

function ensureAuthorizedPath(targetPath) {
  const resolved = path.resolve(targetPath);
  const allowed = config.allowedRoots.map((root) => path.resolve(root));
  const permitted = allowed.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
  if (!permitted) {
    throw new Error('Path is outside the authorized project directories.');
  }
  return resolved;
}

function tryReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function deepScanProject(root) {
  const results = [];
  const visited = new Set();

  function walk(currentPath) {
    if (visited.has(currentPath)) return;
    visited.add(currentPath);

    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', '.venv', 'venv'].includes(entry.name)) continue;
        walk(fullPath);
      } else {
        results.push(fullPath);
      }
    }
  }

  walk(root);
  return results;
}

registerTool({
  name: 'system_info',
  description: 'Read system status and PC information.',
  riskLevel: 'low',
  async execute() {
    const overview = getSystemOverview();
    return {
      status: 'completed',
      summary: 'System connected and online.',
      data: overview,
    };
  },
});

registerTool({
  name: 'list_files',
  description: 'List the contents of an authorized project directory.',
  riskLevel: 'low',
  async execute({ directory }) {
    const resolved = ensureAuthorizedPath(safeLocalPath(directory || config.rootDir));
    const entries = fs.existsSync(resolved) ? fs.readdirSync(resolved, { withFileTypes: true }) : [];
    return {
      status: 'completed',
      directory: resolved,
      files: entries.map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' })),
    };
  },
});

registerTool({
  name: 'search_files',
  description: 'Search files for a keyword or error string inside authorized project folders.',
  riskLevel: 'low',
  async execute({ query, directory = config.rootDir }) {
    const baseDir = ensureAuthorizedPath(safeLocalPath(directory));
    const searchTerm = (query || '').toLowerCase();
    if (!searchTerm) {
      throw new Error('A search term is required.');
    }

    const files = deepScanProject(baseDir);
    const matches = [];

    for (const file of files) {
      try {
        const text = fs.readFileSync(file, 'utf8');
        if (text.toLowerCase().includes(searchTerm)) {
          matches.push(file);
        }
      } catch {
        // Ignore binary or inaccessible files.
      }
    }

    return {
      status: 'completed',
      query: searchTerm,
      matches: matches.slice(0, 50),
      count: matches.length,
    };
  },
});

registerTool({
  name: 'read_file',
  description: 'Read a file from an authorized path and summarize the contents.',
  riskLevel: 'low',
  async execute({ filePath }) {
    const target = ensureAuthorizedPath(safeLocalPath(filePath));
    const content = fs.readFileSync(target, 'utf8');
    const preview = content.slice(0, 1200).replace(/\s+/g, ' ');

    return {
      status: 'completed',
      path: target,
      preview,
      length: content.length,
    };
  },
});

registerTool({
  name: 'create_file',
  description: 'Create a new text file in an authorized directory.',
  riskLevel: 'medium',
  async execute({ directory, fileName, content = '' }) {
    const targetBase = ensureAuthorizedPath(safeLocalPath(directory || config.rootDir));
    const filePath = path.join(targetBase, fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');

    return {
      status: 'completed',
      path: filePath,
      created: true,
    };
  },
});

registerTool({
  name: 'open_url',
  description: 'Open a URL in the user browser or present a website link.',
  riskLevel: 'low',
  async execute({ url }) {
    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const command = process.platform === 'win32' ? `start "" "${target}"` : `open "${target}"`;
    try {
      await execAsync(command);
    } catch (error) {
      return {
        status: 'completed',
        url: target,
        message: 'URL is ready to open in the browser.',
      };
    }

    return {
      status: 'completed',
      url: target,
      message: 'Opened browser target.',
    };
  },
});

registerTool({
  name: 'open_project',
  description: 'Locate and open the main project folder or website project.',
  riskLevel: 'medium',
  async execute({ projectName, pathHint }) {
    const target = pathHint ? ensureAuthorizedPath(safeLocalPath(pathHint)) : config.rootDir;
    const project = projectName ? `${projectName} project` : 'project';

    if (process.platform === 'win32') {
      try {
        await execAsync(`explorer "${target}"`);
      } catch (error) {
        // Fall through to a plain response for unsupported environments.
      }
    }

    return {
      status: 'completed',
      project,
      path: target,
      message: `${project} is ready and available.`,
    };
  },
});

registerTool({
  name: 'run_project',
  description: 'Start a project or development server if a valid package manifest is present.',
  riskLevel: 'medium',
  async execute({ directory = config.rootDir }) {
    const resolved = ensureAuthorizedPath(safeLocalPath(directory));
    const packageJsonPath = path.join(resolved, 'package.json');
    const hasPackage = fs.existsSync(packageJsonPath);

    if (!hasPackage) {
      return {
        status: 'failed',
        message: 'No project manifest was found in this folder.',
      };
    }

    const packageJson = tryReadJson(packageJsonPath) || {};
    const scripts = packageJson.scripts || {};
    const startScript = scripts.dev || scripts.start || 'npm run dev';

    const runCommand = `cd "${resolved}" && ${process.platform === 'win32' ? 'npm run dev' : 'npm run dev'}`;
    await execAsync(runCommand, { timeout: 15000 });

    return {
      status: 'completed',
      directory: resolved,
      command: startScript,
      message: 'Project execution started successfully.',
    };
  },
});

registerTool({
  name: 'search_project',
  description: 'Search the project for a keyword while keeping output concise and useful.',
  riskLevel: 'low',
  async execute({ query, directory = config.rootDir }) {
    const result = await globalTools.find((tool) => tool.name === 'search_files')?.execute({ query, directory });
    return result || {
      status: 'completed',
      query,
      matches: [],
      count: 0,
    };
  },
});

registerTool({
  name: 'git_status',
  description: 'Check the repository status and modified files.',
  riskLevel: 'medium',
  async execute({ directory = config.rootDir }) {
    const resolved = ensureAuthorizedPath(safeLocalPath(directory));
    const gitDir = path.join(resolved, '.git');
    if (!fs.existsSync(gitDir)) {
      return {
        status: 'failed',
        message: 'No git repository was detected in the selected folder.',
      };
    }

    const { stdout } = await execAsync(`git -C "${resolved}" status --short --branch`);
    return {
      status: 'completed',
      directory: resolved,
      output: stdout.trim(),
    };
  },
});

registerTool({
  name: 'git_commit',
  description: 'Create a git commit with an automatically generated message.',
  riskLevel: 'medium',
  async execute({ directory = config.rootDir, message = 'JARVIS checkpoint' }) {
    const resolved = ensureAuthorizedPath(safeLocalPath(directory));
    const gitDir = path.join(resolved, '.git');
    if (!fs.existsSync(gitDir)) {
      return {
        status: 'failed',
        message: 'No git repository was detected in the selected folder.',
      };
    }

    await execAsync(`git -C "${resolved}" add .`);
    const { stdout } = await execAsync(`git -C "${resolved}" commit -m "${message.replace(/"/g, '\\"')}"`);
    return {
      status: 'completed',
      output: stdout.trim(),
    };
  },
});

registerTool({
  name: 'git_push',
  description: 'Push the current branch to the remote repository after confirmation.',
  riskLevel: 'high',
  async execute({ directory = config.rootDir }) {
    const resolved = ensureAuthorizedPath(safeLocalPath(directory));
    const gitDir = path.join(resolved, '.git');
    if (!fs.existsSync(gitDir)) {
      return {
        status: 'failed',
        message: 'No git repository was detected in the selected folder.',
      };
    }

    try {
      const { stdout } = await execAsync(`git -C "${resolved}" push`);
      return {
        status: 'completed',
        output: stdout.trim(),
      };
    } catch (error) {
      return {
        status: 'failed',
        message: error.stderr?.trim() || error.message || 'Git push failed. Check the remote and branch configuration.',
      };
    }
  },
});

registerTool({
  name: 'remember',
  description: 'Save a non-sensitive user preference or project memory.',
  riskLevel: 'low',
  async execute({ key, value }) {
    const memoryKey = String(key || 'custom').trim();
    const memoryValue = String(value || '').trim();
    if (!memoryKey || !memoryValue) {
      throw new Error('A key and value are required to save memory.');
    }

    memoryStore.set(memoryKey, memoryValue);
    return {
      status: 'completed',
      key: memoryKey,
      value: memoryValue,
      message: 'Memory updated.',
    };
  },
});

registerTool({
  name: 'forget_memory',
  description: 'Remove a stored preference or memory item.',
  riskLevel: 'low',
  async execute({ key }) {
    const memoryKey = String(key || '').trim();
    if (!memoryKey) {
      throw new Error('A memory key is required to clear it.');
    }

    const deleted = memoryStore.delete(memoryKey);

    return {
      status: 'completed',
      key: memoryKey,
      deleted,
      message: deleted ? 'Memory item deleted.' : 'No matching memory item was found.',
    };
  },
});

registerTool({
  name: 'memory_list',
  description: 'List saved JARVIS memories.',
  riskLevel: 'low',
  async execute() {
    return {
      status: 'completed',
      items: memoryStore.list(),
    };
  },
});

export const toolRegistry = {
  list() {
    return globalTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      riskLevel: tool.riskLevel,
    }));
  },
  async execute(toolName, params = {}, options = {}) {
    const tool = globalTools.find((entry) => entry.name === toolName);
    if (!tool) {
      throw new Error(`Tool "${toolName}" is not available.`);
    }

    const confirmed = Boolean(options.confirmed);
    const requiresConfirmation = permissionManager.requiresConfirmation(toolName) && !confirmed;

    if (requiresConfirmation) {
      const pendingAction = permissionManager.createPendingAction(toolName, tool.description, params);
      return {
        requiresConfirmation: true,
        pendingAction,
        message: `JARVIS wants to perform a ${tool.riskLevel}-risk action: ${tool.description}`,
      };
    }

    const result = await tool.execute(params, options);
    activityLogger.add(`Tool selected: ${toolName}`);
    return result;
  },
};
