'use client';

import { useEffect } from 'react';
import { useSession } from '@features/settings/sessionStore';
import { primaryLang } from '@shared/i18n/language';
import { t } from '@shared/i18n/uiStrings';
import { BigButton } from '@shared/ui/BigButton';
import { HomeIcon, NonoPlaceholder, RetryIcon } from '@shared/ui/icons';

/** Root error boundary (02 §10): friendly, with retry and a way home. */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = primaryLang(useSession((s) => s.languageMode));
  useEffect(() => {
    console.error('[app] unhandled render error', error);
  }, [error]);
  return (
    <main className="child-screen flex flex-col items-center justify-center gap-6" role="alert">
      <NonoPlaceholder size={120} />
      <p className="text-xl">{t('bootError', lang)}</p>
      <div className="flex gap-4">
        <BigButton label={t('retry', lang)} onPress={reset}>
          <RetryIcon />
        </BigButton>
        <BigButton label={t('home', lang)} onPress={() => window.location.assign('/')}>
          <HomeIcon />
        </BigButton>
      </div>
    </main>
  );
}
