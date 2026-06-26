/**
 * sites.js — Gestion de la liste des sites.
 *
 * Responsabilités :
 *   - Chargement et affichage de la liste
 *   - Filtrage (texte + statut submodule)
 *   - Sélection (toggle, tout, aucun, modifiés)
 *   - Chargement des statuts submodules en batch
 *   - Préchargement des URLs en arrière-plan
 */

import { toast } from './ui.js';

// ── État ───────────────────────────────────────────────────────────────────────
export let allSites = [];       // tous les sites découverts
export let filteredSites = [];  // sous-ensemble après filtres
export let selectedSites = new Set();
export let siteSubmodules = {}; // name → modules[]
export let siteUrls = {};       // name → url | null

// ── Chargement ─────────────────────────────────────────────────────────────────

export async function loadSites(force = false) {
  const container = document.getElementById('sites-container');
  container.innerHTML = '<div class="empty-state"><span class="spinner-border spinner-border-sm text-secondary" role="status" aria-hidden="true"></span><br>Découverte des sites…</div>';

  try {
    const res = await fetch('/api/sites' + (force ? '?refresh=1' : ''));
    const { sites, total, root } = await res.json();
    allSites = sites;
    filteredSites = [...sites];

    document.getElementById('stat-total').textContent = total;
    document.getElementById('sites-path').textContent = root;

    renderSites(filteredSites);

    // Chargements parallèles en arrière-plan
    loadSubmodulesBatched(sites.map((s) => s.name));
    preloadUrlsBatched(sites.map((s) => s.name));
  } catch (e) {
    container.innerHTML = `<div class="empty-state text-danger">
      ❌ Erreur : ${e.message}<br><small>Vérifiez le chemin dans Paramètres.</small>
    </div>`;
  }
}

async function loadSubmodulesBatched(names) {
  const BATCH = 50;
  for (let i = 0; i < names.length; i += BATCH) {
    const batch = names.slice(i, i + BATCH);
    try {
      const res = await fetch('/api/sites/submodules-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: batch }),
      });
      const { results } = await res.json();
      results.forEach(({ name, modules }) => {
        siteSubmodules[name] = modules;
        updateStatusCell(name, modules);
      });
      updateModifiedCount();
    } catch { /* silently ignore batch errors */ }
  }
}

export async function preloadUrlsBatched(names) {
  const missing = names.filter((n) => !(n in siteUrls));
  if (!missing.length) return;

  const BATCH = 100;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    try {
      const res = await fetch('/api/sites/urls-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: batch }),
      });
      const { results } = await res.json();
      results.forEach(({ name, url }) => { siteUrls[name] = url; });
    } catch { /* silently ignore */ }
  }
}

export async function refreshSubmoduleStatuses() {
  const names = filteredSites.map((s) => s.name);
  if (!names.length) return;
  try {
    const res = await fetch('/api/sites/submodules-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    });
    const { results } = await res.json();
    results.forEach(({ name, modules }) => {
      siteSubmodules[name] = modules;
      updateStatusCell(name, modules);
    });
    updateModifiedCount();
    toast('Statuts submodules rafraîchis', 'success');
  } catch (e) {
    toast('Erreur lors du rafraîchissement : ' + e.message, 'error');
  }
}

// ── Rendu ──────────────────────────────────────────────────────────────────────

export function renderSites(sites) {
  const container = document.getElementById('sites-container');

  if (!sites.length) {
    container.innerHTML = '<div class="empty-state">Aucun site pour ce filtre.</div>';
    updateSelectionUI();
    return;
  }

  container.innerHTML = sites.map((s) => siteRowHtml(s)).join('');
  updateSelectionUI();
}

function siteRowHtml(s) {
  const mods = siteSubmodules[s.name];
  const statusHtml = renderStatusTags(mods);
  const urlHtml = siteUrls[s.name]
    ? `<div class="site-url">${siteUrls[s.name].replace(/^https?:\/\//, '')}</div>`
    : '';
  const isSelected = selectedSites.has(s.name);

  return `
    <div class="site-row${isSelected ? ' selected' : ''}"
         id="row-${CSS.escape(s.name)}"
         onclick="window.__sitesModule.toggleSite('${s.name}', event)">
      <input class="form-check-input site-check" type="checkbox" ${isSelected ? 'checked' : ''}
             id="chk-${CSS.escape(s.name)}"
             onclick="window.__sitesModule.toggleSite('${s.name}', event)">
      <div>
        <div class="site-name">${s.name}</div>
        ${urlHtml}
      </div>
      <div class="site-status" id="status-${CSS.escape(s.name)}">${statusHtml}</div>
      <div class="d-flex gap-1 justify-content-end">
        <button class="btn btn-outline-secondary btn-sm"
                title="Gérer les submodules de ce site"
                onclick="window.__sitesModule.openSubmodules('${s.name}'); event.stopPropagation()">🔗</button>
      </div>
    </div>`;
}

function renderStatusTags(mods) {
  if (mods == null) return '<span class="submod-tag loading">…</span>';
  if (!mods.length) return '<span class="submod-tag" style="opacity:.4">—</span>';
  return mods.map((m) => {
    const short = m.name.split('/').pop();
    return `<span class="submod-tag ${m.status}" title="${m.name} @ ${m.hash}${m.tag ? ' (' + m.tag + ')' : ''}">${short}</span>`;
  }).join(' ');
}

function updateStatusCell(name, modules) {
  const el = document.getElementById('status-' + CSS.escape(name));
  if (el) el.innerHTML = renderStatusTags(modules);
}

function updateModifiedCount() {
  const count = Object.values(siteSubmodules).filter(
    (mods) => mods.some((m) => m.status !== 'ok')
  ).length;
  const el = document.getElementById('stat-modified');
  const cnt = document.getElementById('stat-mod-count');
  if (el) el.style.display = count ? '' : 'none';
  if (cnt) cnt.textContent = count;
}

// ── Filtres ────────────────────────────────────────────────────────────────────

export function filterSites() {
  const q = document.getElementById('site-search').value.toLowerCase();
  const status = document.getElementById('filter-status').value;

  filteredSites = allSites.filter((s) => {
    if (q && !s.name.toLowerCase().includes(q)) return false;
    if (status) {
      const mods = siteSubmodules[s.name];
      if (status === 'nomodules') return mods != null && mods.length === 0;
      if (!mods) return false;
      if (status === 'ok') return mods.length > 0 && mods.every((m) => m.status === 'ok');
      return mods.some((m) => m.status === status);
    }
    return true;
  });

  renderSites(filteredSites);
}

// ── Sélection ──────────────────────────────────────────────────────────────────

export function toggleSite(name, event) {
  if (event?.target.tagName === 'BUTTON') return;
  selectedSites.has(name) ? selectedSites.delete(name) : selectedSites.add(name);
  const row = document.getElementById('row-' + CSS.escape(name));
  const chk = document.getElementById('chk-' + CSS.escape(name));
  row?.classList.toggle('selected', selectedSites.has(name));
  if (chk) chk.checked = selectedSites.has(name);
  updateSelectionUI();
}

export function selectAll()  { filteredSites.forEach((s) => selectedSites.add(s.name));    renderSites(filteredSites); }
export function selectNone() { filteredSites.forEach((s) => selectedSites.delete(s.name)); renderSites(filteredSites); }

export function selectModified() {
  selectedSites.clear();
  Object.entries(siteSubmodules).forEach(([name, mods]) => {
    if (mods.some((m) => m.status !== 'ok')) selectedSites.add(name);
  });
  renderSites(filteredSites);
  toast(`${selectedSites.size} site(s) avec submodules modifiés sélectionnés`, 'info');
}

function updateSelectionUI() {
  document.getElementById('stat-selected').textContent = selectedSites.size;
  const chkAll = document.getElementById('chk-all');
  if (chkAll) {
    chkAll.checked = filteredSites.length > 0 && filteredSites.every((s) => selectedSites.has(s.name));
    chkAll.indeterminate = !chkAll.checked && filteredSites.some((s) => selectedSites.has(s.name));
  }
}

export function toggleAll(checked) {
  filteredSites.forEach((s) => checked ? selectedSites.add(s.name) : selectedSites.delete(s.name));
  renderSites(filteredSites);
}

// Callback externe : ouvre le panneau submodules pour un site donné
export let openSubmodules = () => {};
export function setOpenSubmodulesCallback(fn) { openSubmodules = fn; }

