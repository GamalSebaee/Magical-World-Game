'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AvatarFigure } from '@features/avatar/AvatarFigure';
import { normalizeAvatar } from '@features/avatar/options';
import type { AppServices } from '@features/boot/appServices';
import { ChildScreen } from '@features/shell/ChildScreen';
import { useSession } from '@features/settings/sessionStore';
import { MAX_PROFILES } from '@services/storage/repositories';
import type { AvatarConfig, ChildProfile } from '@services/storage/records';
import { t } from '@shared/i18n/uiStrings';
import { GrownUpIcon, PlusIcon } from '@shared/ui/icons';

/** C2 Child profile selection. */
export default function ProfilesPage() {
  const router = useRouter();
  const setActiveProfile = useSession((s) => s.setActiveProfile);
  return (
    <ChildScreen requireProfile={false} cue={[{ ui: 'screen.profiles.who' }]} testId="profiles">
      {({ services, lang }) => <ProfileList services={services} lang={lang} onPick={(p, hasAvatar) => {
        setActiveProfile(p.id);
        router.push(hasAvatar ? '/welcome/' : '/avatar/?first=1');
      }} />}
    </ChildScreen>
  );
}

function ProfileList({
  services,
  lang,
  onPick,
}: {
  services: AppServices;
  lang: 'ar' | 'en';
  onPick(p: ChildProfile, hasAvatar: boolean): void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Array<{ profile: ChildProfile; avatar?: AvatarConfig }>>();

  useEffect(() => {
    void services.storage.profiles.list().then(async (ps) => {
      if (ps.length === 0) return router.replace('/parent/setup/');
      setRows(await Promise.all(ps.map(async (profile) => ({ profile, avatar: await services.storage.avatars.get(profile.id) }))));
    });
  }, [services, router]);

  if (!rows) return null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <ul className="grid grid-cols-2 gap-5 landscape:grid-cols-4">
        {rows.map(({ profile, avatar }) => {
          const name = profile.displayName ?? (lang === 'en' ? 'Mariam' : 'مريم');
          return (
            <li key={profile.id}>
              <button
                type="button"
                aria-label={name}
                data-testid="profile-card"
                onClick={() => {
                  services.audio.playSfx(services.resolver.sfx('sfx.pop'));
                  onPick(profile, !!avatar);
                }}
                className="flex min-h-[160px] min-w-[140px] flex-col items-center justify-end rounded-[var(--radius-blob)] border-4 border-ink-700 bg-cloud-0 p-2 shadow-[0_6px_0_var(--color-ink-700)]"
              >
                <AvatarFigure avatar={normalizeAvatar(avatar)} size={120} />
                <span className="text-lg font-semibold" dir="auto">
                  {name}
                </span>
              </button>
            </li>
          );
        })}
        {rows.length < MAX_PROFILES && (
          <li>
            <button
              type="button"
              aria-label={t('addChild', lang)}
              onClick={() => router.push('/profiles/new/')}
              data-testid="add-profile"
              className="flex min-h-[160px] min-w-[140px] flex-col items-center justify-center gap-2 rounded-[var(--radius-blob)] border-4 border-dashed border-ink-700 bg-cloud-0/70"
            >
              <PlusIcon />
              <GrownUpIcon size={28} />
            </button>
          </li>
        )}
      </ul>
      <button
        type="button"
        aria-label={t('grownUps', lang)}
        onClick={() => router.push('/parent/')}
        data-testid="grown-ups"
        data-adult="true"
        className="fixed bottom-[max(16px,var(--safe-bottom))] end-4 inline-flex min-h-[56px] min-w-[56px] items-center justify-center rounded-full border-2 border-ink-700 bg-cloud-0"
      >
        <GrownUpIcon />
      </button>
    </div>
  );
}
