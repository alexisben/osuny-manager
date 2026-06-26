/**
 * ui.js — Composants d'interface réutilisables.
 *
 * Ce module ne contient que des fonctions pures d'affichage.
 * Il ne fait aucun appel réseau et ne connaît pas la logique métier.
 */

// ── Toasts ─────────────────────────────────────────────────────────────────────

/**
 * Affiche une notification temporaire.
 * @param {string} message
 * @param {'info'|'success'|'error'} type
 * @param {number} duration  ms
 */
export function toast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `om-toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Terminal ───────────────────────────────────────────────────────────────────

/**
 * Ajoute du texte dans un terminal identifié par son id DOM.
 * @param {string} terminalId  id de l'élément <pre class="terminal-output">
 * @param {string} text
 * @param {'t-out'|'t-err'|'t-info'} cssClass
 */
export function termAppend(terminalId, text, cssClass = 't-out') {
  const el = document.getElementById(terminalId);
  if (!el) return;
  const span = document.createElement('span');
  span.className = cssClass;
  span.textContent = text;
  el.appendChild(span);
  el.scrollTop = el.scrollHeight;
}

/** Vide le contenu d'un terminal. */
export function termClear(terminalId) {
  const el = document.getElementById(terminalId);
  if (el) el.innerHTML = '';
}

// ── Badges de statut ──────────────────────────────────────────────────────────

/**
 * Met à jour un badge de statut de job.
 * @param {string} badgeId
 * @param {'idle'|'running'|'done'|'cancelled'} state
 * @param {string} label
 */
export function setBadge(badgeId, state, label) {
  const el = document.getElementById(badgeId);
  if (!el) return;
  el.className = `badge job-badge ${state}`;
  el.textContent = label;
}

// ── Barre de progression ──────────────────────────────────────────────────────

/**
 * Met à jour une barre de progression et son libellé.
 * @param {string} barId    id de l'élément .progress-bar (fill)
 * @param {string} textId   id de l'élément texte "X/N"
 * @param {number} done
 * @param {number} total
 */
export function setProgress(barId, textId, done, total) {
  const bar = document.getElementById(barId);
  const txt = document.getElementById(textId);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = total > 0 ? `${done}/${total}` : '';
}

// ── Tableau de résultats ──────────────────────────────────────────────────────

/** Retourne la classe CSS de score (good/mid/bad). */
export function scoreClass(n) {
  if (n >= 90) return 'good';
  if (n >= 50) return 'mid';
  return 'bad';
}

/** Raccourcit une URL pour l'affichage. */
function shortUrl(url) {
  return (url ?? '?').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * Retourne l'URL du rapport externe pour un résultat donné.
 * @param {object} result
 * @returns {string}
 */
function reportUrl(result) {
  const enc = encodeURIComponent(result.url);
  if (result.kind === 'w3c')
    return `https://validator.w3.org/nu/?doc=${enc}`;
  if (result.kind === 'schema')
    return `https://validator.schema.org/#url=${enc}`;
  if (result.kind === 'pagespeed')
    return `https://pagespeed.web.dev/report?url=${enc}&form_factor=${result.strategy ?? 'mobile'}`;
  return '#';
}

/** Bouton "Voir le rapport" discret, s'ouvre dans un nouvel onglet. */
function reportLink(result) {
  const href = reportUrl(result);
  return `<a href="${href}" target="_blank" rel="noopener"
             class="btn btn-outline-secondary btn-sm report-link"
             title="Ouvrir le rapport ${result.kind} pour cette URL">↗</a>`;
}

/**
 * Ajoute une ligne dans un tableau de résultats.
 * @param {string} tbodyId
 * @param {object} result  — résultat normalisé du serveur
 */
export function appendResult(tbodyId, result) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  const url   = shortUrl(result.url);
  const title = result.url ?? '';

  if (result.error) {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td class="url-cell" title="${title}">${url}</td>
        <td colspan="6" class="text-danger" style="font-size:11px;">${result.error}</td>
        <td>${reportLink(result)}</td>
      </tr>`);
    return;
  }

  if (result.kind === 'w3c') {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td class="url-cell" title="${title}">${url}</td>
        <td class="score ${result.errors === 0 ? 'good' : result.errors < 5 ? 'mid' : 'bad'}">${result.errors}</td>
        <td class="score ${result.warnings === 0 ? 'good' : 'mid'}">${result.warnings}</td>
        <td>${result.errors === 0 ? '✅' : '❌'}</td>
        <td>${reportLink(result)}</td>
      </tr>`);
  }

  if (result.kind === 'schema') {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td class="url-cell" title="${title}">${url}</td>
        <td class="score ${result.errors === 0 ? 'good' : 'bad'}">${result.errors}</td>
        <td class="score good">${result.triples}</td>
        <td>${result.errors === 0 ? '✅' : '❌'}</td>
        <td>${reportLink(result)}</td>
      </tr>`);
  }

  if (result.kind === 'pagespeed') {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td class="url-cell" title="${title}">${url}</td>
        <td class="score ${scoreClass(result.performance)}">${result.performance}</td>
        <td class="score ${scoreClass(result.accessibility)}">${result.accessibility}</td>
        <td class="score ${scoreClass(result.seo)}">${result.seo}</td>
        <td class="score ${scoreClass(result.bestPractices)}">${result.bestPractices}</td>
        <td style="font-family:var(--om-mono);font-size:11px">${result.lcp}</td>
        <td style="font-family:var(--om-mono);font-size:11px">${result.cls}</td>
        <td style="font-family:var(--om-mono);font-size:11px">${result.tbt}</td>
        <td>${reportLink(result)}</td>
      </tr>`);
  }
}

/** Vide un tableau de résultats et cache son conteneur. */
export function clearResults(tbodyId, wrapperId) {
  const tbody = document.getElementById(tbodyId);
  const wrap  = document.getElementById(wrapperId);
  if (tbody) tbody.innerHTML = '';
  if (wrap)  wrap.style.display = 'none';
}

/** Affiche le conteneur de résultats. */
export function showResults(wrapperId) {
  const wrap = document.getElementById(wrapperId);
  if (wrap) wrap.style.display = '';
}
