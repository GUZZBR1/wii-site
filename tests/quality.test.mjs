import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { classify, createGovernor, parseSaved, reusableLevel } from '../src/lib/quality.ts';

const good = { cores: 8, memory: 8, renderer: 'GPU' };
const run = (governor, ms, seconds) => { for (let t = 0; t < seconds * 1000; t += ms) governor.sample(ms); return governor.level; };

test('a medida decide, o hardware só limita', () => {
  assert.equal(classify(3, good), 5);
  assert.equal(classify(9, good), 3);
  assert.equal(classify(40, good), 0);
  assert.equal(classify(3, { ...good, cores: 2 }), 3);
  assert.equal(classify(1, { ...good, renderer: 'Google SwiftShader' }), 1);
});

test('desce quando está lento e não volta ao degrau que falhou', () => {
  const governor = createGovernor(5);
  assert.equal(run(governor, 30, 4.5), 4);
  assert.equal(run(governor, 16, 60), 4);
});

test('sobe só depois de um período longo e fluido', () => {
  const governor = createGovernor(3);
  assert.equal(run(governor, 16, 5), 3);
  assert.equal(run(governor, 16, 4), 4);
});

test('engasgos isolados e pausas não trocam o nível', () => {
  const governor = createGovernor(3);
  for (let i = 0; i < 300; i++) governor.sample(i % 20 ? 20 : 80);
  governor.sample(5000);
  assert.equal(governor.level, 3);
});

test('perfil salvo expira e depende do aparelho', () => {
  const saved = { mode: 'auto', level: 3, signature: 'a', at: 1000 };
  assert.equal(reusableLevel(saved, 'a', 2000), 3);
  assert.equal(reusableLevel(saved, 'b', 2000), undefined);
  assert.equal(reusableLevel(saved, 'a', 1000 + 8 * 864e5), undefined);
  assert.deepEqual(parseSaved('lixo'), { mode: 'auto' });
});

test('o cursor de mão não depende do preenchimento preto padrão do SVG', () => {
  const css = readFileSync(new URL('../src/arena/arena.css', import.meta.url), 'utf8');
  for (const selector of ['.hand-layer', '.hand-cursor', '.hand-ring', '.hand-icon']) {
    assert.ok(css.includes(selector), `faltou ${selector}`);
  }
  assert.match(css, /\.hand-ring\s*\{[^}]*fill:\s*none/);
  assert.match(css, /\.hand-icon\s*\{[^}]*fill:\s*#fff/);
});
