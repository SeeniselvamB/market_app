// src/storage/LanguageContext.tsx
// Centralized language/translation context

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, translations } from '../utils/translations';

interface LangContextType {
  lang: Language;
  setLang: (l: Language) => Promise<void>;
  t: typeof translations.en;
}

const LangContext = createContext<LangContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  React.useEffect(() => {
    AsyncStorage.getItem('@lang').then(saved => {
      if (saved === 'en' || saved === 'ta') setLangState(saved);
    });
  }, []);

  const setLang = useCallback(async (l: Language) => {
    setLangState(l);
    await AsyncStorage.setItem('@lang', l);
  }, []);

  const t = translations[lang];

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be inside LanguageProvider');
  return ctx;
}
