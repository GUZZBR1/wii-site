import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductAsciiArt from '../components/ProductAsciiArt';
import { useLang } from '../i18n';
import { runWarp } from '../lib/warp';

export default function ProductPage() {
  const { tr } = useLang();
  const navigate = useNavigate();
  const stopWarp = useRef<() => void>(() => undefined);
  useEffect(() => () => {
    stopWarp.current();
    document.body.classList.remove('is-falling');
  }, []);

  const enterArena = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (document.body.classList.contains('is-falling')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigate('/app');
      return;
    }
    document.body.classList.add('is-falling');
    stopWarp.current = runWarp(() => {
      navigate('/app');
      // A arena ja nasce coberta pelo flash branco; so entao soltamos o tunel.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        stopWarp.current();
        document.body.classList.remove('is-falling');
      }));
    });
  };

  return (
    <main className="product-page" id="page-content">
      <section className="product-content">
        <Link className="product-status product-emerge group" style={{ '--emerge': 300 } as CSSProperties} to="/app" onClick={enterArena} aria-label={tr('Em construção. Abrir a arena Wii.', 'Under construction. Open the Wii arena.')}>
          <span className="status-dot" />
          {tr('em construção', 'under construction')}
          <span className="status-arrow" aria-hidden="true">↗</span>
        </Link>
        <figure className="construction-art">
          <ProductAsciiArt />
        </figure>
        <h1 className="product-headline product-emerge" style={{ '--emerge': 900 } as CSSProperties}>
          {tr('Do primeiro passo', 'From the first step')}
          <br />
          <em>{tr('ao próximo recorde.', 'to the next record.')}</em>
        </h1>
        <p className="product-description product-emerge" style={{ '--emerge': 1500 } as CSSProperties}>
          {tr(
            'Estamos construindo uma arena arcade no navegador, controlada pelo corpo. Corrida de obstáculos e tênis começam no seu movimento; o que a arena pode se tornar ainda está sendo construído.',
            'We are building an arcade arena in the browser, controlled by your body. Hurdle running and tennis start with your movement; what the arena can become is still being built.',
          )}
        </p>

        <Link className="vision-cta product-emerge" style={{ '--emerge': 2100 } as CSSProperties} to="/vision">
          {tr('Leia a visão', 'Read the vision')} <span aria-hidden="true">↗</span>
        </Link>
      </section>
    </main>
  );
}
