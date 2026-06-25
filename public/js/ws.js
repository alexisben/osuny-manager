/**
 * ws.js — Connexion WebSocket et dispatch d'événements vers les autres modules.
 *
 * Les messages du serveur sont redistribués comme événements DOM custom
 * sur `window`, ce qui permet à chaque module de s'abonner indépendamment
 * sans couplage direct.
 *
 * Événements émis :
 *   ws:job:start    { jobId, total }
 *   ws:job:progress { jobId, done, total }
 *   ws:job:out      { jobId, text }
 *   ws:job:err      { jobId, text }
 *   ws:job:result   { jobId, result }
 *   ws:job:done     { jobId, code, final, cancelled, total }
 */

let socket = null;
let reconnectTimer = null;

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${proto}//${location.host}`);

  socket.onopen = () => {
    document.getElementById('ws-dot')?.classList.add('connected');
    clearTimeout(reconnectTimer);
  };

  socket.onclose = () => {
    document.getElementById('ws-dot')?.classList.remove('connected');
    reconnectTimer = setTimeout(connect, 2000);
  };

  socket.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    window.dispatchEvent(new CustomEvent('ws:' + msg.type, { detail: msg }));
  };
}

export function initWebSocket() {
  connect();
}
