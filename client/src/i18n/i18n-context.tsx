import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  FALLBACK_LANGUAGE,
  messages,
  normalizeLanguage,
  type Language,
} from './messages';

const STORAGE_KEY = 'faxhistoria.language';

interface I18nContextValue {
  language: Language;
  setLanguage: (next: Language) => void;
  text: (typeof messages)[Language];
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function resolveInitialLanguage(): Language {
  if (typeof window === 'undefined') {
    return FALLBACK_LANGUAGE;
  }

  const stored = normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
  if (stored) {
    return stored;
  }

  const browserPreference = window.navigator.languages?.[0] ?? window.navigator.language;
  return normalizeLanguage(browserPreference) ?? FALLBACK_LANGUAGE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => resolveInitialLanguage());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, language);
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      text: messages[language],
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
