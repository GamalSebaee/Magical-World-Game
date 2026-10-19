'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AvatarFigure } from '@features/avatar/AvatarFigure';
import { CATEGORY_LINE, CATEGORY_ORDER, OPTIONS, normalizeAvatar, randomAvatar, type AvatarCategory, type AvatarChoice } from '@features/avatar/options';
import { ChildScreen, type ScreenCtx } from '@features/shell/ChildScreen';
import { say } from '@features/voice/voice';
import { t } from '@shared/i18n/uiStrings';
import { BigButton } from '@shared/ui/BigButton';
import { CheckIcon } from '@shared/ui/icons';

/** C3 Character creator. Draft lives in memory (survives rotation); saved only on the tick. */
export default function AvatarPage() {
  return (
    <Suspense>
      <ChildScreen cue={[{ ui: 'screen.avatar.choose' }]} testId="avatar-screen">
        {(ctx) => <Creator ctx={ctx} />}
      </ChildScreen>
    </Suspense>
  );
}

const CATEGORY_ICON: Record<AvatarCategory, string> = {
  hairStyle: '💇',
  hairColor: '🎨',
  skinTone: '🖐',
  top: '👕',
  bottom: '👗',
  shoes: '👟',
  accessory: '🎀',
};

function Creator({ ctx }: { ctx: ScreenCtx }) {
  const { services, profile, lang } = ctx;
  const router = useRouter();
  const first = useSearchParams().get('first') === '1';
  const [draft, setDraft] = useState<AvatarChoice>();
  const [cat, setCat] = useState<AvatarCategory>('hairStyle');

  useEffect(() => {
    if (!profile) return;
    void services.storage.avatars.get(profile.id).then((a) => setDraft(normalizeAvatar(a)));
  }, [services, profile]);

  if (!draft || !profile) return null;
  const choose = (c: AvatarCategory, id: string) => {
    setDraft({ ...draft, [c]: id });
    services.audio.playSfx(services.resolver.sfx('sfx.pop'));
  };
  const save = async () => {
    await services.storage.avatars.save({ profileId: profile.id, ...draft });
    router.push(first ? '/welcome/' : '/map/');
  };
  const cancel = () => router.push(first ? '/welcome/' : '/map/');

  const actions = (
    <div className="flex justify-center gap-4">
      <BigButton label={t('cancel', lang)} onPress={cancel} data-testid="avatar-cancel">
        <span className="text-3xl" aria-hidden="true">✖</span>
      </BigButton>
      <BigButton label={t('random', lang)} onPress={() => setDraft(randomAvatar())} data-testid="avatar-random">
        <span className="text-3xl" aria-hidden="true">🎲</span>
      </BigButton>
      <BigButton label={t('save', lang)} onPress={save} className="bg-leaf-500" data-testid="avatar-save">
        <CheckIcon size={44} />
      </BigButton>
    </div>
  );

  // Portrait: preview, tabs, swatches, actions stacked. Landscape: preview + actions | tabs + swatches,
  // so nothing critical falls below a short screen (03 C3).
  return (
    <div className="avatar-grid flex-1">
      <div className="flex items-center justify-center [grid-area:preview]">
        <div className="animate-bob">
          <AvatarFigure avatar={draft} title={profile.displayName ?? 'Mariam'} className="h-[min(38dvh,260px)] w-auto landscape:h-[min(52dvh,260px)]" />
        </div>
      </div>
      <div className="flex flex-col gap-3 [grid-area:controls]">
        <div role="tablist" className="flex flex-wrap justify-center gap-2">
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              role="tab"
              type="button"
              aria-selected={cat === c}
              aria-label={c}
              onClick={() => {
                setCat(c);
                const line = CATEGORY_LINE[c];
                if (line) say(services, [{ ui: line }]);
              }}
              className={`flex min-h-[64px] min-w-[64px] items-center justify-center rounded-2xl border-4 text-3xl ${cat === c ? 'border-ocean-500 bg-sky-100' : 'border-ink-700/30 bg-cloud-0'}`}
            >
              <span aria-hidden="true">{CATEGORY_ICON[c]}</span>
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label={cat} className="flex flex-wrap justify-center gap-3" data-testid="swatches">
          {OPTIONS[cat].map((o) => {
            const selected = draft[cat] === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={o.label[lang]}
                onClick={() => choose(cat, o.id)}
                className={`relative flex min-h-[72px] min-w-[72px] items-center justify-center overflow-hidden rounded-2xl border-4 ${selected ? 'border-ink-700' : 'border-ink-700/20'}`}
                style={o.color ? { background: o.color } : undefined}
              >
                {!o.color && <AvatarFigure avatar={{ ...draft, [cat]: o.id }} size={66} />}
                {selected && (
                  <span className="absolute end-1 top-1 rounded-full bg-cloud-0 p-0.5">
                    <CheckIcon size={16} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="[grid-area:actions]">{actions}</div>
    </div>
  );
}
