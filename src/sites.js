import fs from 'fs/promises';
import path from 'path';
import { pLimit } from './utils.js';

// ── Discovery cache ────────────────────────────────────────────────────────────
let sitesCache = null;
let sitesCacheTime = 0;
const SITES_TTL = 30_000;

/**
 * Découvre tous les dossiers qui ressemblent à un site Osuny.
 * Un site Osuny possède .gitmodules et/ou config.yaml.
 */
export async function discoverSites(sitesRoot, force = false) {
  if (!force && sitesCache && Date.now() - sitesCacheTime < SITES_TTL) {
    return sitesCache;
  }

  const sites = [];
  const limit = pLimit(20);

  try {
    const entries = await fs.readdir(sitesRoot, { withFileTypes: true });
    const results = await Promise.all(
      entries.map((entry) =>
        limit(async () => {
          if (!entry.isDirectory()) return null;
          const sitePath = path.join(sitesRoot, entry.name);
          const [hasGitmodules, hasConfig] = await Promise.all([
            fs.access(path.join(sitePath, '.gitmodules')).then(() => true).catch(() => false),
            fs.access(path.join(sitePath, 'config.yaml')).then(() => true).catch(() => false),
          ]);
          if (hasGitmodules || hasConfig) return { name: entry.name, path: sitePath };
          return null;
        })
      )
    );
    sites.push(...results.filter(Boolean));
  } catch (e) {
    console.error('Error discovering sites:', e.message);
  }

  sitesCache = sites.sort((a, b) => a.name.localeCompare(b.name));
  sitesCacheTime = Date.now();
  return sitesCache;
}

export function invalidateSitesCache() {
  sitesCache = null;
}

// ── URL extraction ─────────────────────────────────────────────────────────────
const urlCache = new Map();

const CONFIG_FILES = [
  'config/production/config.yaml',
];

const URL_PATTERNS = [
  /^baseURL:\s*["']?([^"'\n]+)["']?/m
];

export async function getSiteUrl(sitePath, siteName) {
  if (urlCache.has(siteName)) return urlCache.get(siteName);

  for (const file of CONFIG_FILES) {
    try {
      const content = await fs.readFile(path.join(sitePath, file), 'utf-8');
      for (const pattern of URL_PATTERNS) {
        const match = content.match(pattern);
        if (match) {
          const url = match[1].trim().replace(/\/$/, '');
          urlCache.set(siteName, url);
          return url;
        }
      }
    } catch {
      // file doesn't exist, try next
    }
  }

  urlCache.set(siteName, null);
  return null;
}

export function clearUrlCache() {
  urlCache.clear();
}
