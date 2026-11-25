// Verifica que o build realmente empacotou os artigos e as figuras de
// ../docs/research. import.meta.glob aceita resultado vazio sem erro, então um
// build verde podia esconder artigos ausentes (achado do review no draw-core).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const siteDir = join(new URL('.', import.meta.url).pathname, '..');
const researchDir = join(siteDir, '../docs/research');
const bundle = readdirSync(join(siteDir, 'dist/assets'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(join(siteDir, 'dist/assets', f), 'utf8'))
  .join('\n');

const titleOf = (path) => {
  const line = readFileSync(path, 'utf8').split('\n').find((l) => l.startsWith('# '));
  return line ? line.slice(2).trim() : null;
};

const missing = [];
const check = (name, haystack) => { if (!bundle.includes(haystack)) missing.push(name); };

const pt = readdirSync(researchDir).filter((f) => /^\d\d-.*\.md$/.test(f));
const en = readdirSync(join(siteDir, 'src/data/articles-en')).filter((f) => f.endsWith('.md'));
if (pt.length === 0) missing.push('nenhum artigo PT em docs/research');
if (en.length === 0) missing.push('nenhum artigo EN em src/data/articles-en');
for (const f of pt) check(`artigo PT ${f}`, titleOf(join(researchDir, f)) ?? f);
for (const f of en) check(`artigo EN ${f}`, titleOf(join(siteDir, 'src/data/articles-en', f)) ?? f);

for (const dir of ['figures', 'figures/en']) {
  for (const f of readdirSync(join(researchDir, dir)).filter((f) => f.endsWith('.svg'))) {
    check(`figura ${dir}/${f}`, `${dir}/${f}`);
  }
}

if (missing.length) {
  console.error(`Build sem ${missing.length} item(ns) esperados:`);
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}
console.log(`OK: ${pt.length} artigos PT, ${en.length} EN e as figuras estão no bundle.`);
