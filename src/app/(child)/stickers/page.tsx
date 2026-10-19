'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AppServices } from '@features/boot/appServices';
import { ChildScreen } from '@features/shell/ChildScreen';
import { say } from '@features/voice/voice';
import { t } from '@shared/i18n/uiStrings';
import { BigButton } from '@shared/ui/BigButton';
import { PlayIcon } from '@shared/ui/icons';

/**
 * C11 Sticker book. Earned stickers in colour; unearned levels show their picture softly (where a
 * sticker comes from), with no counts, rarity or "missing" language.
 */
export default function StickersPage() {
  return (
    <ChildScreen cue={[{ ui: 'screen.stickers.intro' }]} back={{ href: '/map/', kind: 'map' }} testId="stickers">
      {({ services, profile, lang }) => <Book services={services} profileId={profile!.id} lang={lang} />}
    </ChildScreen>
  );
}

function Book({ services, profileId, lang }: { services: AppServices; profileId: string; lang: 'ar' | 'en' }) {
  const router = useRouter();
  const [earned, setEarned] = useState<Set<string>>();
  const [open, setOpen] = useState<string>();
  useEffect(() => {
    void services.storage.rewards.stickersFor(profileId).then((s) => setEarned(new Set(s.map((x) => x.levelId))));
  }, [services, profileId]);
  if (!earned) return null;
  const assets = services.content.assetTable();
  const worlds = services.content.playableWorlds();
  const opened = open ? services.content.level(open) : undefined;

  return (
    <div className="flex flex-1 flex-col items-center gap-6 pt-4">
      {earned.size === 0 && (
        <p className="text-lg" data-testid="stickers-empty">
          {lang === 'en' ? 'Play a level to find your first sticker!' : 'العب مستوى علشان تلاقي أول ملصق!'}
        </p>
      )}
      {worlds.map((w) => (
        <section key={w.id} className="w-full max-w-2xl rounded-[2rem] bg-cloud-0 p-4 shadow">
          <h2 className="mb-3 text-xl font-semibold">{w.name[lang]}</h2>
          <ul className="flex flex-wrap gap-4">
            {services.content.levelsOf(w.id).map((l) => {
              const has = earned.has(l.id);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    aria-label={has ? l.sticker.name.caption[lang] : l.title[lang]}
                    data-testid={`sticker-${l.id}`}
                    data-earned={String(has)}
                    onClick={() => {
                      setOpen(l.id);
                      services.audio.playSfx(services.resolver.sfx('sfx.page'));
                      say(services, [{ ref: has ? l.sticker.name : l.story.intro }]);
                    }}
                    className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-dashed border-ink-700/30"
                  >
                    {has ? (
                      <img src={assets[l.sticker.asset]?.url} alt="" className="h-24 w-24" />
                    ) : (
                      <img src={assets[l.story.illustration]?.url} alt="" className="h-20 w-20 rounded-full object-cover opacity-40 grayscale" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {opened?.ok && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink-700/40 p-4" onClick={() => setOpen(undefined)} role="dialog" aria-modal="true">
          <div className="flex flex-col items-center gap-4 rounded-[2rem] bg-cloud-0 p-6" onClick={(e) => e.stopPropagation()}>
            <img
              src={earned.has(opened.value.id) ? assets[opened.value.sticker.asset]?.url : assets[opened.value.story.illustration]?.url}
              alt=""
              className="h-56 w-56 rounded-full object-cover"
            />
            <BigButton label={t('start', lang)} size="primary" onPress={() => router.push(`/level/${opened.value.id}/`)} data-testid="sticker-play">
              <PlayIcon />
            </BigButton>
          </div>
        </div>
      )}
    </div>
  );
}
