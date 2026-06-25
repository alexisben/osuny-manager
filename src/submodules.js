import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { pLimit } from './utils.js';
import { broadcast, createJob, isJobCancelled, markJobDone, runWithStream } from './jobs.js';

const execAsync = promisify(exec);

// ── Status cache ───────────────────────────────────────────────────────────────
const statusCache = new Map(); // siteName → { modules, ts }
const STATUS_TTL = 60_000;

const STATUS_CHARS = { ' ': 'ok', '+': 'modified', '-': 'uninitialized', 'U': 'conflict' };

/**
 * Lit le statut des submodules d'un site via `git submodule status`.
 */
export async function getSubmoduleStatus(sitePath, siteName, force = false) {
  const cached = statusCache.get(siteName);
  if (!force && cached && Date.now() - cached.ts < STATUS_TTL) return cached.modules;

  try {
    const { stdout } = await execAsync('git submodule status', { cwd: sitePath, timeout: 8_000 });
    const modules = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const statusChar = line[0];
        const parts = line.split(' ').filter(Boolean);
        return {
          hash: parts[0],
          name: parts[1],
          status: STATUS_CHARS[statusChar] ? STATUS_CHARS[statusChar] : 'unknown',
          tag: parts[2],
        };
      })
      .filter(Boolean);
    statusCache.set(siteName, { modules, ts: Date.now() });
    return modules;
  } catch {
    return [];
  }
}

export function invalidateStatusCache(siteName) {
  statusCache.delete(siteName);
}

export function invalidateAllStatusCaches() {
  statusCache.clear();
}

// ── Git operations ─────────────────────────────────────────────────────────────

/**
 * Met à jour les submodules d'une liste de sites en parallèle.
 * @param {string[]} siteNames
 * @param {string} sitesRoot
 * @param {string[]} modules  — sous-ensemble de modules, vide = tous
 * @param {number} concurrency
 * @returns {string} jobId
 */
export function updateSubmodules(siteNames, sitesRoot, modules = [], concurrency = 4) {
  const jobId = createJob('submod');
  const checkoutMain      = `git checkout main`;
  const pullMain          = `git pull origin main`;
  const submodulesOnMain  = `git submodule foreach --recursive 'git checkout main && git pull origin main'`;

  // Run async, caller gets jobId immediately
  (async () => {
    broadcast('job:start', { jobId, total: siteNames.length });
    const limit = pLimit(concurrency);
    let done = 0;

    await Promise.all(
      siteNames.map((siteName) =>
        limit(async () => {
          if (isJobCancelled(jobId)) return;
          const sitePath = path.join(sitesRoot, siteName);
          await runWithStream(jobId, checkoutMain, sitePath, siteName);
          await runWithStream(jobId, pullMain, sitePath, siteName);
          await runWithStream(jobId, submodulesOnMain, sitePath, siteName);
          invalidateStatusCache(siteName);
          done++;
          broadcast('job:progress', { jobId, done, total: siteNames.length });
        })
      )
    );

    markJobDone(jobId);
    broadcast('job:done', {
      jobId,
      code: isJobCancelled(jobId) ? 130 : 0,
      final: true,
      cancelled: isJobCancelled(jobId),
    });
  })();

  return jobId;
}

/**
 * Initialise les submodules (`--init --recursive`) sur une liste de sites.
 * @returns {string} jobId
 */
export function initSubmodules(siteNames, sitesRoot, concurrency = 4) {
  const jobId = createJob('init');

  (async () => {
    broadcast('job:start', { jobId, total: siteNames.length });
    const limit = pLimit(concurrency);
    let done = 0;

    await Promise.all(
      siteNames.map((siteName) =>
        limit(async () => {
          if (isJobCancelled(jobId)) return;
          const sitePath = path.join(sitesRoot, siteName);
          await runWithStream(jobId, 'git submodule update --init --recursive', sitePath, siteName);
          invalidateStatusCache(siteName);
          done++;
          broadcast('job:progress', { jobId, done, total: siteNames.length });
        })
      )
    );

    markJobDone(jobId);
    broadcast('job:done', { jobId, code: isJobCancelled(jobId) ? 130 : 0, final: true });
  })();

  return jobId;
}
