import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import { getConfig, saveConfig } from './config.js';
import { discoverSites, getSiteUrl, invalidateSitesCache, clearUrlCache } from './sites.js';
import { getSubmoduleStatus, updateSubmodules, initSubmodules } from './submodules.js';
import { attachWebSocket, cancelJob, cleanupOldJobs } from './jobs.js';
import { pLimit } from './utils.js';
import { runW3C } from './tests/w3c.js';
import { runSchema } from './tests/schema.js';
import { runPagespeed } from './tests/pagespeed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
attachWebSocket(server);

// ── Config ─────────────────────────────────────────────────────────────────────
app.get('/api/config', async (req, res) => {
  res.json(await getConfig());
});

app.post('/api/config', async (req, res) => {
  const config = await saveConfig(req.body);
  invalidateSitesCache();
  clearUrlCache();
  res.json({ ok: true, config });
});

// ── Sites ──────────────────────────────────────────────────────────────────────
app.get('/api/sites', async (req, res) => {
  const config = await getConfig();
  const force = req.query.refresh === '1';
  const sites = await discoverSites(config.sitesRoot, force);
  res.json({ sites, total: sites.length, root: config.sitesRoot });
});

// Statut submodules d'un seul site
app.get('/api/sites/:name/submodules', async (req, res) => {
  const config = await getConfig();
  const sitePath = path.join(config.sitesRoot, req.params.name);
  const force = req.query.refresh === '1';
  const modules = await getSubmoduleStatus(sitePath, req.params.name, force);
  res.json({ modules });
});

// Statuts submodules en batch — évite 800 requêtes HTTP individuelles
app.post('/api/sites/submodules-batch', async (req, res) => {
  const { names } = req.body;
  const config = await getConfig();
  const limit = pLimit(8);
  const results = await Promise.all(
    names.map((name) =>
      limit(async () => {
        const sitePath = path.join(config.sitesRoot, name);
        const modules = await getSubmoduleStatus(sitePath, name);
        return { name, modules };
      })
    )
  );
  res.json({ results });
});

// URLs en batch
app.post('/api/sites/urls-batch', async (req, res) => {
  const { names } = req.body;
  const config = await getConfig();
  const limit = pLimit(16);
  const results = await Promise.all(
    names.map((name) =>
      limit(async () => {
        const sitePath = path.join(config.sitesRoot, name);
        const url = await getSiteUrl(sitePath, name);
        return { name, url };
      })
    )
  );
  res.json({ results });
});

// ── Submodules ─────────────────────────────────────────────────────────────────
app.post('/api/submodules/update', async (req, res) => {
  const { sites, modules = [], concurrency } = req.body;
  const config = await getConfig();
  const jobId = updateSubmodules(sites, config.sitesRoot, modules, concurrency ?? config.concurrency);
  res.json({ jobId, started: true });
});

app.post('/api/submodules/init', async (req, res) => {
  const { sites, concurrency } = req.body;
  const config = await getConfig();
  const jobId = initSubmodules(sites, config.sitesRoot, concurrency ?? config.concurrency);
  res.json({ jobId, started: true });
});

// ── Jobs ───────────────────────────────────────────────────────────────────────
app.post('/api/jobs/:jobId/cancel', (req, res) => {
  const ok = cancelJob(req.params.jobId);
  res.json({ ok });
});

// ── Tests ──────────────────────────────────────────────────────────────────────
app.post('/api/test/w3c', (req, res) => {
  const jobId = runW3C(req.body.urls ?? []);
  res.json({ jobId, started: true });
});

app.post('/api/test/schema', (req, res) => {
  const jobId = runSchema(req.body.urls ?? []);
  res.json({ jobId, started: true });
});

app.post('/api/test/pagespeed', async (req, res) => {
  const config = await getConfig();
  const { urls = [], strategy = 'mobile' } = req.body;
  const jobId = runPagespeed(urls, strategy, config.pagespeedApiKey);
  res.json({ jobId, started: true });
});

// ── Maintenance ────────────────────────────────────────────────────────────────
setInterval(cleanupOldJobs, 300_000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🌿 Osuny Manager → http://localhost:${PORT}\n`);
});
