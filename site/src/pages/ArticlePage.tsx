import { Fragment, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { papers, type Paper } from '../data/papers';
import { useLang } from '../i18n';
import { buildPdf, markdownToPdfBlocks } from '../lib/pdf';

// Inclui os textos no carregamento da página, sem uma requisição por artigo.
const sources = import.meta.glob<string>('../../../docs/research/[0-9][0-9]-*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const englishSources = import.meta.glob<string>('../data/articles-en/*.md', { query: '?raw', import: 'default', eager: true });
const englishArticles = new Map(Object.entries(englishSources).map(([path, text]) => [path.split('/').pop()?.slice(0, 2), text]));
const articles = new Map(
  Object.entries(sources).map(([path, markdown]) => [path.split('/').pop()?.slice(0, 2), markdown]),
);
const fileNames = new Map(
  Object.keys(sources).map((path) => {
    const file = path.split('/').pop() ?? '';
    return [file.slice(0, 2), file];
  }),
);

/** Idioma que está sendo renderizado agora (definido antes de cada renderização do artigo). */
let activeLang: 'pt' | 'en' = 'pt';
const t = (pt: string, en: string) => (activeLang === 'pt' ? pt : en);

/** Gera o PDF do artigo completo no idioma em que ele está sendo lido, e baixa sem sair da página. */
function downloadArticle(id: string, title: string, markdown: string, english: boolean) {
  const blob = buildPdf(title, markdownToPdfBlocks(markdown));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = (fileNames.get(id) ?? `artigo-${id}.md`).replace(/\.md$/, english ? '-en.pdf' : '.pdf');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const figures = import.meta.glob<string>('../../../docs/research/figures/*.svg', { query: '?url', import: 'default', eager: true });
const figuresEn = import.meta.glob<string>('../../../docs/research/figures/en/*.svg', { query: '?url', import: 'default', eager: true });

function referenceNumbers(value: string): number[] {
  return value.split(/,\s*/).flatMap((part) => {
    const range = part.match(/^(\d+)\s*[–-]\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      return end >= start && end - start < 100 ? Array.from({ length: end - start + 1 }, (_, i) => start + i) : [];
    }
    return /^\d+$/.test(part) ? [Number(part)] : [];
  });
}

let returnToCitation: HTMLElement | null = null;
let showReturnButton: (() => void) | null = null;

function goToReference(number: number, source: HTMLElement) {
  returnToCitation = source;
  showReturnButton?.();
  const target = document.getElementById(`referencia-${number}`);
  const section = target?.closest('details');
  if (section) section.open = true;
}

function shortUrl(value: string): string {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    const path = decodeURI(url.pathname);
    const suffix = path === '/' ? '' : path;
    const label = `${host}${suffix}`;
    return label.length > 55 ? `${label.slice(0, 52)}…` : label;
  } catch {
    return value;
  }
}

// Glossário só em português: os termos são palavras do texto em português.
const glossary: Record<string, { description: string; url: string }> = {
  oclusão: { description: 'Quando um objeto encobre total ou parcialmente outro.', url: 'https://pt.wikipedia.org/wiki/Oclus%C3%A3o_(computa%C3%A7%C3%A3o_gr%C3%A1fica)' },
  rastreamento: { description: 'Acompanhamento da posição ou identidade de um objeto ao longo do tempo.', url: 'https://en.wikipedia.org/wiki/Video_tracking' },
  reprodutibilidade: { description: 'Possibilidade de obter resultados consistentes ao repetir uma investigação sob condições descritas.', url: 'https://pt.wikipedia.org/wiki/Reprodutibilidade' },
  latência: { description: 'Intervalo entre um evento e a resposta observada.', url: 'https://pt.wikipedia.org/wiki/Lat%C3%AAncia' },
  calibração: { description: 'Ajuste ou comparação de um instrumento com uma referência conhecida.', url: 'https://pt.wikipedia.org/wiki/Calibra%C3%A7%C3%A3o' },
  segmentação: { description: 'Separação de uma imagem em regiões ou objetos de interesse.', url: 'https://pt.wikipedia.org/wiki/Segmenta%C3%A7%C3%A3o_de_imagem' },
  interpolação: { description: 'Estimativa de valores entre pontos conhecidos.', url: 'https://pt.wikipedia.org/wiki/Interpola%C3%A7%C3%A3o' },
};

function GlossaryText({ text }: { text: string }) {
  if (activeLang === 'en') return <>{text}</>;
  const pattern = /(oclusão|rastreamento|reprodutibilidade|latência|calibração|segmentação|interpolação)/gi;
  return <>{text.split(pattern).map((part, i) => {
    const entry = glossary[part.toLocaleLowerCase('pt-BR')];
    return entry ? <span className="article-explainer" key={i}><button type="button" className="article-term">{part}</button><span className="article-explainer-card">{entry.description} <a href={entry.url} target="_blank" rel="noopener noreferrer" aria-label={`Saiba mais sobre ${part} na Wikipédia (nova aba)`}>Wikipédia ↗</a></span></span> : part;
  })}</>;
}

// Fatores e níveis da matriz da figura 2 (português, inglês).
const MATRIX_FACTORS: [string, string][] = [['Luz', 'Light'], ['Oclusão', 'Occlusion'], ['Enquadramento', 'Framing']];
const MATRIX_LEVELS: [string, string][] = [['menor', 'lower'], ['médio', 'medium'], ['maior', 'higher']];

function matrixCellText(factor: [string, string], level: [string, string]) {
  return `${t(factor[0], factor[1])}: ${t('nível ', 'level ')}${t(level[0], level[1])}. ${t('Combinação prevista para avaliação, sem dados medidos.', 'Planned combination for evaluation, with no measured data.')}`;
}

function Figure({ src, description, matrix, left, number }: { src: string; description: string; matrix: boolean; left: boolean; number: string | undefined }) {
  const [cell, setCell] = useState('');
  const show = (factor: [string, string], level: [string, string]) => setCell(matrixCellText(factor, level));
  return <div id={number ? `figura-${number}` : undefined} className={`article-figure-wrap${left ? ' article-figure-wrap--left' : ''}`}>
    <div className="article-figure-image"><img className="article-figure" src={src} alt={description} loading="lazy" />
      {matrix && <div className="article-matrix" aria-label={t('Explorar condições da matriz', 'Explore the matrix conditions')}>{MATRIX_FACTORS.flatMap((factor) => MATRIX_LEVELS.map((level) => <button type="button" key={`${factor[1]}-${level[1]}`} aria-label={matrixCellText(factor, level).split('. ')[0]} onMouseEnter={() => show(factor, level)} onFocus={() => show(factor, level)} onClick={() => show(factor, level)} />))}</div>}
    </div>
    <div className="article-figure-hover" aria-hidden="true">{cell || description}</div>
    <details className="article-figure-info"><summary>{t('Entenda esta figura', 'Understand this figure')}</summary><p>{cell || description}</p></details>
  </div>;
}

const URL_AT_END = /^(https?:\/\/.*?)([.,;:)\]]*)$/;

/** **negrito**, *itálico* e endereços http(s) viram links; nada de HTML cru. */
function inline(text: string, refs: Map<number, string> = new Map()): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/\S+|\[\d+(?:\s*[,–-]\s*\d+)*\]|\b(?:[Ff]igura|[Ff]igure)\s+\d+\b)/g).map((s, i) => {
    const figure = s.match(/^(?:[Ff]igura|[Ff]igure)\s+(\d+)$/);
    if (figure) return <a key={i} href={`#figura-${figure[1]}`} onClick={(event) => {
      const target = document.getElementById(`figura-${figure[1]}`);
      if (!target) { event.preventDefault(); return; }
      event.preventDefault();
      returnToCitation = event.currentTarget;
      showReturnButton?.();
      const section = target.closest('details');
      if (section) section.open = true;
      target.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }}>{s}</a>;
    if (/^\[\d/.test(s)) {
      const numbers = referenceNumbers(s.slice(1, -1));
      if (numbers.length && numbers.every((n) => refs.has(n))) {
        if (numbers.length === 1) return <a key={i} href={`#referencia-${numbers[0]}`} onClick={(event) => goToReference(numbers[0], event.currentTarget)} title={refs.get(numbers[0])}>{s}</a>;
        return <span className="article-citation" key={i}>
          <button type="button" aria-label={`${t('Referências', 'References')} ${s}`} aria-haspopup="true">{s}</button>
          <span className="article-citation-list">{numbers.map((n) => <a key={n} href={`#referencia-${n}`} onClick={(event) => goToReference(n, event.currentTarget.closest('.article-citation')?.querySelector('button') ?? event.currentTarget)}><strong>[{n}]</strong> {refs.get(n)} <span aria-hidden="true">→</span></a>)}</span>
        </span>;
      }
    }
    if (s.startsWith('**') && s.endsWith('**') && s.length > 4) return <strong key={i}>{s.slice(2, -2)}</strong>;
    if (s.startsWith('*') && s.endsWith('*') && s.length > 2) return <em key={i}>{s.slice(1, -1)}</em>;
    const url = /^https?:\/\//.test(s) ? URL_AT_END.exec(s) : null;
    if (url) {
      return (
        <Fragment key={i}>
          <a href={url[1]} target="_blank" rel="noopener noreferrer" title={url[1]} aria-label={`${t('Abrir', 'Open')} ${shortUrl(url[1])} ${t('(nova aba)', '(new tab)')}`}>{shortUrl(url[1])} ↗</a>
          {url[2]}
        </Fragment>
      );
    }
    return <Fragment key={i}><GlossaryText text={s} /></Fragment>;
  });
}

const isRow = (l: string) => l.trimStart().startsWith('|');
const cells = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

/** Subconjunto de Markdown usado pelos artigos: títulos, parágrafos, listas, tabelas e referências; figuras ficam de fora. */
function render(md: string, refs: Map<number, string>, english: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  const blocks = md.trim().split(/\n{2,}/);
  blocks.forEach((b, i) => {
    const lines = b.split('\n').map((l) => l.replace(/\s+$/, '')).filter(Boolean);
    if (lines.length === 0) return;
    if (b.startsWith('# ')) out.push(<h1 key={i}>{b.slice(2)}</h1>);
    else if (b.startsWith('## ')) out.push(<h2 key={i}>{b.slice(3)}</h2>);
    else if (b.startsWith('### ')) out.push(<h3 key={i}>{b.slice(4)}</h3>);
    else if (lines.every((l) => /^!\[[^\]]*\]\([^)]*\)$/.test(l))) {
      lines.forEach((line, j) => {
        const match = line.match(/^!\[([^\]]*)\]\(figures\/([^/)]+)\)$/);
        // Versão inglesa da figura quando o artigo está em inglês; senão, a original.
        const src = match && (english ? figuresEn[`../../../docs/research/figures/en/${match[2]}`] : undefined)
          || (match && figures[`../../../docs/research/figures/${match[2]}`]);
        if (src) {
          const description = blocks[i + 1]?.replace(/^\*\*(?:Figura|Figure) \d+\.\*\*\s*/, '').trim() || t('Figura ilustrativa do artigo.', 'Illustrative figure from the article.');
          out.push(<Figure key={`${i}-${j}`} number={blocks[i + 1]?.match(/^\*\*(?:Figura|Figure) (\d+)\./)?.[1]} src={src} description={description} matrix={match?.[2] === '02-matriz-fatores.svg'} left={(match?.[2]?.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) ?? 0) % 2 === 0} />);
        }
      });
    }
    else if (lines.every(isRow)) {
      const rows = lines.map(cells).filter((r) => !r.every((c) => /^:?-{3,}:?$/.test(c)));
      const [head, ...body] = rows;
      out.push(
        <div className="article-table" key={i} role="region" aria-label={t('Tabela', 'Table')} tabIndex={0}>
          <table>
            <thead><tr>{head.map((c, j) => <th key={j} scope="col">{inline(c, refs)}</th>)}</tr></thead>
            <tbody>{body.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c, refs)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
    } else if (lines.every((l) => /^[-*] /.test(l))) {
      out.push(<ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2), refs)}</li>)}</ul>);
    } else if (lines.every((l) => /^\d+\. /.test(l))) {
      out.push(<ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+\. /, ''), refs)}</li>)}</ol>);
    } else if (lines.length > 1 && lines.every((l) => /^\[\d+\] /.test(l))) {
      out.push(<ul className="article-refs" key={i}>{lines.map((l, j) => <li id={`referencia-${l.match(/^\[(\d+)\]/)?.[1]}`} key={j}>{l.match(/^\[\d+\]/)?.[0]} {inline(l.replace(/^\[\d+\] /, ''), refs)}</li>)}</ul>);
    } else if (i === 1 && lines.every((l) => l.startsWith('**') && l.includes(':**'))) {
      out.push(<p className="article-meta" key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, refs)}</Fragment>)}</p>);
    } else {
      out.push(<p key={i}>{inline(lines.join(' '), refs)}</p>);
    }
  });
  return out;
}

function ArticleContent({ markdown, english }: { markdown: string; english: boolean }) {
  const refs = new Map<number, string>();
  for (const line of markdown.split('\n')) {
    const match = line.match(/^\[(\d+)\] (.+)$/);
    if (match) refs.set(Number(match[1]), match[2].replace(/https?:\/\/\S+/g, '').trim());
  }
  const parts = markdown.split(/(?=^## )/m);
  const sections = parts.slice(1).map((part, index) => {
    const [heading, ...body] = part.split('\n');
    return { title: heading.slice(3).trim(), body: body.join('\n'), id: `topico-${index + 1}` };
  });
  return <>
    {render(parts[0], refs, english)}
    {sections.length > 0 && <nav className="article-contents" aria-label={t('Conteúdo do artigo', 'Article contents')}>
      <h2>{t('Conteúdo', 'Contents')}</h2>
      <ol>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`} onClick={() => {
        const target = document.getElementById(section.id) as HTMLDetailsElement | null;
        if (target) target.open = true;
      }}>{section.title}</a></li>)}</ol>
    </nav>}
    {sections.map((section) => <details className="article-section" id={section.id} key={section.id} open>
      <summary><h2>{section.title}</h2></summary>
      {render(section.body, refs, english)}
    </details>)}
  </>;
}

function DownloadButton({ className, onClick }: { className: string; onClick: () => void }) {
  const label = t('Baixar artigo em PDF', 'Download article as PDF');
  return (
    <button type="button" className={className} onClick={onClick} aria-label={label} title={label}>
      {t('Baixar', 'Download')}
    </button>
  );
}

export default function ArticlePage() {
  const { lang, tr } = useLang();
  activeLang = lang;
  const [canReturn, setCanReturn] = useState(false);
  showReturnButton = () => setCanReturn(true);
  const { n = '' } = useParams();
  const id = n.padStart(2, '0');
  const idx = papers.findIndex((p) => p.n === id);
  if (idx === -1) return <Navigate to="/papers" replace />;

  const english = englishArticles.get(id);
  const useEnglish = lang === 'en' && !!english;
  const md = useEnglish ? english : articles.get(id);
  const prev = papers[idx - 1];
  const next = papers[idx + 1];
  const paper = papers[idx];
  // Título e rótulo curto no idioma da tela (cada artigo tem as duas versões em papers.ts).
  const copy = (p: Paper) => (lang === 'en' ? p.en : p);
  const title = useEnglish ? (english.match(/^# (.+)$/m)?.[1] ?? copy(paper).title) : paper.title;

  return (
    <main className="article" id="page-content">
      <div className="article-top">
        <Link className="article-back" to="/papers">← papers</Link>
        {md && <DownloadButton className="article-download article-download--top" onClick={() => downloadArticle(id, title, md, useEnglish)} />}
      </div>
      {lang === 'en' && !english && <p className="article-language-note">The full English translation of this article is not available yet. Showing the Portuguese original.</p>}
      {md ? <article lang={useEnglish ? 'en' : 'pt-BR'}><ArticleContent key={`${id}-${useEnglish ? 'en' : 'pt'}`} markdown={md} english={useEnglish} /></article> : <p>{tr('Não foi possível carregar este artigo.', 'This article could not be loaded.')}</p>}
      {md && <DownloadButton className="article-download" onClick={() => downloadArticle(id, title, md, useEnglish)} />}
      {canReturn && <button type="button" className="article-return" onClick={() => {
        const target = returnToCitation;
        if (target?.isConnected) {
          const section = target.closest('details');
          if (section) section.open = true;
          target.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
          target.focus({ preventScroll: true });
        }
        setCanReturn(false);
      }}>{tr('← Voltar à leitura', '← Back to reading')}</button>}
      <nav className="article-nav" aria-label={tr('Artigos', 'Articles')}>
        {prev ? <Link to={`/papers/${prev.n}`}>← {prev.n} {copy(prev).short}</Link> : <span />}
        {next ? <Link to={`/papers/${next.n}`}>{next.n} {copy(next).short} →</Link> : <span />}
      </nav>
    </main>
  );
}
