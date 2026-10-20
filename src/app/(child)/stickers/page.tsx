'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AppServices } from '@features/boot/appServices';
import { ChildScreen } from '@features/shell/ChildScreen';
import { say } from '@features/voice/voice';
import { t } from '@shared/i18n/uiStrings';
import { BigButton } from '@shared/ui/BigButton';
import { BackIcon, NextIcon, PlayIcon } from '@shared/ui/icons';

/**
 * C11 Sticker book. One page per world, turned with big arrows, so it fits any screen. Earned
 * stickers in colour; unearned levels show their picture softly (where a sticker comes from), with
 * no counts, rarity or "missing" language.
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
  const [page, setPage] = useState(0);
  useEffect(() => {
    void services.storage.rewards.stickersFor(profileId).then((s) => setEarned(new Set(s.map((x) => x.levelId))));
  }, [services, profileId]);
  if (!earned) return null;
  const assets = services.content.assetTable();
  const worlds = services.content.playableWorlds();
  const opened = open ? services.content.level(open) : undefined;
  const w = worlds[Math.min(page, worlds.length - 1)];
  const turn = (to: number) => {
    setPage(to);
    services.audio.playSfx(services.resolver.sfx('sfx.page'));
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      {earned.size === 0 && (
        <p className="text-lg" data-testid="stickers-empty">
          {lang === 'en' ? 'Play a level to find your first sticker!' : 'العب مستوى علشان تلاقي أول ملصق!'}
        </p>
      )}
      {w && (
        <div className="flex w-full max-w-3xl items-center justify-center gap-3">
          <BigButton label={t('back', lang)} size="target" onPress={() => turn(page - 1)} disabled={page === 0} data-testid="stickers-prev" className={page === 0 ? 'invisible' : ''}>
            <BackIcon />
          </BigButton>
          <section className="min-w-0 flex-1 rounded-[2rem] bg-cloud-0 p-4 shadow" data-testid={`stickers-page-${w.id}`}>
            <h2 className="mb-3 text-center text-xl font-semibold">{w.name[lang]}</h2>
            <ul className="grid grid-cols-2 justify-items-center gap-4 landscape:grid-cols-4">
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
                      className="flex h-[clamp(88px,min(30vw,26dvh),112px)] w-[clamp(88px,min(30vw,26dvh),112px)] items-center justify-center rounded-full border-4 border-dashed border-ink-700/30"
                    >
                      {has ? (
                        <img src={assets[l.sticker.asset]?.url} alt="" className="h-[86%] w-[86%]" />
                      ) : (
                        <img src={assets[l.story.illustration]?.url} alt="" className="h-[72%] w-[72%] rounded-full object-cover opacity-40 grayscale" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
          <BigButton
            label={t('next', lang)}
            size="target"
            onPress={() => turn(page + 1)}
            disabled={page >= worlds.length - 1}
            data-testid="stickers-next"
            className={page >= worlds.length - 1 ? 'invisible' : ''}
          >
            <NextIcon />
          </BigButton>
        </div>
      )}
      <ol className="flex gap-2" aria-hidden="true">
        {worlds.map((x, i) => (
          <li key={x.id} className={`h-3 w-3 rounded-full border-2 border-ink-700 ${i === page ? 'bg-sun-400' : 'bg-cloud-0'}`} />
        ))}
      </ol>
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
