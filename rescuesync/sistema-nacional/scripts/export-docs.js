import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import YAML from 'yaml';

// Exporta el documento Swagger para la entrega (E3-26) a
// rescuesync/docs/sistema-nacional-api/:
//   openapi.yaml / openapi.json — la spec
//   sistema-nacional-api.html   — documentación autónoma (Redoc, sin internet)
//   sistema-nacional-api.pdf    — si encuentra Chrome/Edge (o CHROME_PATH)
// Con SN_PUBLIC_URL (ej. https://sn.onrender.com) la pone como servidor.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, '../docs/sistema-nacional-api');
mkdirSync(outDir, { recursive: true });

const spec = YAML.parse(await readFile(join(root, 'openapi.yaml'), 'utf8'));
const publicUrl = process.env.SN_PUBLIC_URL;
spec.servers = [
  ...(publicUrl ? [{ url: publicUrl, description: 'Producción (Render)' }] : []),
  { url: 'http://localhost:5000', description: 'Local (docker compose)' },
];

const yamlPath = join(outDir, 'openapi.yaml');
writeFileSync(yamlPath, YAML.stringify(spec, { lineWidth: 0 }));
writeFileSync(join(outDir, 'openapi.json'), `${JSON.stringify(spec, null, 2)}\n`);

const run = (cmd, args) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true });

const htmlPath = join(outDir, 'sistema-nacional-api.html');
const build = run('npx', [
  'redocly',
  'build-docs',
  `"${yamlPath}"`,
  '--output',
  `"${htmlPath}"`,
  '--title',
  '"Sistema Nacional - RescueSync"',
]);
if (build.status !== 0) process.exit(build.status ?? 1);

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const chrome = chromeCandidates.find((candidate) => existsSync(candidate));

if (chrome) {
  const pdfPath = join(outDir, 'sistema-nacional-api.pdf');
  // Perfil temporal propio: no toca el Chrome del usuario ni sus sesiones.
  const profileDir = mkdtempSync(join(tmpdir(), 'sn-docs-chrome-'));
  const pdf = run(`"${chrome}"`, [
    '--headless=new',
    `--user-data-dir="${profileDir}"`,
    '--no-first-run',
    '--disable-sync',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--virtual-time-budget=10000',
    `--print-to-pdf="${pdfPath}"`,
    `"${pathToFileURL(htmlPath).href}"`,
  ]);
  rmSync(profileDir, { recursive: true, force: true });
  if (pdf.status !== 0) console.warn('No se pudo generar el PDF.');
} else {
  console.warn('No encontré Chrome/Edge: se omite el PDF (definí CHROME_PATH).');
}

console.log(`Documentación exportada en ${outDir}`);
