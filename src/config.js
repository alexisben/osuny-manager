import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, '../data/config.json');

export const DEFAULT_CONFIG = {
  sitesRoot: process.env.SITES_ROOT || path.join(process.env.HOME, 'sites'),
  themeModule: 'themes/osuny',
  subthemeModule: 'themes/osuny-theme',
  pagespeedApiKey: '',
  concurrency: 4,
};

export async function getConfig() {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(updates) {
  const current = await getConfig();
  const next = { ...current, ...updates };
  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}
