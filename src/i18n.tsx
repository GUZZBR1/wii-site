import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'pt' | 'en';

const STORAGE_KEY = 'wii-lang';

/** Idioma salvo; sem preferência salva, segue o idioma do navegador (português ou inglês). */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'pt' || saved === 'en') return saved;
  } catch {
    /* sem armazenamento: cai no idioma do navegador */
  }
  if (typeof navigator === 'undefined') return 'en';
  // Ordem de preferência do navegador: o primeiro idioma conhecido decide.
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  const first = preferred.find((code) => /^(pt|en)\b/i.test(code));
  return first && /^pt\b/i.test(first) ? 'pt' : 'en';
}

interface LangValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Escolhe o texto do idioma atual: tr('português', 'english'). */
  tr: <T = string>(pt: T, en: T) => T;
  /** Locale BCP 47 do idioma atual, para datas e ordenação. */
  locale: string;
}

const LangContext = createContext<LangValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  }, [lang]);

  const value = useMemo<LangValue>(
    () => ({
      lang,
      setLang,
      tr: (pt, en) => (lang === 'pt' ? pt : en),
      locale: lang === 'pt' ? 'pt-BR' : 'en-US',
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangValue {
  const value = useContext(LangContext);
  if (!value) throw new Error('useLang precisa estar dentro de <LangProvider>');
  return value;
}

/** Texto de dados estáticos: um objeto { pt, en }. */
export type Bilingual = { pt: string; en: string };
