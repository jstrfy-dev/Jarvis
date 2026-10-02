import { toolRegistry } from '../tools/toolRegistry.js';
import { memoryStore } from '../memory/memoryStore.js';
import { permissionManager } from '../permissions/permissionManager.js';
import { activityLogger } from '../services/activityLogger.js';

function parseMemoryKeyAndValue(text) {
  const rememberPattern = /remember(?: that)?\s+(?:my\s+)?(.+?)\s+(?:is|=|:)\s*(.+)$/i;
  const match = text.match(rememberPattern);
  if (match) {
    return {
      key: match[1].trim().replace(/^my\s+/i, ''),
      value: match[2].trim(),
    };
  }
  return null;
}

export async function processCommand(rawText, context = {}) {
  const text = String(rawText || '').trim();
  if (!text) {
    return {
      response: 'I did not receive a command. Please try again.',
      status: 'error',
    };
  }

  const lower = text.toLowerCase();
  activityLogger.add(`Command analyzed: ${text}`);

  if (lower.startsWith('remember') || lower.includes('remember that')) {
    const parsed = parseMemoryKeyAndValue(text);
    if (parsed) {
      return toolRegistry.execute('remember', {
        key: parsed.key,
        value: parsed.value,
      }, context);
    }
  }

  if (lower.startsWith('forget') || lower.includes('forget that')) {
    const key = text.replace(/^(forget|delete|clear)\s+/i, '').trim();
    if (!key) {
      return {
        response: 'I need a memory item to forget. Try: “Forget my website project.”',
        status: 'info',
      };
    }
    return toolRegistry.execute('forget_memory', { key }, context);
  }

  if (lower.includes('memory') && (lower.includes('list') || lower.includes('show'))) {
    return toolRegistry.execute('memory_list', {}, context);
  }

  if (lower.includes('system') || lower.includes('status')) {
    return toolRegistry.execute('system_info', {}, context);
  }

  if (lower.includes('git status') || lower.includes('check git')) {
    return toolRegistry.execute('git_status', { directory: context.directory || process.cwd() }, context);
  }

  if (lower.includes('commit') || lower.includes('git commit')) {
    return toolRegistry.execute('git_commit', { directory: context.directory || process.cwd() }, context);
  }

  if (lower.includes('git push')) {
    return toolRegistry.execute('git_push', { directory: context.directory || process.cwd() }, context);
  }

  if (lower.includes('open my website') || lower.includes('open website') || lower.includes('check my website')) {
    return toolRegistry.execute('open_url', { url: 'https://example.com' }, context);
  }

  if (lower.includes('open project') || lower.includes('open my project') || lower.includes('open vs code') || lower.includes('open vscode')) {
    return toolRegistry.execute('open_project', { projectName: 'workspace', pathHint: context.directory || process.cwd() }, context);
  }

  if (lower.includes('run my project') || lower.includes('run the project') || lower.includes('start my project') || lower.includes('start project')) {
    return toolRegistry.execute('run_project', { directory: context.directory || process.cwd() }, context);
  }

  if (lower.includes('search my project') || lower.includes('find') || lower.includes('search for')) {
    const query = text.replace(/^(jarvis\s*,?\s*)?(search|find|look for)\s+(?:my\s+project\s+for\s+)?/i, '').trim();
    return toolRegistry.execute('search_project', { query, directory: context.directory || process.cwd() }, context);
  }

  if (lower.includes('show me system information') || lower.includes('show system information')) {
    return toolRegistry.execute('system_info', {}, context);
  }

  if (lower.includes('hello') || lower.includes('hi')) {
    return {
      response: 'Hello. JARVIS is online and ready to assist with your projects, voice commands, system checks, and safe automation.',
      status: 'completed',
    };
  }

  return {
    response: 'I can help with system status, project detection, file search, git checks, reminders, and safe project execution. Try “Show system information” or “Run my project.”',
    status: 'info',
  };
}

export async function confirmAction(actionId, confirmed) {
  const action = permissionManager.getPendingAction(actionId);
  if (!action) {
    return {
      status: 'failed',
      response: 'No pending action was found for approval.',
    };
  }

  if (!confirmed) {
    permissionManager.confirmAction(actionId);
    return {
      status: 'cancelled',
      response: 'The action was cancelled by the user.',
    };
  }

  try {
    const result = await toolRegistry.execute(action.toolName, action.metadata, { confirmed: true });
    return {
      ...result,
      response: result.response || result.message || 'Action approved and executed.',
      status: result.status || 'completed',
    };
  } catch (error) {
    return {
      status: 'failed',
      response: error.message || 'Unable to complete the requested action.',
    };
  }
}
