/**
 * submodules.js — Panneau de mise à jour des submodules.
 *
 * Responsabilités :
 *   - Construire la liste des sites cibles selon le périmètre choisi
 *   - Déclencher update / init via l'API
 *   - Gérer le bouton d'annulation
 *   - Écouter les événements WebSocket relatifs aux jobs submodules
 */

import { toast, termAppend, termClear, setBadge, setProgress } from './ui.js';
import { allSites, selectedSites, siteSubmodules, refreshSubmoduleStatuses } from './sites.js';

// jobId du job en cours sur ce panneau
let currentJobId = null;

// ── Initialisation ─────────────────────────────────────────────────────────────

export function initSubmodulesPanel() {
  // Écoute les événements WS redistribués par ws.js
  window.addEventListener('ws:job:start',    (e) => onJobStart(e.detail));
  window.addEventListener('ws:job:progress', (e) => onJobProgress(e.detail));
  window.addEventListener('ws:job:out',      (e) => onJobOut(e.detail));
  window.addEventListener('ws:job:err',      (e) => onJobErr(e.detail));
  window.addEventListener('ws:job:done',     (e) => onJobDone(e.detail));
}

// ── Ciblage des sites ──────────────────────────────────────────────────────────

export function updateSubmodCount() {
  const el = document.getElementById('submod-count');
  if (!el) return;
  const n = selectedSites.size;
  el.textContent = n
    ? `${n} site(s) sélectionné(s)`
    : `Tous les sites (${allSites.length})`;
}

function getScopedSites() {
  const scope = document.getElementById('submod-scope').value;
  if (scope === 'all')      return allSites.map((s) => s.name);
  if (scope === 'modified') return Object.entries(siteSubmodules)
    .filter(([, mods]) => mods.some((m) => m.status !== 'ok'))
    .map(([name]) => name);
  return [...selectedSites]; // 'selected' (default)
}

// ── Actions ────────────────────────────────────────────────────────────────────

export async function runSubmoduleUpdate() {
  const sites = getScopedSites();
  if (!sites.length) { toast('Aucun site sélectionné.', 'error'); return; }

  const modules     = document.getElementById('submod-target').value;
  const concurrency = parseInt(document.getElementById('submod-concurrency').value, 10);

  termClear('term-submod');
  termAppend('term-submod', `▶ Mise à jour de ${sites.length} site(s)…\n`, 't-info');

  const res = await fetch('/api/submodules/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sites, modules: modules ? [modules] : [], concurrency }),
  });
  const { jobId } = await res.json();
  currentJobId = jobId;
}

export async function runSubmoduleInit() {
  const sites = getScopedSites();
  if (!sites.length) { toast('Aucun site sélectionné.', 'error'); return; }

  const concurrency = parseInt(document.getElementById('submod-concurrency').value, 10);

  termClear('term-submod');
  termAppend('term-submod', `▶ Init submodules sur ${sites.length} site(s)…\n`, 't-info');

  const res = await fetch('/api/submodules/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sites, concurrency }),
  });
  const { jobId } = await res.json();
  currentJobId = jobId;
}

export async function cancelSubmoduleJob() {
  if (!currentJobId) return;
  await fetch(`/api/jobs/${currentJobId}/cancel`, { method: 'POST' });
  toast('Annulation demandée…', 'info');
}

// ── Événements WebSocket ───────────────────────────────────────────────────────

function isMyJob(jobId) {
  return jobId === currentJobId
    || jobId?.startsWith('submod-')
    || jobId?.startsWith('init-');
}

function onJobStart({ jobId, total }) {
  if (!isMyJob(jobId)) return;
  setBadge('badge-submod', 'running', 'En cours…');
  document.getElementById('btn-cancel-submod').style.display = '';
  setProgress('bar-submod', 'progress-text-submod', 0, total);
}

function onJobProgress({ jobId, done, total }) {
  if (!isMyJob(jobId)) return;
  setProgress('bar-submod', 'progress-text-submod', done, total);
}

function onJobOut({ jobId, text }) {
  if (!isMyJob(jobId)) return;
  termAppend('term-submod', text, 't-out');
}

function onJobErr({ jobId, text }) {
  if (!isMyJob(jobId)) return;
  termAppend('term-submod', text, 't-err');
}

function onJobDone({ jobId, cancelled, total }) {
  if (!isMyJob(jobId)) return;
  const label = cancelled ? 'Annulé' : `Terminé${total ? ` (${total})` : ''}`;
  setBadge('badge-submod', cancelled ? 'cancelled' : 'done', label);
  document.getElementById('btn-cancel-submod').style.display = 'none';
  if (!cancelled) setProgress('bar-submod', 'progress-text-submod', total, total);
  // Rafraîchit les statuts dans la liste des sites
  setTimeout(refreshSubmoduleStatuses, 500);
}
