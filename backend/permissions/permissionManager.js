const permissionLevels = {
  low: ['system_info', 'open_url', 'search_files', 'read_file', 'list_files', 'memory_read'],
  medium: ['create_file', 'edit_file', 'run_command', 'open_project', 'run_project', 'search_project', 'git_status', 'git_commit', 'git_log', 'create_branch'],
  high: ['delete_file', 'delete_directory', 'git_push', 'system_settings', 'browser_actions', 'publish_content'],
};

const pendingActionMap = new Map();

function levelForTool(toolName) {
  for (const [riskLevel, tools] of Object.entries(permissionLevels)) {
    if (tools.includes(toolName)) return riskLevel;
  }
  return 'medium';
}

export const permissionManager = {
  getLevel(toolName) {
    return levelForTool(toolName);
  },
  requiresConfirmation(toolName) {
    const riskLevel = levelForTool(toolName);
    return riskLevel === 'high';
  },
  createPendingAction(toolName, description, metadata = {}) {
    const id = `pending-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    pendingActionMap.set(id, {
      id,
      toolName,
      description,
      metadata,
      createdAt: new Date().toISOString(),
    });

    return {
      id,
      toolName,
      description,
      metadata,
    };
  },
  getPendingAction(id) {
    return pendingActionMap.get(id) || null;
  },
  confirmAction(id) {
    const action = pendingActionMap.get(id);
    if (!action) {
      return { ok: false, message: 'No pending action found.' };
    }

    pendingActionMap.delete(id);
    return { ok: true, action };
  },
};
