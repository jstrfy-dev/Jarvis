const logs = [];
let socketBroadcast = null;

export const activityLogger = {
  setSocketBroadcast(callback) {
    socketBroadcast = callback;
  },
  add(message, type = 'info') {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      type,
      message,
    };

    logs.unshift(entry);
    if (socketBroadcast) {
      socketBroadcast({ type: 'activity', payload: entry });
    }
    return entry;
  },
  getAll() {
    return logs;
  },
  clear() {
    logs.length = 0;
    if (socketBroadcast) {
      socketBroadcast({ type: 'activity_clear', payload: [] });
    }
  },
};
