import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { translations } from '../i18n/translations.js';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  // 'vi' | 'en'
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem('hs_language') || 'vi';
    } catch {
      return 'vi';
    }
  });

  const setLanguage = useCallback((lang) => {
    const valid = lang === 'en' ? 'en' : 'vi';
    setLanguageState(valid);
    try {
      localStorage.setItem('hs_language', valid);
      document.documentElement.setAttribute('lang', valid);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      document.documentElement.setAttribute('lang', language);
    } catch {}
  }, [language]);

  /**
   * Helper dịch thuật thông minh
   * @param {string} path - key phân cách bằng dấu chấm (ví dụ: 'common.save' hoặc 'users.showingCount')
   * @param {object} params - các tham số nội suy (ví dụ: { filtered: 5, total: 10 })
   * @returns {string} Chuỗi đã dịch hoặc fallback
   */
  const t = useCallback(
    (path, params = {}) => {
      if (!path) return '';
      const keys = path.split('.');
      let current = translations[language];

      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          // Fallback sang tiếng Việt nếu thiếu key
          let fallback = translations.vi;
          for (const fk of keys) {
            if (fallback && typeof fallback === 'object' && fk in fallback) {
              fallback = fallback[fk];
            } else {
              return path;
            }
          }
          current = fallback;
          break;
        }
      }

      if (typeof current !== 'string') {
        return path;
      }

      // Thay thế placeholder {key} với params
      let res = current;
      if (params && typeof params === 'object') {
        for (const [pKey, pVal] of Object.entries(params)) {
          res = res.replaceAll(`{${pKey}}`, String(pVal ?? ''));
        }
      }
      return res;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}

