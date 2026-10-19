'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChildScreen } from '@features/shell/ChildScreen';
import { resolveSay } from '@features/voice/voice';
import type { ActiveSessionSnapshot } from '@services/storage/records';
import { t } from '@shared/i18n/uiStrings';
import { BigButton } from '@shared/ui/BigButton';
import { PlayIcon, RetryIcon } from '@shared/ui/icons';

export function worldHref(s: import('@features/boot/appServices').AppServices, levelId: string) {
  const r = s.content.level(levelId);
  return r.ok ? `/world/${r.value.worldId}/` : '/map/';
}

/** C7 Level intro: the story moment, spoken; Start (or Continue when there is a saved session). */
export function LevelIntro({ levelId }: { levelId: string }) {
  const router = useRouter();
  return (
    <ChildScreen back={{ href: (s) => worldHref(s, levelId), kind: 'back' }} testId="level-intro">
      {({ services, profile, lang }) => {
        const r = services.content.level(levelId);
        if (!r.ok) return <p className="m-auto text-xl">{t('levelNotReady', lang)}</p>;
        return <Intro services={services} profileId={profile!.id} level={r.value} lang={lang} router={router} />;
      }}
    </ChildScreen>
  );
}

function Intro({
  services,
  profileId,
  level,
  lang,
  router,
}: {
  services: import('@features/boot/appServices').AppServices;
  profileId: string;
  level: import('@content/schema').LevelDefinition;
  lang: 'ar' | 'en';
  router: ReturnType<typeof useRouter>;
}) {
  const [resume, setResume] = useState<ActiveSessionSnapshot | null>();
  const art = services.content.assetTable()[level.story.illustration]?.url;

  useEffect(() => {
    void services.storage.activeSession
      .resumable(profileId, level.id, level.contentVersion)
      .then((s) => setResume(s ?? null))
      .catch(() => setResume(null));
  }, [services, profileId, level]);

  useEffect(() => {
    if (!services.audio.unlocked || resume === undefined) return;
    const items = resume ? [{ ui: 'screen.intro.continue' }] : [{ ref: level.story.intro }];
    const h = services.audio.playVoice(resolveSay(services, items));
    return () => h.stop();
  }, [services, level, resume]);

  const start = (fresh: boolean) => {
    services.audio.stopVoice();
    router.push(`/level/${level.id}/play/${fresh ? '' : '?resume=1'}`);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 landscape:flex-row">
      {art && <img src={art} alt="" className="max-h-[45dvh] w-full max-w-lg rounded-[2rem] border-4 border-ink-700 object-cover landscape:max-h-[70dvh] landscape:w-1/2" />}
      <div className="flex items-center gap-4">
        {resume ? (
          <>
            <BigButton label={t('continueGame', lang)} size="hero" onPress={() => start(false)} data-testid="intro-continue">
              <PlayIcon size={72} />
            </BigButton>
            <BigButton label={t('startOver', lang)} size="target" onPress={() => start(true)} data-testid="intro-restart">
              <RetryIcon />
            </BigButton>
          </>
        ) : (
          <BigButton label={t('start', lang)} size="hero" onPress={() => start(true)} data-testid="intro-start" disabled={resume === undefined}>
            <PlayIcon size={72} />
          </BigButton>
        )}
      </div>
    </div>
  );
}
