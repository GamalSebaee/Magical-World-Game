'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChildScreen } from '@features/shell/ChildScreen';
import { useSession } from '@features/settings/sessionStore';
import { say } from '@features/voice/voice';
import { CheckIcon } from '@shared/ui/icons';

/** C6 World overview: every authored level is open from the start (R-03). */
export function WorldView({ worldId }: { worldId: string }) {
  const router = useRouter();
  return (
    <ChildScreen back={{ href: '/map/', kind: 'map' }} testId="world">
      {({ services, profile, lang }) => {
        const w = services.content.world(worldId);
        if (!w.ok) return <p className="m-auto text-xl">{lang === 'en' ? 'This world is not here.' : 'العالم ده مش موجود.'}</p>;
        return <Levels services={services} profileId={profile!.id} world={w.value} lang={lang} onOpen={(id) => router.push(`/level/${id}/`)} />;
      }}
    </ChildScreen>
  );
}

function Levels({
  services,
  profileId,
  world,
  lang,
  onOpen,
}: {
  services: import('@features/boot/appServices').AppServices;
  profileId: string;
  world: import('@content/schema').WorldDefinition;
  lang: 'ar' | 'en';
  onOpen(id: string): void;
}) {
  const [done, setDone] = useState<Set<string>>();
  const [stickers, setStickers] = useState<Set<string>>();
  const mode = useSession((s) => s.languageMode);
  useEffect(() => {
    void services.storage.progress.completionsFor(profileId).then((cs) => setDone(new Set(cs.map((c) => c.levelId))));
    void services.storage.rewards.stickersFor(profileId).then((ss) => setStickers(new Set(ss.map((s) => s.levelId))));
  }, [services, profileId]);
  useEffect(() => {
    if (services.audio.unlocked) {
      const h = say(services, [{ ref: world.welcome }]);
      return () => h.stop();
    }
  }, [services, world, mode]);

  const levels = services.content.levelsOf(world.id);
  const assets = services.content.assetTable();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold opacity-80">{world.name[lang]}</h1>
      <ol className="flex flex-col gap-6 landscape:flex-row">
        {levels.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              aria-label={l.title[lang]}
              data-testid={`level-${l.id}`}
              onClick={() => onOpen(l.id)}
              className="relative flex h-[150px] w-[150px] items-center justify-center overflow-hidden rounded-full border-4 border-ink-700 bg-cloud-0 shadow-[0_6px_0_var(--color-ink-700)]"
            >
              <img src={assets[l.story.illustration]?.url} alt="" className="h-full w-full object-cover" />
              {stickers?.has(l.id) && (
                <img src={assets[l.sticker.asset]?.url} alt="" data-testid="level-sticker-badge" className="absolute -bottom-1 end-0 h-14 w-14" />
              )}
              {done?.has(l.id) && !stickers?.has(l.id) && (
                <span className="absolute bottom-2 end-2 rounded-full bg-cloud-0 p-1">
                  <CheckIcon />
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
