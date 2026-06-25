import { broadcast, createJob, isJobCancelled, markJobDone } from '../jobs.js';
import { delay } from '../utils.js';

const PSI_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const DELAY_MS = 2_500; // Lighthouse analyses are heavy

/**
 * Extrait et arrondit le score d'une catégorie Lighthouse (0-100).
 */
function score(categories, key) {
  return Math.round((categories[key]?.score ?? 0) * 100);
}

/**
 * Lance des analyses PageSpeed Insights sur une liste d'URLs.
 * @param {string[]} urls
 * @param {'mobile'|'desktop'} strategy
 * @param {string} apiKey  — clé API Google optionnelle
 * @returns {string} jobId
 */
export function runPagespeed(urls, strategy = 'mobile', apiKey = '') {
  const jobId = createJob('psi');

  (async () => {
    broadcast('job:start', { jobId, total: urls.length });
    let done = 0;

    for (const url of urls) {
      if (isJobCancelled(jobId)) break;
      broadcast('job:out', { jobId, text: `⚡ PageSpeed [${strategy}]: ${url}\n` });

      try {
        const params = new URLSearchParams({ url, strategy });
        for (const cat of ['performance', 'accessibility', 'best-practices', 'seo']) {
          params.append('category', cat);
        }
        if (apiKey) params.set('key', apiKey);
        const res = await fetch(`${PSI_API}?${params}`, {
          signal: AbortSignal.timeout(30_000),
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error.message);

        const cats = data.lighthouseResult?.categories ?? {};
        const audits = data.lighthouseResult?.audits ?? {};

        const result = {
          kind: 'pagespeed',
          url,
          strategy,
          performance:    score(cats, 'performance'),
          accessibility:  score(cats, 'accessibility'),
          seo:            score(cats, 'seo'),
          bestPractices:  score(cats, 'best-practices'),
          lcp: audits['largest-contentful-paint']?.displayValue ?? '-',
          cls: audits['cumulative-layout-shift']?.displayValue ?? '-',
          tbt: audits['total-blocking-time']?.displayValue ?? '-',
          fcp: audits['first-contentful-paint']?.displayValue ?? '-',
        };

        broadcast('job:out', {
          jobId,
          text: `  ↳ Perf ${result.performance} · A11y ${result.accessibility} · SEO ${result.seo}\n`,
        });
        broadcast('job:result', { jobId, result });
      } catch (e) {
        broadcast('job:err', { jobId, text: `  ✗ ${e.message}\n` });
        broadcast('job:result', { jobId, result: { kind: 'pagespeed', url, error: e.message } });
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
