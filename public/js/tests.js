/**
 * tests.js — Panneaux de tests (W3C, Schema.org, PageSpeed).
 *
 * Responsabilités :
 *   - Construction d'échantillons aléatoires d'URLs
 *   - Déclenchement des tests via l'API
 *   - Écoute des résultats WS et mise à jour de l'interface
 *   - Export CSV côté client
 */

import { toast, termAppend, termClear, setBadge, setProgress, appendResult, clearResults, showResults } from './ui.js';
import { allSites, selectedSites, siteUrls, preloadUrlsBatched } from './sites.js';

// ── State par panel ────────────────────────────────────────────────────────────
// Chaque entrée : { jobId, results[] }
const panelState = {
  w3c:       { jobId: null, results: [] },
  schema:    { jobId: null, results: [] },
  pagespeed: { jobId: null, results: [] },
};

// Correspondances panel → IDs DOM
const PANEL_CONFIG = {
  w3c: {
    urlField:    'urls-w3c',
    sampleSize:  'sample-size-w3c',
    sampleInfo:  'sample-info-w3c',
    term:        'term-w3c',
    badge:       'badge-w3c',
    bar:         'bar-w3c',
    barText:     'progress-text-w3c',
    tbodyId:     'results-tbody-w3c',
    wrapperId:   'results-wrap-w3c',
    cancelBtn:   'btn-cancel-w3c',
    exportBtn:   'btn-export-w3c',
  },
  schema: {
    urlField:    'urls-schema',
    sampleSize:  'sample-size-schema',
    sampleInfo:  'sample-info-schema',
    term:        'term-schema',
    badge:       'badge-schema',
    bar:         'bar-schema',
    barText:     'progress-text-schema',
    tbodyId:     'results-tbody-schema',
    wrapperId:   'results-wrap-schema',
    cancelBtn:   'btn-cancel-schema',
    exportBtn:   'btn-export-schema',
  },
  pagespeed: {
    urlField:    'urls-pagespeed',
    sampleSize:  'sample-size-pagespeed',
    sampleInfo:  'sample-info-pagespeed',
    term:        'term-pagespeed',
    badge:       'badge-pagespeed',
    bar:         'bar-pagespeed',
    barText:     'progress-text-pagespeed',
    tbodyId:     'results-tbody-pagespeed',
    wrapperId:   'results-wrap-pagespeed',
    cancelBtn:   'btn-cancel-pagespeed',
    exportBtn:   'btn-export-pagespeed',
  },
};

// ── Initialisation ─────────────────────────────────────────────────────────────

export function initTestPanels() {
  window.addEventListener('ws:job:start',    (e) => onJobStart(e.detail));
  window.addEventListener('ws:job:progress', (e) => onJobProgress(e.detail));
  window.addEventListener('ws:job:out',      (e) => onJobOut(e.detail));
  window.addEventListener('ws:job:err',      (e) => onJobErr(e.detail));
  window.addEventListener('ws:job:result',   (e) => onJobResult(e.detail));
  window.addEventListener('ws:job:done',     (e) => onJobDone(e.detail));
}

// ── Résolution panel → panelKey ───────────────────────────────────────────────

const JOB_PREFIX_TO_PANEL = { 'w3c-': 'w3c', 'schema-': 'schema', 'psi-': 'pagespeed' };

function panelForJob(jobId) {
  const key = Object.keys(JOB_PREFIX_TO_PANEL).find((k) => jobId?.startsWith(k));
  return key ? JOB_PREFIX_TO_PANEL[key] : null;
}

function isMyJob(panelKey, jobId) {
  return panelState[panelKey]?.jobId === jobId;
}

// ── Échantillon automatique ────────────────────────────────────────────────────

export async function buildSample(panelKey) {
  const cfg = PANEL_CONFIG[panelKey];
  const n = parseInt(document.getElementById(cfg.sampleSize).value, 10);
  const infoEl = document.getElementById(cfg.sampleInfo);

  if (infoEl) infoEl.textContent = 'Chargement…';

  const sourceNames = selectedSites.size ? [...selectedSites] : allSites.map((s) => s.name);

  // Charger les URLs manquantes
  await preloadUrlsBatched(sourceNames);

  const available = sourceNames.filter((name) => siteUrls[name]);
  const shuffled  = [...available].sort(() => Math.random() - 0.5).slice(0, n);
  const urls      = shuffled.map((name) => siteUrls[name]).filter(Boolean);

  document.getElementById(cfg.urlField).value = urls.join('\n');

  if (infoEl) {
    infoEl.textContent = `${urls.length} URL(s) · sur ${available.length} dispo. (${sourceNames.length} sélect.)`;
  }

  return urls;
}

// ── Lancement des tests ────────────────────────────────────────────────────────

function getUrlsFromField(fieldId) {
  return document.getElementById(fieldId).value
    .split('\n')
    .map((u) => u.trim())
    .filter((u) => u.startsWith('http'));
}

async function launchTest(panelKey, endpoint, body) {
  const cfg = PANEL_CONFIG[panelKey];
  const urls = getUrlsFromField(cfg.urlField);
  if (!urls.length) { toast('Ajoutez au moins une URL.', 'error'); return; }

  termClear(cfg.term);
  clearResults(cfg.tbodyId, cfg.wrapperId);
  panelState[panelKey].results = [];
  termAppend(cfg.term, `▶ ${endpoint.split('/').pop()} sur ${urls.length} URL(s)…\n`, 't-info');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, ...body }),
  });
  const { jobId } = await res.json();
  panelState[panelKey].jobId = jobId;

  // Montre le bouton annuler
  document.getElementById(cfg.cancelBtn).style.display = '';
}

export function runW3C()       { launchTest('w3c',       '/api/test/w3c',       {}); }
export function runSchema()    { launchTest('schema',    '/api/test/schema',    {}); }
export function runPagespeed() {
  const strategy = document.getElementById('ps-strategy').value;
  launchTest('pagespeed', '/api/test/pagespeed', { strategy });
}

// ── Annulation ─────────────────────────────────────────────────────────────────

export async function cancelTest(panelKey) {
  const jobId = panelState[panelKey]?.jobId;
  if (!jobId) return;
  await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
  toast('Annulation demandée…', 'info');
}

// ── Vider un panel ─────────────────────────────────────────────────────────────

export function clearPanel(panelKey) {
  const cfg = PANEL_CONFIG[panelKey];
  termClear(cfg.term);
  clearResults(cfg.tbodyId, cfg.wrapperId);
  panelState[panelKey].results = [];
  document.getElementById(cfg.exportBtn).style.display = 'none';
}

// ── Export CSV ─────────────────────────────────────────────────────────────────

export function exportCSV(panelKey) {
  const results = panelState[panelKey]?.results ?? [];
  if (!results.length) { toast('Aucun résultat à exporter.', 'error'); return; }

  let header, rows;

  if (panelKey === 'w3c') {
    header = 'URL,Erreurs,Avertissements';
    rows = results.map((r) =>
      r.error ? `"${r.url}",ERROR,"${r.error}"`
              : `"${r.url}",${r.errors},${r.warnings}`
    );
  } else if (panelKey === 'schema') {
    header = 'URL,Erreurs,Avertissements,Triplets';
    rows = results.map((r) =>
      r.error ? `"${r.url}",ERROR,"${r.error}",-`
              : `"${r.url}",${r.errors},${r.warnings},${r.triples}`
    );
  } else {
    header = 'URL,Performance,Accessibilité,SEO,Bonnes pratiques,LCP,CLS,TBT';
    rows = results.map((r) =>
      r.error ? `"${r.url}",ERROR,"${r.error}",-,-,-,-,-`
              : `"${r.url}",${r.performance},${r.accessibility},${r.seo},${r.bestPractices},"${r.lcp}","${r.cls}","${r.tbt}"`
    );
  }

  const csv  = '\uFEFF' + [header, ...rows].join('\n'); // BOM UTF-8 pour Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href     = URL.createObjectURL(blob);
  link.download = `osuny-${panelKey}-${Date.now()}.csv`;
  link.click();
}

// ── Événements WebSocket ───────────────────────────────────────────────────────

function onJobStart({ jobId, total }) {
  const panel = panelForJob(jobId);
  if (!panel) return;
  const cfg = PANEL_CONFIG[panel];
  setBadge(cfg.badge, 'running', 'En cours…');
  setProgress(cfg.bar, cfg.barText, 0, total);
}

function onJobProgress({ jobId, done, total }) {
  const panel = panelForJob(jobId);
  if (!panel || !isMyJob(panel, jobId)) return;
  setProgress(PANEL_CONFIG[panel].bar, PANEL_CONFIG[panel].barText, done, total);
}

function onJobOut({ jobId, text }) {
  const panel = panelForJob(jobId);
  if (!panel || !isMyJob(panel, jobId)) return;
  termAppend(PANEL_CONFIG[panel].term, text, 't-out');
}

function onJobErr({ jobId, text }) {
  const panel = panelForJob(jobId);
  if (!panel || !isMyJob(panel, jobId)) return;
  termAppend(PANEL_CONFIG[panel].term, text, 't-err');
}

function onJobResult({ jobId, result }) {
  const panel = panelForJob(jobId);
  if (!panel || !isMyJob(panel, jobId)) return;
  const cfg = PANEL_CONFIG[panel];

  panelState[panel].results.push(result);
  showResults(cfg.wrapperId);
  appendResult(cfg.tbodyId, result);
  document.getElementById(cfg.exportBtn).style.display = '';
}

function onJobDone({ jobId, cancelled, total }) {
  const panel = panelForJob(jobId);
  if (!panel || !isMyJob(panel, jobId)) return;
  const cfg = PANEL_CONFIG[panel];

  const label = cancelled ? 'Annulé' : `Terminé${total ? ` (${total})` : ''}`;
  setBadge(cfg.badge, cancelled ? 'cancelled' : 'done', label);
  document.getElementById(cfg.cancelBtn).style.display = 'none';
  if (!cancelled) setProgress(cfg.bar, cfg.barText, total, total);
}
