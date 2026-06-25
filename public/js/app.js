/**
 * app.js — Point d'entrée de l'application.
 *
 * Ce fichier :
 *   1. Initialise les modules (WS, panneaux)
 *   2. Gère la navigation entre panneaux
 *   3. Expose les fonctions appelées depuis le HTML via window.*
 *      (alternative légère à un framework — les handlers onclick restent lisibles)
 */

import { initWebSocket }         from './ws.js';
import { loadSites, filterSites, selectAll, selectNone, selectModified, toggleAll, toggleSite, setOpenSubmodulesCallback } from './sites.js';
import { initSubmodulesPanel, updateSubmodCount, runSubmoduleUpdate, runSubmoduleInit, cancelSubmoduleJob } from './submodules.js';
import { initTestPanels, buildSample, runW3C, runSchema, runPagespeed, cancelTest, clearPanel, exportCSV } from './tests.js';
import { loadSettings, saveSettings, clearCaches } from './settings.js';
import { termClear } from './ui.js';

// ── Navigation ─────────────────────────────────────────────────────────────────

export function showPanel(name) {
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach((n) => n.classList.remove('active'));

  document.getElementById('panel-' + name)?.classList.add('active');
  document.querySelector(`.nav-link[data-panel="${name}"]`)?.classList.add('active');

  if (name === 'submodules') updateSubmodCount();
}

// ── Initialisation ─────────────────────────────────────────────────────────────

function init() {
  initWebSocket();
  initSubmodulesPanel();
  initTestPanels();

  // Câble le callback "ouvrir submodules pour un site"
  setOpenSubmodulesCallback((siteName) => {
    // Sélectionne uniquement ce site puis ouvre le panneau
    const { selectedSites } = window.__sitesModule;
    selectedSites.clear();
    selectedSites.add(siteName);
    showPanel('submodules');
  });

  // Charge les paramètres puis les sites
  loadSettings().then(() => loadSites());
}

// ── Exposition globale ─────────────────────────────────────────────────────────
// Les fonctions appelées via onclick="..." dans le HTML doivent être
// accessibles globalement. On les regroupe ici plutôt que de polluer
// le scope global un par un.

// Navigation
window.showPanel = showPanel;

// Sites
window.__sitesModule = { toggleSite,
  openSubmodules: (name) => {
    const { selectedSites } = window.__sitesModule;
    selectedSites.clear();
    selectedSites.add(name);
    showPanel('submodules');
  },
  openCode: (name) => {
    console.log(name)
  }
};
// Note : selectedSites est l'objet partagé importé par sites.js — on expose
// un pointeur vers lui pour que __sitesModule.selectedSites soit réactif.
import { selectedSites } from './sites.js';
window.__sitesModule.selectedSites = selectedSites;

window.filterSites    = filterSites;
window.selectAll      = selectAll;
window.selectNone     = selectNone;
window.selectModified = selectModified;
window.toggleAll      = toggleAll;
window.loadSites      = loadSites;

// Submodules
window.runSubmoduleUpdate  = runSubmoduleUpdate;
window.runSubmoduleInit    = runSubmoduleInit;
window.cancelSubmoduleJob  = cancelSubmoduleJob;
window.clearTermSubmod     = () => termClear('term-submod');

// Tests
window.buildSample    = buildSample;
window.runW3C         = runW3C;
window.runSchema      = runSchema;
window.runPagespeed   = runPagespeed;
window.cancelTest     = cancelTest;
window.clearPanel     = clearPanel;
window.exportCSV      = exportCSV;

// Quick actions depuis le panneau Sites
window.quickAction = async (target) => {
  await buildSample(target);
  showPanel(target);
};

// Settings
window.saveSettings = saveSettings;
window.clearCaches  = clearCaches;

// ── Start ──────────────────────────────────────────────────────────────────────
init();
