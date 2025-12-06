import { Messages, Locale } from './types';
import { commonEn } from './locales/en/common';
import { layoutEn } from './locales/en/layout';
import { authEn } from './locales/en/auth';
import { bcmEn } from './locales/en/bcm';
import { scmEn } from './locales/en/scm';
import { orgEn } from './locales/en/org';
import { supportEn } from './locales/en/support';
import { financeEn } from './locales/en/finance';
import { settingsEn } from './locales/en/settings';

const enMessages: Messages = {
  common: commonEn,
  layout: layoutEn,
  auth: authEn,
  bcm: bcmEn,
  scm: scmEn,
  org: orgEn,
  support: supportEn,
  finance: financeEn,
  settings: settingsEn,
};

const messagesByLocale: Record<Locale, Messages> = {
  en: enMessages,
};

let currentLocale: Locale = 'en';

export function getLocale(): Locale {
  return currentLocale;
}

// на будущее – смена языка
export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function t(path: string): string {
  const localeMessages = messagesByLocale[currentLocale];
  const parts = path.split('.');
  let current: any = localeMessages;

  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      // fallback: вернуть ключ, чтобы было видно, что перевода нет
      return path;
    }
    current = current[part];
  }

  if (typeof current === 'string') {
    return current;
  }

  return path;
}

