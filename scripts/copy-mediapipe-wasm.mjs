import { copyFile, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  await readFile(resolve(root, 'node_modules/@mediapipe/tasks-vision/package.json'), 'utf8'),
);
if (packageJson.version !== '1.2.3') throw new Error(`Unexpected tasks-vision version: ${packageJson.version}`);

const source = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const mediapipeDir = resolve(root, 'public/mediapipe');
for (const entry of await readdir(mediapipeDir)) {
  if (entry === 'wasm' || entry.startsWith('wasm-'))
    await rm(resolve(mediapipeDir, entry), { recursive: true, force: true });
}
const destination = resolve(mediapipeDir, `wasm-${packageJson.version}`);
await mkdir(destination, { recursive: true });
const files = ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm'];
for (const file of files) await copyFile(resolve(source, file), resolve(destination, file));

const modelsDir = resolve(mediapipeDir, 'models');
const checksums = new Map();
for (const line of (await readFile(resolve(modelsDir, 'SHA256SUMS'), 'utf8')).split('\n')) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  const parts = trimmed.split(/\s+/);
  const [digest, file] = parts;
  if (parts.length !== 2 || !/^[0-9a-f]{64}$/.test(digest)) throw new Error(`Malformed SHA256SUMS line: ${trimmed}`);
  if (checksums.has(file)) throw new Error(`Duplicate SHA256SUMS entry for ${file}`);
  checksums.set(file, digest);
}

const modelSpecs = [
  { prefix: 'pose_landmarker_lite', constant: 'POSE_MODEL_SHA8' },
  { prefix: 'hand_landmarker', constant: 'HAND_MODEL_SHA8' },
];
const verifiedModels = [];
const modelFiles = await readdir(modelsDir);
for (const spec of modelSpecs) {
  const candidates = modelFiles.filter((name) => name.startsWith(`${spec.prefix}.`) && name.endsWith('.task'));
  if (candidates.length !== 1)
    throw new Error(
      `Expected exactly one ${spec.prefix} model in public/mediapipe/models/ (found ${candidates.length})`,
    );
  const modelFile = candidates[0];
  const digest = createHash('sha256')
    .update(await readFile(resolve(modelsDir, modelFile)))
    .digest('hex');
  const sha8 = digest.slice(0, 8);
  const expectedName = `${spec.prefix}.${sha8}.task`;
  if (modelFile !== expectedName)
    throw new Error(`${spec.prefix} model must be named ${expectedName} (found ${modelFile})`);
  const expected = checksums.get(expectedName);
  if (!expected) throw new Error(`SHA256SUMS has no entry for ${expectedName}`);
  if (digest !== expected)
    throw new Error(`${spec.prefix} model checksum mismatch. Expected ${expected}, got ${digest}`);
  verifiedModels.push({ ...spec, sha8, expectedName });
}

const expectedModelNames = new Set(verifiedModels.map((model) => model.expectedName));
for (const file of checksums.keys()) {
  if (!expectedModelNames.has(file)) throw new Error(`SHA256SUMS entry has no verified model: ${file}`);
}
const unknownModels = modelFiles.filter((name) => name.endsWith('.task') && !expectedModelNames.has(name));
if (unknownModels.length)
  throw new Error(`Unverified model files in public/mediapipe/models/: ${unknownModels.join(', ')}`);

const assetsSource = await readFile(resolve(root, 'src/arena/cv/mediapipeAssets.ts'), 'utf8');
for (const [name, value] of [
  ['MEDIAPIPE_WASM_VERSION', packageJson.version],
  ...verifiedModels.map((model) => [model.constant, model.sha8]),
]) {
  const exported = assetsSource.match(new RegExp(`^export\\s+const\\s+${name}\\s*=\\s*'([^']+)'`, 'm'))?.[1];
  if (exported !== value) throw new Error(`src/arena/cv/mediapipeAssets.ts is out of sync: expected ${name} = '${value}'`);
}
console.log(
  `MediaPipe ${packageJson.version}: module WASM copied to wasm-${packageJson.version}/; ${verifiedModels.map((model) => model.expectedName).join(' and ')} verified.`,
);
