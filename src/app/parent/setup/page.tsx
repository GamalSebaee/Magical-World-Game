'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '@features/boot/AppProvider';
import { ParentSettings } from '@features/parental/ParentSettings';
import { useSession } from '@features/settings/sessionStore';
import { requestPersistence } from '@services/storage/openStorage';
import { primaryLang } from '@shared/i18n/language';

/**
 * First run (03 P1 `?setup=1`): written for the grown-up. Privacy summary, microphone choice,
 * language, then the first child's profile. No gate yet: there is nothing to protect.
 */
export default function SetupPage() {
  const { boot } = useApp();
  const router = useRouter();
  const lang = primaryLang(useSession((s) => s.languageMode));
  const setActiveProfile = useSession((s) => s.setActiveProfile);
  const [name, setName] = useState('');
  const [age, setAge] = useState<3 | 4 | 5 | 6>(4);
  const [busy, setBusy] = useState(false);
  const services = boot.phase === 'ready' ? boot.services : undefined;
  const en = lang === 'en';

  // Setup is only for an empty device; afterwards profiles are added behind the gate.
  useEffect(() => {
    if (!services) return;
    void services.storage.profiles.list().then((ps) => {
      if (ps.length > 0) router.replace('/profiles/');
    });
  }, [services, router]);

  if (!services) return <main className="child-screen" aria-busy="true" />;

  const create = async () => {
    setBusy(true);
    const p = await services.storage.profiles.create({ displayName: name, ageBand: age });
    void requestPersistence();
    setActiveProfile(p.id);
    router.replace('/avatar/?first=1');
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-6 p-5 pb-[max(24px,var(--safe-bottom))] pt-[max(20px,var(--safe-top))]" dir={en ? 'ltr' : 'rtl'}>
      <h1 className="text-3xl font-bold">{en ? 'Welcome, grown-up!' : 'أهلاً بالكبار!'}</h1>
      <section className="rounded-2xl bg-cloud-0 p-4 leading-relaxed shadow">
        <h2 className="mb-2 text-xl font-semibold">{en ? 'Your child’s privacy' : 'خصوصية طفلك'}</h2>
        <ul className="list-disc ps-5">
          <li>{en ? 'Everything stays on this device. No account, no ads, no links out of the game.' : 'كل حاجة بتفضل على الجهاز ده. مفيش حساب، ولا إعلانات، ولا روابط برّه اللعبة.'}</li>
          <li>{en ? 'We store a first name (optional), age, avatar choices and progress.' : 'بنحفظ اسم أول (اختياري)، والسن، وشكل الشخصية، والتقدّم.'}</li>
          <li>{en ? 'You can delete everything at any time from the grown-ups area.' : 'تقدر تمسح كل حاجة في أي وقت من صفحة الكبار.'}</li>
        </ul>
      </section>

      <ParentSettings services={services} lang={lang} />

      <section className="flex flex-col gap-3 rounded-2xl bg-cloud-0 p-4 shadow">
        <h2 className="text-xl font-semibold">{en ? 'Your child' : 'طفلك'}</h2>
        <label className="flex flex-col gap-1">
          <span>{en ? 'First name (optional, shown as a caption only)' : 'الاسم الأول (اختياري، بيظهر مكتوب بس)'}</span>
          <input
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            className="min-h-[48px] rounded-xl border-2 border-ink-700/40 px-3 text-lg"
            data-testid="child-name"
            autoComplete="off"
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend>{en ? 'Age (tunes hint timing)' : 'السن (لضبط توقيت المساعدة)'}</legend>
          <div className="flex gap-2">
            {([3, 4, 5, 6] as const).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={age === a}
                onClick={() => setAge(a)}
                className={`min-h-[48px] min-w-[56px] rounded-xl border-2 border-ink-700 text-lg ${age === a ? 'bg-ink-700 text-cloud-0' : 'bg-cloud-0'}`}
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          disabled={busy}
          onClick={create}
          data-testid="setup-done"
          className="min-h-[56px] rounded-2xl border-2 border-ink-700 bg-leaf-500 text-xl font-bold disabled:opacity-50"
        >
          {en ? 'Start playing' : 'يلا نبدأ اللعب'}
        </button>
      </section>
    </main>
  );
}
