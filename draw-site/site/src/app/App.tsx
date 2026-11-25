import { Component, lazy, Suspense, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import DrawTip from '../components/DrawTip';
import Intro from '../components/Intro';
import ScrollbarControl from '../components/ScrollbarControl';
import SiteHeader from '../components/SiteHeader';
import HomePage from '../pages/HomePage';
import PapersPage from '../pages/PapersPage';
import ProductPage from '../pages/ProductPage';
import ArenaShell from '../components/ArenaShell';
import VisionPage from '../pages/VisionPage';
import { useLang } from '../i18n';

export default function App() {
  const location = useLocation();
  const [productRefresh, setProductRefresh] = useState(0);
  const [articleLoadAttempt, setArticleLoadAttempt] = useState(0);
  const ArticlePage = useMemo(() => lazy(() => import('../pages/ArticlePage')), [articleLoadAttempt]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.body.classList.toggle('home-scroll', location.pathname === '/');
  }, [location.pathname]);

  const inArena = /^\/app\/?$/.test(location.pathname); // a arena e '/app'
  // A abertura toca a cada carregamento da pagina (nao a cada navegacao interna); a arena fica de fora.
  const [introOpen, setIntroOpen] = useState(() => !/^\/app\/?$/.test(location.pathname));

  return (
    <>
      {introOpen && <Intro onDone={() => setIntroOpen(false)} />}
      {!inArena && <DrawTip />}
      {!inArena && <SiteHeader
        onRepeatProduct={() => {
          setProductRefresh((revision) => revision + 1);
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
      />}
      <motion.div
        className="route-transition"
        key={location.pathname}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/vision" element={<VisionPage />} />
          <Route path="/papers" element={<PapersPage />} />
          <Route path="/papers/:n" element={
            <ArticleLoadBoundary
              key={`${location.pathname}:${articleLoadAttempt}`}
              onRetry={() => setArticleLoadAttempt((attempt) => attempt + 1)}
            >
              <Suspense fallback={<ArticleLoading />}><ArticlePage /></Suspense>
            </ArticleLoadBoundary>
          } />
          <Route path="/product" element={<ProductPage key={productRefresh} />} />
          <Route path="/app" element={<ArenaShell />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
      {!inArena && <ScrollbarControl />}
    </>
  );
}

function ArticleLoading() {
  const { tr } = useLang();
  return (
    <main className="article" id="page-content" aria-live="polite">
      <p>{tr('Carregando artigo…', 'Loading article…')}</p>
    </main>
  );
}

function ArticleFailed({ onRetry }: { onRetry: () => void }) {
  const { tr } = useLang();
  return (
    <main className="article" id="page-content">
      <Link className="article-back" to="/papers">← papers</Link>
      <p role="alert">{tr('Não foi possível carregar este artigo.', 'This article could not be loaded.')}</p>
      <button className="article-retry" type="button" onClick={onRetry}>{tr('Tentar novamente', 'Try again')}</button>
    </main>
  );
}

class ArticleLoadBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Failed to load article', error, info);
  }

  render() {
    if (this.state.failed) {
      return <ArticleFailed onRetry={this.props.onRetry} />;
    }
    return this.props.children;
  }
}
