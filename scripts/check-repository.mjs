import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const errors = [];
const r06Bundle = 'produksi/yanmar-6aym-wet-r06';
const activeBundleDocs = [
  'README.md',
  'AGENTS.md',
  'model/README.md',
  'runtime/README.md',
  'ui-workspace/README.md',
  'tests/README.md',
  'agensi/produksi/source/README.md',
  'agensi/produksi/tools/DEPENDENSI.md',
];
const absolute = path => resolve(root, path);
const fail = (path, message) => errors.push(`${path}: ${message}`);
const entryPoints = [
  'AGENTS.md',
  '.codex/config.toml',
  'package.json',
  'package-lock.json',
  'wrangler.toml',
  'dist/index.html',
  'dist/shinko-gj-sim.html',
  'dist/workspace.html',
  'dist/alfa-laval-mab206s.html',
  'dist/man-l2330h.html',
  'dist/tanabe-h74.html',
  'dist/admin.html',
  'dist/afiliasi.html',
  'dist/referensi.html',
  'dist/assets/assembly-diagram.js',
  'functions/alur/_middleware.ts',
  'functions/alur/api/session.ts',
  'apps/alur-workflow/package.json',
  'apps/alur-workflow/worker/hosted_worker.py',
  'tools/gpt-production/toolkit.py',
  'tools/gpt-production/PROMPT-GPT.md',
];

function insideRoot(path) {
  const local = relative(root, path);
  return !isAbsolute(local) && local !== '..' && !local.startsWith(`..${sep}`);
}

function checkPath(location, destination) {
  if (!insideRoot(destination) || !existsSync(destination) || !insideRoot(realpathSync(destination))) {
    fail(location, `jalur lokal tidak tersedia di repo: ${relative(root, destination)}`);
    return false;
  }
  return true;
}

function readJSON(path) {
  if (!checkPath(path, absolute(path))) return null;
  try {
    return JSON.parse(readFileSync(absolute(path), 'utf8'));
  } catch (error) {
    fail(path, `JSON tidak valid: ${error.message}`);
    return null;
  }
}

function cleanMarkdown(source) {
  let fence;
  return source.split(/\r?\n/).map(line => {
    const delimiter = /^ {0,3}(\x60{3,}|~{3,})(.*)$/.exec(line.replace(/^(?: {0,3}> ?)+/, ''));
    if (fence) {
      if (delimiter && delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length
        && !delimiter[2].trim()) fence = undefined;
      return '';
    }
    if (delimiter) {
      fence = delimiter[1];
      return '';
    }
    // Match equal-length code delimiters; a longer run is not a closing delimiter.
    return line.replace(/(?<!\x60)(\x60+)(?!\x60).*?(?<!\x60)\1(?!\x60)/g, '');
  });
}

function linkDestination(text) {
  const input = text.trimStart();
  if (input.startsWith('<')) return /^<((?:\\.|[^>])*)>/.exec(input)?.[1];
  let depth = 0;
  let index = 0;
  for (; index < input.length; index++) {
    const character = input[index];
    if (character === '\\') {
      index++;
    } else if (character === '(') {
      depth++;
    } else if (character === ')') {
      if (!depth) break;
      depth--;
    } else if (/\s/.test(character) && !depth) {
      break;
    }
  }
  if (!depth) return input.slice(0, index);
}

function checkMarkdown(path) {
  const clean = readFileSync(absolute(path), 'utf8').replace(/<!--[\s\S]*?-->/g,
    comment => comment.replace(/[^\n]/g, ''));
  for (const [index, line] of cleanMarkdown(clean).entries()) {
    const candidates = [...line.matchAll(/(?<!\\)\]\(/g)].map(match => line.slice(match.index + 2));
    const definition = /^ {0,3}\[(?!\^).*?\]:\s*(.*)$/.exec(line);
    if (definition) candidates.push(definition[1]);
    for (const tail of candidates) {
      const target = linkDestination(tail)?.replace(/\\([\x20-\x7e])/g, '$1');
      if (!target || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) continue;
      let urlPath;
      try {
        urlPath = decodeURIComponent(target.split(/[?#]/, 1)[0]);
      } catch {
        fail(`${path}:${index + 1}`, `enkode URL tidak valid: ${target}`);
        continue;
      }
      if (!urlPath) continue;
      const destination = urlPath.startsWith('/')
        ? absolute(urlPath.slice(1)) : resolve(dirname(absolute(path)), urlPath);
      checkPath(`${path}:${index + 1}`, destination);
    }
  }
}

function directoryEntries(path) {
  if (!checkPath(path, absolute(path))) return [];
  return readdirSync(absolute(path), { withFileTypes: true });
}

function checkAgentDiscovery() {
  const skills = new Set();
  for (const entry of directoryEntries('.agents/skills')) {
    if (!entry.isDirectory()) continue;
    const path = `.agents/skills/${entry.name}/SKILL.md`;
    if (checkPath(path, absolute(path))) skills.add(entry.name);
  }
  if (!skills.size) fail('.agents/skills', 'tidak ada skill yang dapat ditemukan');
  const claude = directoryEntries('.claude/skills');
  const aliases = new Set();
  for (const entry of claude) {
    const path = `.claude/skills/${entry.name}`;
    if (!lstatSync(absolute(path)).isSymbolicLink()) {
      fail(path, 'alias skill Claude harus berupa symlink');
      continue;
    }
    if (!checkPath(path, absolute(path))) continue;
    if (!skills.has(entry.name) || realpathSync(absolute(path)) !== realpathSync(absolute(`.agents/skills/${entry.name}`))) {
      fail(path, 'alias tidak menuju skill dengan nama yang sama');
    }
    aliases.add(entry.name);
  }
  for (const name of skills) {
    if (!aliases.has(name)) fail('.claude/skills', `alias skill tidak ditemukan: ${name}`);
  }
  const agents = directoryEntries('.codex/agents').filter(entry => entry.isFile() && entry.name.endsWith('.toml'));
  if (!agents.length) fail('.codex/agents', 'tidak ada profil agen yang dapat ditemukan');
  checkRegistry(skills, new Set(agents.map(entry => entry.name.slice(0, -5))));
}

function checkRegistry(skills, agents) {
  const path = 'agensi/registri.json';
  const registry = readJSON(path);
  if (!registry) return;
  if (registry.schema_version !== 1) fail(path, 'versi registri agensi tidak dikenali');
  const requiredDiscovery = {
    codex_config: '.codex/config.toml',
    agents_directory: '.codex/agents',
    skills_directory: '.agents/skills',
    claude_skills_directory: '.claude/skills',
  };
  function checkRecord(field, value) {
    if (typeof value !== 'string' || !value || isAbsolute(value)) {
      fail(path, `jalur registri harus relatif: ${field}`);
      return false;
    }
    return checkPath(`${path} (${field})`, absolute(value));
  }
  function expect(field, value, expected) {
    if (value !== expected) fail(path, `${field} harus menunjuk ${expected}`);
    else checkRecord(field, value);
  }
  function coverage(field, expectedIds, callback) {
    const members = registry[field];
    if (!Array.isArray(members)) {
      fail(path, `${field} bukan daftar`);
      return;
    }
    const seen = new Set();
    for (const entry of members) {
      const id = entry?.id;
      if (!expectedIds.has(id) || seen.has(id)) {
        fail(path, `ID ${field} tidak ditemukan atau berulang: ${id}`);
        continue;
      }
      seen.add(id);
      callback(id, entry);
    }
    for (const id of expectedIds) {
      if (!seen.has(id)) fail(path, `${field} belum mencatat ${id}`);
    }
  }
  for (const [key, destination] of Object.entries(requiredDiscovery)) {
    expect(`discovery.${key}`, registry.discovery?.[key], destination);
  }
  coverage('agents', agents, (id, entry) => {
    const expected = `.codex/agents/${id}.toml`;
    expect(`agents.${id}.path`, entry.path, expected);
    const name = /^name\s*=\s*["']([^"']+)["']/m.exec(readFileSync(absolute(expected), 'utf8'))?.[1];
    if (name !== id) fail(expected, 'name pada TOML tidak sama dengan ID agen');
  });
  coverage('skills', skills, (id, entry) => {
    expect(`skills.${id}.path`, entry.path, `.agents/skills/${id}`);
    expect(`skills.${id}.entrypoint`, entry.entrypoint, `.agents/skills/${id}/SKILL.md`);
    expect(`skills.${id}.claude_alias`, entry.claude_alias, `.claude/skills/${id}`);
  });
  for (const key of ['prompt', 'guide', 'cli', 'worker']) checkRecord(`toolkit.${key}`, registry.toolkit?.[key]);
  if (!Array.isArray(registry.toolkit?.docs)) fail(path, 'toolkit.docs bukan daftar');
  else for (const [index, doc] of registry.toolkit.docs.entries()) checkRecord(`toolkit.docs[${index}]`, doc);
}

function checkDigest(path, sha) {
  if (!checkPath(path, absolute(path))) return;
  const payload = readFileSync(absolute(path));
  const pointer = payload.length < 256
    ? /^version https:\/\/git-lfs\.github\.com\/spec\/v1\noid sha256:([a-f0-9]{64})\nsize \d+\n$/.exec(payload.toString())
    : null;
  const actual = pointer?.[1] ?? createHash('sha256').update(payload).digest('hex');
  if (actual !== sha) fail(path, `SHA r06 berbeda: ${actual}`);
}

function checkModel() {
  const bundle = r06Bundle;
  const dir = `${bundle}/model`;
  const manifest = readJSON(`${dir}/manifest.json`);
  if (!manifest) return;
  const approved = {
    exterior: ['assets/exterior.glb', 'defc58c070a871da2068b2ddd4388ff51b340a1014dfde2226f7e47946a89121'],
    internal: ['assets/internal.glb', '526ce37f126203eb288388dbd7922dd85749b19ddf8ef82ee5bfcf9d472ec8f5'],
    inventory: ['assets/data.json', '329566981da8e0c2ba9d1096cd69c1d29fcce9acc71c1621d20016785fd6adad'],
    catalog: ['assets/daftar-yanmar.json', 'a55d212b4db741fb41575359cf9a081191f6ea34a820c3d72cecc3ecf79a3d01'],
  };
  const properties = new Set(['schemaVersion', 'id', 'name', 'revision', 'units', 'assets',
    'integrity', 'componentCount', 'approval', 'sourceRevision', 'masters']);
  for (const key of Object.keys(manifest)) {
    if (!properties.has(key)) fail(`${dir}/manifest.json`, `properti non-model: ${key}`);
  }
  for (const [key, [asset, sha]] of Object.entries(approved)) {
    if (manifest.assets?.[key] !== asset || manifest.integrity?.[asset] !== sha) {
      fail(`${dir}/manifest.json`, `manifest tidak mempertahankan aset dan SHA r06 untuk ${key}`);
    }
    checkDigest(`${dir}/${asset}`, sha);
  }
  const masters = {
    'masters/exterior.blend': '348d31ac5de8b16352421f643291410b86d59e9634988d0a5ca6d2dfdfb12157',
    'masters/internal.blend': '2dd18541aade76c03c06d9a41ca1aa7c853ff5115a6e89b1b5f4d44dde381e58',
  };
  for (const [file, sha] of Object.entries(masters)) checkDigest(`${dir}/${file}`, sha);
  if (manifest.componentCount !== 1184) fail(`${dir}/manifest.json`, 'jumlah komponen r06 berubah');
  for (const path of ['ui-workspace/index.html', 'ui-workspace/minimal.html',
    'agensi/arsip-asli/INDEKS.json', 'agensi/produksi/source', 'agensi/produksi/tools']) {
    const entry = `${bundle}/${path}`;
    checkPath(entry, absolute(entry));
  }
  checkBundleBoundaries(bundle, new Set(['manifest.json', 'README.md', ...Object.values(approved).map(([asset]) => asset),
    ...Object.keys(masters)]));
}

function checkBundleBoundaries(bundle, modelFiles) {
  const vendor = {
    'vendor/THREE-LICENSE.txt': '7dddf7c5b8fd10ee654db8857d75d104b5557889aa5a91fc4ca545ea7c07062f',
    'vendor/combustion-glow.js': '46df6bfb3200b34d411d825c069f904c37375d6106c53c8ed464b575747fc7fb',
    'vendor/engine-audio.js': 'a2a0036e0f27f753db3549fba5e255f2b548d4cad15239ebfa923ae551407a9d',
    'vendor/flow-ribbons.js': '34a74b961e2e975be8f10403274f3caa1ec7e0030e98ca36f72439ffad396f6e',
    'vendor/functional-motion.js': '0933f4bb115d46188055bbcac7444f011bf4a6becb51ad55027ec12053bf040a',
    'vendor/three-bundle.js': 'd8a3523aafca3d7bc8ae5a4bdd6060366d63246fd14639bddd1fef235b191ce4',
  };
  function scan(section, accept) {
    const dir = `${bundle}/${section}`;
    function visit(folder) {
      for (const entry of directoryEntries(folder)) {
        const path = `${folder}/${entry.name}`;
        if (entry.isDirectory()) visit(path);
        else if (!entry.isFile()) fail(path, 'batas paket tidak mengizinkan symlink atau berkas khusus');
        else accept(path, path.slice(dir.length + 1));
      }
    }
    visit(dir);
  }
  scan('model', (path, file) => {
    if (!modelFiles.has(file)) fail(path, 'model hanya memuat data, GLB, manifest dan master yang tercatat');
  });
  scan('ui-workspace', (path, file) => {
    // Source UI can carry its own presentation assets. Evidence and catalog records belong elsewhere.
    if (!/\.(?:html|m?js|css|md|svg|png|jpe?g|webp|woff2?)$/i.test(file)
      || /(?:^|\/)(?:qa|film|injector-plates|review-r06)(?:\/|$)/i.test(file)
      || /(?:^|\/)daftar-yanmar\.json$/i.test(file)) {
      fail(path, 'UI hanya memuat tampilan dan aset presentasinya');
    }
  });
  scan('runtime', (path, file) => {
    if (!/\.(?:m?js|json|md|txt)$/i.test(file)) {
      fail(path, 'runtime tidak memuat markup, gaya UI, atau aset model');
      return;
    }
    if (file.startsWith('vendor/')) {
      if (!Object.hasOwn(vendor, file)) fail(path, 'vendor r06 tidak tercatat');
      return;
    }
    if (!/\.m?js$/i.test(file)) return;
    const code = readFileSync(absolute(path), 'utf8');
    if (/\b(?:document\s*(?:\.|\[)|querySelector(?:All)?|getElementById)|\.(?:innerHTML|outerHTML|textContent|insertAdjacentHTML)\b|ui-workspace\//.test(code)) {
      fail(path, 'runtime menerima host render dan tidak memilih elemen DOM UI atau mengimpor UI');
    }
  });
  for (const [file, sha] of Object.entries(vendor)) checkDigest(`${bundle}/runtime/${file}`, sha);
  const runtime = `${bundle}/runtime/manifest.json`;
  const manifest = readJSON(runtime);
  if (!manifest) return;
  if (manifest.modelManifest !== '../model/manifest.json') fail(runtime, 'manifest runtime harus menunjuk manifest model');
  if (manifest.session !== 'engine-session.js') fail(runtime, 'entrypoint sesi runtime tidak sesuai');
  if (manifest.powertrain !== 'powertrain.js') fail(runtime, 'entrypoint powertrain tidak sesuai');
  const scripts = Object.keys(vendor).filter(file => file.endsWith('.js'));
  if (!Array.isArray(manifest.vendor) || manifest.vendor.length !== scripts.length
    || !scripts.every(file => manifest.vendor.includes(file))) {
    fail(runtime, 'daftar vendor runtime tidak cocok dengan pustaka r06');
  }
  for (const asset of [manifest.session, manifest.powertrain, ...(Array.isArray(manifest.vendor) ? manifest.vendor : [])]) {
    if (typeof asset !== 'string' || !/^(?:vendor\/)?[a-z\d.-]+\.m?js$/i.test(asset)) {
      fail(runtime, `jalur runtime tidak valid: ${asset}`);
    } else checkPath(runtime, absolute(`${bundle}/runtime/${asset}`));
  }
}

function checkModelRegistry() {
  const path = 'produksi/REGISTRY.json';
  const registry = readJSON(path);
  if (!registry) return;
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.models)) {
    fail(path, 'versi atau daftar model tidak valid');
    return;
  }
  const targets = ['package', 'model', 'workspace', 'agencyArchive', 'manifest', 'runtime', 'runtimeManifest', 'productionSource', 'source', 'sharedWorkspace', 'catalogPage'];
  const models = new Map();
  for (const model of registry.models) {
    if (!model?.id || models.has(model.id)) {
      fail(path, `ID model kosong atau berulang: ${model?.id}`);
      continue;
    }
    models.set(model.id, model);
    for (const field of targets) {
      if (model[field] === undefined) continue;
      if (typeof model[field] !== 'string' || !model[field] || isAbsolute(model[field])) {
        fail(path, `jalur model harus relatif: ${model.id}.${field}`);
      } else checkPath(`${path} (${model.id}.${field})`, absolute(model[field]));
    }
  }
  const trackedModels = new Map([
    ['yanmar-6aym-wet-r06', ['review-not-catalog', 'manifest', 'produksi/yanmar-6aym-wet-r06/model/manifest.json']],
    ['shinko-gj-sim', ['public-simulator', 'source', 'dist/shinko-gj-sim.html']],
    ...['man-l2330h', 'tanabe-h74', 'alfa-laval-mab206s'].map(id =>
      [id, ['premium-catalog-only-in-this-branch', 'catalogPage', `dist/${id}.html`]]),
  ]);
  for (const [id, [status, field, expected]] of trackedModels) {
    const model = models.get(id);
    if (model?.status !== status || model?.[field] !== expected) {
      fail(path, `status atau titik masuk model ${id} berubah`);
    }
  }
}

function checkMoveMap() {
  const path = 'docs/reorganisasi-path.json';
  const map = readJSON(path);
  if (!map) return;
  const targetFrom = new Map();
  if (!map.moves || typeof map.moves !== 'object' || Array.isArray(map.moves)) {
    fail(path, 'daftar perpindahan tidak valid');
  } else {
    for (const [old, destination] of Object.entries(map.moves)) {
      if (typeof destination !== 'string' || !destination || isAbsolute(destination)
        || isAbsolute(old) || !insideRoot(absolute(old)) || old === destination) {
        fail(path, `entri perpindahan tidak valid: ${old}`);
        continue;
      }
      const target = absolute(destination);
      if (targetFrom.has(target)) fail(path, `tujuan perpindahan berulang: ${destination}`);
      targetFrom.set(target, old);
      checkPath(`${path} (${old})`, target);
    }
  }
  if (!Array.isArray(map.preserved)) {
    fail(path, 'daftar jalur yang dipertahankan tidak valid');
    return;
  }
  for (const directory of map.preserved) {
    if (typeof directory !== 'string' || !directory || isAbsolute(directory)) {
      fail(path, `jalur yang dipertahankan tidak valid: ${directory}`);
    } else checkPath(path, absolute(directory));
  }
}

for (const path of entryPoints) checkPath(path, absolute(path));
const tracked = new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  maxBuffer: 16 * 1024 * 1024,
}).toString().split('\0'));
for (const path of tracked) {
  if (path.endsWith('.md') && !path.startsWith('produksi/') && existsSync(absolute(path))) checkMarkdown(path);
}
for (const file of activeBundleDocs) {
  const path = `${r06Bundle}/${file}`;
  if (checkPath(path, absolute(path))) checkMarkdown(path);
}
checkAgentDiscovery();
checkModel();
checkModelRegistry();
checkMoveMap();

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Repository verified: local links, discovery paths, entrypoints and immutable r06 assets.');
}
