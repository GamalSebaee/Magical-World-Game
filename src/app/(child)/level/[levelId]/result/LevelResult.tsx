'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { AppServices } from '@features/boot/appServices';
import { ChildScreen } from '@features/shell/ChildScreen';
import { useSession } from '@features/settings/sessionStore';
import { say } from '@features/voice/voice';
import type { LevelDefinition } from '@content/schema';
import { t } from '@shared/i18n/uiStrings';
import { BigButton } from '@shared/ui/BigButton';
import { MapIcon, RetryIcon } from '@shared/ui/icons';
import { Nono } from '@shared/ui/Nono';

/**
 * C10 Level result. The same celebration whatever was skipped; never "you missed". The sticker
 * was granted (idempotently) by the runner; this screen only shows it, so refreshing grants
 * nothing. A refresh shows the "you have this sticker" variant.
 */
export function LevelResult({ levelId }: { levelId: string }) {
  return (
    <ChildScreen testId="result">
      {({ services, lang }) => {
        const r = services.content.level(levelId);
        if (!r.ok) return <p className="m-auto text-xl">{t('levelNotReady', lang)}</p>;
        return <Result services={services} level={r.value} lang={lang} />;
      }}
    </ChildScreen>
  );
}

function Result({ services, level, lang }: { services: AppServices; level: LevelDefinition; lang: 'ar' | 'en' }) {
  const router = useRouter();
  const last = useSession((s) => s.lastResult);
  const reduced = useSession((s) => s.reducedMotion);
  const isNew = last?.levelId === level.id && last.stickerNew;
  const sticker = services.content.assetTable()[level.sticker.asset]?.url;
  const suggested = level.suggestedNext.map((id) => services.content.level(id)).find((x) => x.ok);

  useEffect(() => {
    services.audio.playSfx(services.resolver.sfx('sfx.celebrate'));
    const h = say(services, [{ ref: level.story.outro }, { ui: isNew ? 'screen.result.sticker' : 'screen.result.have_it' }]);
    return () => h.stop();
  }, [services, level, isNew]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 landscape:flex-row landscape:gap-12">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {!reduced && <span className="animate-ring absolute inset-0 rounded-full border-8 border-sun-400" aria-hidden="true" />}
          {sticker && <img src={sticker} alt={level.sticker.name.caption[lang]} className="relative h-48 w-48" data-testid="result-sticker" />}
        </div>
        <p className="text-xl font-bold" data-testid="result-sticker-state" data-new={String(isNew)}>
          {isNew ? t('newSticker', lang) : t('haveSticker', lang)}
        </p>
        <Nono mood="celebrating" size={100} />
      </div>
      <div className="flex gap-4">
        <BigButton label={t('replay', lang)} size="primary" onPress={() => router.replace(`/level/${level.id}/`)} data-testid="result-replay">
          <RetryIcon />
        </BigButton>
        {suggested?.ok && (
          <BigButton label={suggested.value.title[lang]} size="primary" onPress={() => router.replace(`/level/${suggested.value.id}/`)} data-testid="result-next">
            <img src={services.content.assetTable()[suggested.value.story.illustration]?.url} alt="" className="h-14 w-14 rounded-full object-cover" />
          </BigButton>
        )}
        <BigButton label={t('map', lang)} size="primary" onPress={() => router.replace('/map/')} data-testid="result-map">
          <MapIcon />
        </BigButton>
      </div>
    </div>
  );
}
