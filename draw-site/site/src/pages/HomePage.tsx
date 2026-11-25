import { useEffect, useState } from 'react';
import { historicDrawings } from '../data/historic-drawings';
import SketchPad from '../components/SketchPad';
import { useLang } from '../i18n';

// Tempo que cada cartao fica em destaque (igual ao hover) antes de passar ao proximo.
const HIGHLIGHT_MS = 7000;

const PENDING_SUFFIX = ' · pedido';

export default function HomePage() {
  const { tr } = useLang();
  // Datas de patente "1903 · pedido" viram "filed 1903"; as demais seguem como estão.
  const yearLabel = (year: string) =>
    year.endsWith(PENDING_SUFFIX)
      ? tr(year, `filed ${year.slice(0, -PENDING_SUFFIX.length)}`)
      : year;
  const [active, setActive] = useState(-1);
  useEffect(() => {
    // Com "reduzir movimento" nao ha destaque automatico (nenhum cartao fica
    // marcado); so o hover reage. Acompanha mudancas da preferencia ao vivo.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer = 0;
    const sync = () => {
      window.clearInterval(timer);
      if (reduce.matches) {
        setActive(-1);
        return;
      }
      setActive(-1);
      // O destaque espera a abertura acabar e os quadros terminarem de aparecer.
      timer = window.setInterval(() => {
        if (document.body.classList.contains('intro-active')) return;
        setActive((current) => (current + 1) % historicDrawings.length);
      }, HIGHLIGHT_MS);
    };
    sync();
    reduce.addEventListener('change', sync);
    return () => {
      window.clearInterval(timer);
      reduce.removeEventListener('change', sync);
    };
  }, []);

  return (
    <main className="home-stage" id="page-content" aria-label={tr('Wii, início', 'Wii, home')}>
      <section className="archive-gallery" aria-label={tr('Marcos do corpo e do movimento como controle', 'Milestones of body and motion as input')}>
        {historicDrawings.map((drawing, index) => (
          <a
            className={`archive-card${index === active ? ' is-active' : ''}`}
            href={drawing.source}
            key={drawing.title.pt}
            target="_blank"
            rel="noreferrer"
            style={{ '--i': index } as React.CSSProperties}
            aria-label={tr(
              `${drawing.title.pt}, por ${drawing.artist.pt}, ${yearLabel(drawing.year)}. Abrir fonte.`,
              `${drawing.title.en}, by ${drawing.artist.en}, ${yearLabel(drawing.year)}. Open source.`,
            )}
          >
            <span className="archive-art-surface">
              <svg className="archive-trace" aria-hidden="true">
                <rect pathLength="1" />
              </svg>
              <img src={drawing.image} alt={tr(drawing.alt.pt, drawing.alt.en)} loading="lazy" />
            </span>
            <span className="archive-caption">
              <span className="archive-work">
                <span className="archive-title">{tr(drawing.title.pt, drawing.title.en)}</span>
                <span className="archive-credit">
                  {tr(drawing.artist.pt, drawing.artist.en)} · {yearLabel(drawing.year)}
                </span>
              </span>
              <span className="archive-source" aria-hidden="true">↗</span>
            </span>
          </a>
        ))}
      </section>
      <SketchPad />
    </main>
  );
}
