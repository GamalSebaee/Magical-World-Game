'use client';

import { useRouter } from 'next/navigation';
import { GameHost } from '@game/core/GameHost';
import { FOUNDATION_SCENE } from '@game/core/scenes/keys';
import { useSession } from '@features/settings/sessionStore';
import { primaryLang } from '@shared/i18n/language';
import { t } from '@shared/i18n/uiStrings';
import { BigButton } from '@shared/ui/BigButton';
import { HomeIcon } from '@shared/ui/icons';

/**
 * Phase 1: hosts the placeholder Phaser scene to prove the canvas lifecycle and adaptive layout.
 * Becomes the real world map (C5) in Phase 2.
 */
export default function MapPage() {
  const router = useRouter();
  const lang = primaryLang(useSession((s) => s.languageMode));

  return (
    <main className="relative h-[100dvh] w-full select-none">
      <GameHost scene={FOUNDATION_SCENE} />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 pt-[max(12px,var(--safe-top))]">
        <BigButton
          label={t('home', lang)}
          size="target"
          onPress={() => router.push('/')}
          className="pointer-events-auto"
          data-testid="home"
        >
          <HomeIcon />
        </BigButton>
      </div>
      <p className="pointer-events-none absolute inset-x-0 bottom-0 p-3 pb-[max(12px,var(--safe-bottom))] text-center text-xs opacity-60">
        {t('foundationNotice', lang)}
      </p>
    </main>
  );
}
