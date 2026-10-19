'use client';

import { useEffect, useState } from 'react';
import type { AppServices } from '@features/boot/appServices';
import { applyReducedMotion } from '@features/boot/AppProvider';
import { useSession } from '@features/settings/sessionStore';
import type { Settings } from '@services/storage/records';
import type { LanguageMode } from '@shared/i18n/language';

export const MIC_POLICY_VERSION = '2026-10-20';

const L = {
  en: {
    language: 'Language',
    ar: 'العربية (Arabic)',
    english: 'English',
    mixed: 'Mixed (Arabic first, English words)',
    mic: 'Microphone for speaking practice',
    micOff: 'Off: Nono says the word and the child says it out loud. Nothing is recorded.',
    micOn: 'On, this device only: the child’s voice is recorded so they can hear themselves. Recordings stay in memory, are never uploaded, and are deleted when the activity ends.',
    micNote: 'There is no pronunciation scoring. Speech recognition is not part of this version.',
    motion: 'Reduced motion',
    system: 'Follow device',
    on: 'On',
    off: 'Off',
    sound: 'Sound',
    soundOn: 'Sound on',
    soundOff: 'All sound off',
  },
  ar: {
    language: 'اللغة',
    ar: 'العربية',
    english: 'الإنجليزية (English)',
    mixed: 'مزيج (عربي أولاً مع كلمات إنجليزية)',
    mic: 'الميكروفون لتدريب النطق',
    micOff: 'مقفول: نونو بيقول الكلمة والطفل يقولها بصوت عالي. مفيش تسجيل.',
    micOn: 'مفتوح على الجهاز ده بس: بيتسجّل صوت الطفل علشان يسمع نفسه. التسجيل بيفضل في الذاكرة، ومش بيترفع على أي مكان، وبيتمسح لما النشاط يخلص.',
    micNote: 'مفيش تقييم للنطق. والتعرّف على الكلام مش موجود في النسخة دي.',
    motion: 'تقليل الحركة',
    system: 'زي إعداد الجهاز',
    on: 'شغّال',
    off: 'مقفول',
    sound: 'الصوت',
    soundOn: 'الصوت شغّال',
    soundOff: 'كل الأصوات مقفولة',
  },
};

function Choice<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: Array<[T, string]>;
  onChange(v: T): void;
}) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={name}>
      {options.map(([v, label]) => (
        <label key={v} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border-2 border-ink-700/20 p-3 has-[:checked]:border-ocean-500 has-[:checked]:bg-sky-100">
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="mt-1 h-5 w-5 shrink-0" data-testid={`${name}-${v}`} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * The parent settings that the slice needs (P4 voice/consent, P5 language, P8 motion and sound).
 * Every change is saved immediately and applied without a reload.
 */
export function ParentSettings({ services, lang }: { services: AppServices; lang: 'ar' | 'en' }) {
  const t = L[lang];
  const [s, setS] = useState<Settings>();
  const setLanguage = useSession((x) => x.setLanguage);

  useEffect(() => {
    void services.storage.settings.get().then(setS);
  }, [services]);

  // Optimistic: the control reflects the choice immediately; storage catches up.
  const patch = async (p: Partial<Settings>) => {
    setS((cur) => (cur ? { ...cur, ...p } : cur));
    const next = await services.storage.settings.patch(p);
    setS(next);
    return next;
  };

  if (!s) return null;
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-semibold">{t.language}</legend>
        <Choice<LanguageMode>
          name="language"
          value={s.languageMode}
          options={[
            ['ar', t.ar],
            ['en', t.english],
            ['mixed', t.mixed],
          ]}
          onChange={async (m) => {
            setLanguage(m);
            await patch({ languageMode: m, digitStyle: useSession.getState().digitStyle });
          }}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-semibold">{t.mic}</legend>
        <Choice<'off' | 'on'>
          name="mic"
          value={s.micEnabled ? 'on' : 'off'}
          options={[
            ['off', t.micOff],
            ['on', t.micOn],
          ]}
          onChange={async (v) => {
            const on = v === 'on';
            await patch({ micEnabled: on });
            await services.storage.consents.record('microphone', on, MIC_POLICY_VERSION);
          }}
        />
        <p className="text-sm opacity-80">{t.micNote}</p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-semibold">{t.motion}</legend>
        <Choice<Settings['reducedMotion']>
          name="motion"
          value={s.reducedMotion}
          options={[
            ['system', t.system],
            ['on', t.on],
            ['off', t.off],
          ]}
          onChange={async (v) => {
            await patch({ reducedMotion: v });
            applyReducedMotion(v);
          }}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-semibold">{t.sound}</legend>
        <Choice<'on' | 'off'>
          name="sound"
          value={s.muted.all ? 'off' : 'on'}
          options={[
            ['on', t.soundOn],
            ['off', t.soundOff],
          ]}
          onChange={async (v) => {
            const muted = v === 'off';
            await patch({ muted: { ...s.muted, all: muted } });
            services.audio.setMuted('all', muted);
          }}
        />
      </fieldset>
    </div>
  );
}
