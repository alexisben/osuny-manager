import { broadcast, createJob, isJobCancelled, markJobDone } from '../jobs.js';
import { delay } from '../utils.js';

const SCHEMA_API = 'https://validator.schema.org/validate';
const DELAY_MS = 1_200;

/**
 * Valide les données structurées JSON-LD d'une liste d'URLs
 * via validator.schema.org.
 * @returns {string} jobId
 */
export function runSchema(urls) {
  const jobId = createJob('schema');

  (async () => {
    broadcast('job:start', { jobId, total: urls.length });
    let done = 0;

    for (const url of urls) {
      if (isJobCancelled(jobId)) break;
      broadcast('job:out', { jobId, text: `🔖 Schema.org: ${url}\n` });

      try {
        const res = await fetch(SCHEMA_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'OsunyManager/2.0',
          },
          body: `url=${encodeURIComponent(url)}&output=json`,
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        const data = JSON.parse(text.replace(/^\s*\)\]\}'\s*/, ''));
        const errors = data.errors ?? 0;
        const triples = data.tripleCount ?? 0;

        broadcast('job:out', { jobId, text: `  ↳ ${errors} erreur(s), ${triples} triplet(s)\n` });
        broadcast('job:result', {
          jobId,
          result: {
            kind: 'schema',
            url,
            errors,
            warnings: data.warnings ?? 0,
            triples,
          },
        });
      } catch (e) {
        broadcast('job:err', { jobId, text: `  ✗ ${e.message}\n` });
        broadcast('job:result', { jobId, result: { kind: 'schema', url, error: e.message } });
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
