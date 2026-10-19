import type { ReactNode } from 'react';
import type { Lang } from './language';

/**
 * Isolates embedded text of the other direction, e.g. an English word inside an Arabic caption,
 * so punctuation and numbers do not reorder (05 §4.2).
 */
export function Bdi({ lang, children }: { lang?: Lang; children: ReactNode }) {
  return (
    <bdi lang={lang} dir={lang ? (lang === 'ar' ? 'rtl' : 'ltr') : 'auto'}>
      {children}
    </bdi>
  );
}
