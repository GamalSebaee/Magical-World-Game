'use client';

import Link from 'next/link';
import { useSession } from '@features/settings/sessionStore';
import { primaryLang } from '@shared/i18n/language';
import { t } from '@shared/i18n/uiStrings';
import { HomeIcon, NonoPlaceholder } from '@shared/ui/icons';

/** No dead ends (G13): every unknown URL leads home. */
export default function NotFound() {
  const lang = primaryLang(useSession((s) => s.languageMode));
  return (
    <main className="child-screen flex flex-col items-center justify-center gap-6">
      <NonoPlaceholder size={120} />
      <p className="text-xl">{t('notFound', lang)}</p>
      <Link
        href="/"
        aria-label={t('home', lang)}
        className="inline-flex min-h-[88px] min-w-[88px] items-center justify-center rounded-[var(--radius-blob)] border-4 border-ink-700 bg-cloud-0"
      >
        <HomeIcon />
      </Link>
    </main>
  );
}
