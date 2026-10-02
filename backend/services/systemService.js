import fs from 'node:fs';
import os from 'node:os';

export function getSystemOverview() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();

  let diskUsage = null;
  try {
    const stats = fs.statfsSync(process.cwd());
    if (stats && typeof stats.bsize === 'number' && typeof stats.blocks === 'number' && typeof stats.bavail === 'number') {
      const totalDisk = stats.blocks * stats.bsize;
      const availableDisk = stats.bavail * stats.bsize;
      diskUsage = {
        total: Math.round(totalDisk / (1024 * 1024 * 1024)),
        free: Math.round(availableDisk / (1024 * 1024 * 1024)),
      };
    }
  } catch (error) {
    diskUsage = {
      total: 'N/A',
      free: 'N/A',
    };
  }

  return {
    status: 'ONLINE',
    core: 'ACTIVE',
    voice: 'READY',
    ai: 'CONNECTED',
    tools: 12,
    network: 'CONNECTED',
    pc: 'ONLINE',
    os: `${os.platform()} ${os.release()}`,
    architecture: os.arch(),
    cpu: cpus[0]?.model || 'Unknown CPU',
    cpuCount: cpus.length,
    ram: {
      total: `${Math.round(totalMem / (1024 * 1024 * 1024))} GB`,
      free: `${Math.round(freeMem / (1024 * 1024 * 1024))} GB`,
    },
    disk: diskUsage,
    uptime: `${Math.round(process.uptime() / 60)} minutes`,
    nodeVersion: process.version,
    networkInterfaces: Object.keys(os.networkInterfaces()).map((name) => ({
      name,
      addresses: (os.networkInterfaces()[name] || []).map((iface) => iface.address),
    })),
  };
}
