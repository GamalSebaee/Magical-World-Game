'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AvatarFigure } from '@features/avatar/AvatarFigure';
import { normalizeAvatar, type AvatarChoice } from '@features/avatar/options';
import type { AppServices } from '@features/boot/appServices';
import { ChildScreen } from '@features/shell/ChildScreen';
import { useAudioStatus } from '@features/voice/voice';
import { t } from '@shared/i18n/uiStrings';
import { BigButton } from '@shared/ui/BigButton';
import { PlayIcon } from '@shared/ui/icons';
import { Nono } from '@shared/ui/Nono';

/** C4 Welcome: Nono greets; the child decides when to go on (no auto-advance). */
export default function WelcomePage() {
  const router = useRouter();
  return (
    <ChildScreen cue={[{ ui: 'screen.welcome.greeting' }]} back={{ href: '/profiles/', kind: 'back' }} testId="welcome">
      {({ services, profile, lang }) => <Welcome services={services} profileId={profile!.id} lang={lang} onPlay={() => router.push('/map/')} />}
    </ChildScreen>
  );
}

function Welcome({ services, profileId, lang, onPlay }: { services: AppServices; profileId: string; lang: 'ar' | 'en'; onPlay(): void }) {
  const status = useAudioStatus(services.audio);
  const [avatar, setAvatar] = useState<AvatarChoice>();
  useEffect(() => {
    void services.storage.avatars.get(profileId).then((a) => setAvatar(normalizeAvatar(a)));
  }, [services, profileId]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 landscape:flex-row landscape:gap-12">
      <div className="flex items-end gap-4">
        <Nono mood={status?.speaking ? 'talking' : 'idle'} size={150} />
        {avatar && <AvatarFigure avatar={avatar} size={200} />}
      </div>
      <BigButton
        label={t('play', lang)}
        size="hero"
        onPress={() => {
          services.audio.stopVoice();
          onPlay();
        }}
        data-testid="welcome-play"
      >
        <PlayIcon size={72} />
      </BigButton>
    </div>
  );
}
