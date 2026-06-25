import { broadcast, createJob, isJobCancelled, markJobDone } from '../jobs.js';
import { delay } from '../utils.js';

const W3C_API = 'https://validator.w3.org/nu/';
const DELAY_MS = 1_200; // be kind to the public W3C API

/**
 * Valide une liste d'URLs via validator.w3.org/nu.
 * Diffuse les résultats au fil de l'eau via WebSocket.
 * @returns {string} jobId
 */
export function runW3C(urls) {
  const jobId = createJob('w3c');

  (async () => {
    broadcast('job:start', { jobId, total: urls.length });
    let done = 0;

    for (const url of urls) {
      if (isJobCancelled(jobId)) break;
      broadcast('job:out', { jobId, text: `🔍 W3C: ${url}\n` });

      try {
        const apiUrl = `${W3C_API}?doc=${encodeURIComponent(url)}&out=json`;
        const res = await fetch(apiUrl, {
          headers: { 'User-Agent': 'OsunyManager/2.0' },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const errors = data.messages?.filter((m) => m.type === 'error') ?? [];
        const warnings = data.messages?.filter((m) => m.type !== 'error') ?? [];

        broadcast('job:out', { jobId, text: `  ↳ ${errors.length} erreur(s), ${warnings.length} avert.\n` });
        broadcast('job:result', {
          jobId,
          result: {
            kind: 'w3c',
            url,
            errors: errors.length,
            warnings: warnings.length,
            details: errors.slice(0, 5).map((m) => ({ msg: m.message, line: m.lastLine })),
          },
        });
      } catch (e) {
        broadcast('job:err', { jobId, text: `  ✗ ${e.message}\n` });
        broadcast('job:result', { jobId, result: { kind: 'w3c', url, error: e.message } });
      }

      done++;
      broadcast('job:progress', { jobId, done, total: urls.length });
      if (done < urls.length) await delay(DELAY_MS);
    }

    markJobDone(jobId);
    broadcast('job:done', { jobId, code: 0, final: true, total: done });
  })();

  return jobId;
}
