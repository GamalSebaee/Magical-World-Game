'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@features/boot/AppProvider';
import { ParentGate, useParentUnlocked } from '@features/parental/ParentGate';
import { useSession } from '@features/settings/sessionStore';
import { primaryLang } from '@shared/i18n/language';

/** C2a Create profile (parent-gated). Collects only an optional first name and an age band. */
export default function NewProfilePage() {
  const { boot } = useApp();
  const router = useRouter();
  const lang = primaryLang(useSession((s) => s.languageMode));
  const unlocked = useParentUnlocked();
  const setActiveProfile = useSession((s) => s.setActiveProfile);
  const [name, setName] = useState('');
  const [age, setAge] = useState<3 | 4 | 5 | 6>(4);
  const [error, setError] = useState<string>();
  const services = boot.phase === 'ready' ? boot.services : undefined;
  const en = lang === 'en';

  if (!services) return <main className="child-screen" aria-busy="true" />;
  if (!unlocked) {
    return (
      <main className="child-screen flex items-center justify-center">
        <ParentGate lang={lang} onPass={() => {}} onCancel={() => router.push('/profiles/')} />
      </main>
    );
  }
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 p-5" dir={en ? 'ltr' : 'rtl'}>
      <h1 className="text-2xl font-bold">{en ? 'Add a child' : 'إضافة طفل'}</h1>
      <label className="flex flex-col gap-1">
        <span>{en ? 'First name (optional)' : 'الاسم الأول (اختياري)'}</span>
        <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} className="min-h-[48px] rounded-xl border-2 border-ink-700/40 px-3 text-lg" autoComplete="off" />
      </label>
      <div className="flex gap-2" role="group" aria-label={en ? 'Age' : 'السن'}>
        {([3, 4, 5, 6] as const).map((a) => (
          <button key={a} type="button" aria-pressed={age === a} onClick={() => setAge(a)} className={`min-h-[48px] min-w-[56px] rounded-xl border-2 border-ink-700 ${age === a ? 'bg-ink-700 text-cloud-0' : 'bg-cloud-0'}`}>
            {a}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        className="min-h-[56px] rounded-2xl border-2 border-ink-700 bg-leaf-500 text-xl font-bold"
        onClick={async () => {
          try {
            const p = await services.storage.profiles.create({ displayName: name, ageBand: age });
            setActiveProfile(p.id);
            router.replace('/avatar/?first=1');
          } catch {
            setError(en ? 'This device already has the maximum of 4 children.' : 'الجهاز ده عليه ٤ أطفال، وده الحد الأقصى.');
          }
        }}
      >
        {en ? 'Save' : 'حفظ'}
      </button>
      <button type="button" onClick={() => router.push('/profiles/')} className="min-h-[48px] rounded-xl border-2 border-ink-700">
        {en ? 'Cancel' : 'إلغاء'}
      </button>
    </main>
  );
}
