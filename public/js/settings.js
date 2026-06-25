/**
 * settings.js — Panneau de configuration.
 *
 * Responsabilités :
 *   - Charger et afficher la configuration depuis l'API
 *   - Sauvegarder les modifications
 *   - Vider les caches côté client
 */

import { toast } from './ui.js';
import { loadSites, siteSubmodules, siteUrls } from './sites.js';

export async function loadSettings() {
  const res = await fetch('/api/config');
  const cfg = await res.json();

  document.getElementById('cfg-sites-root').value   = cfg.sitesRoot ?? '';
  document.getElementById('cfg-theme').value        = cfg.themeModule ?? '';
  document.getElementById('cfg-subtheme').value     = cfg.subthemeModule ?? '';
  document.getElementById('cfg-psi-key').value      = cfg.pagespeedApiKey ?? '';
  document.getElementById('cfg-concurrency').value  = String(cfg.concurrency ?? 4);
}

export async function saveSettings() {
  const body = {
    sitesRoot:      document.getElementById('cfg-sites-root').value.trim(),
    themeModule:    document.getElementById('cfg-theme').value.trim(),
    subthemeModule: document.getElementById('cfg-subtheme').value.trim(),
    pagespeedApiKey:document.getElementById('cfg-psi-key').value.trim(),
    concurrency:    parseInt(document.getElementById('cfg-concurrency').value, 10),
  };

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    toast('Paramètres enregistrés.', 'success');
    // Recharge la liste des sites avec le nouveau chemin
    await loadSites(true);
  } catch (e) {
    toast('Erreur : ' + e.message, 'error');
  }
}

export function clearCaches() {
  // Vide les caches mémoire côté client
  Object.keys(siteSubmodules).forEach((k) => delete siteSubmodules[k]);
  Object.keys(siteUrls).forEach((k) => delete siteUrls[k]);
  toast('Caches vidés — rechargement…', 'info');
  loadSites(true);
}
