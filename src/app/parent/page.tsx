'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@features/boot/AppProvider';
import { ParentGate, useParentUnlocked } from '@features/parental/ParentGate';
import { ParentSettings } from '@features/parental/ParentSettings';
import { useSession } from '@features/settings/sessionStore';
import { primaryLang } from '@shared/i18n/language';

/**
 * Grown-ups area (slice version): gate, then the settings the slice needs and data deletion.
 * The full dashboard, progress and export screens are Phase 6 (P2–P9).
 */
export default function ParentPage() {
  const { boot } = useApp();
  const router = useRouter();
  const lang = primaryLang(useSession((s) => s.languageMode));
  const lockParent = useSession((s) => s.lockParent);
  const unlocked = useParentUnlocked();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const services = boot.phase === 'ready' ? boot.services : undefined;
  const en = lang === 'en';
  const leave = () => {
    lockParent();
    router.push('/profiles/');
  };

  if (!services) return <main className="child-screen" aria-busy="true" />;
  if (!unlocked) {
    return (
      <main className="child-screen flex items-center justify-center">
        <ParentGate lang={lang} onPass={() => {}} onCancel={() => router.push('/profiles/')} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-6 p-5 pt-[max(20px,var(--safe-top))]" dir={en ? 'ltr' : 'rtl'} data-testid="parent-area">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{en ? 'Grown-ups' : 'الكبار'}</h1>
        <button type="button" onClick={leave} className="min-h-[48px] rounded-xl border-2 border-ink-700 bg-cloud-0 px-4" data-testid="back-to-child">
          {en ? 'Back to child mode' : 'رجوع لوضع الطفل'}
        </button>
      </div>
      <ParentSettings services={services} lang={lang} />
      <section className="flex flex-col gap-3 rounded-2xl border-2 border-berry-500/50 bg-cloud-0 p-4">
        <h2 className="text-lg font-semibold">{en ? 'Delete all data on this device' : 'مسح كل البيانات من الجهاز ده'}</h2>
        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-[48px] rounded-xl border-2 border-berry-500 px-4">
            {en ? 'Delete everything…' : 'امسح كل حاجة…'}
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p>{en ? 'This removes every child’s profile, progress and stickers. It cannot be undone.' : 'ده هيمسح كل ملفات الأطفال وتقدّمهم وملصقاتهم. ومش هينفع نرجّعها.'}</p>
            <button
              type="button"
              data-testid="delete-all"
              onClick={async () => {
                await services.storage.deleteAll();
                useSession.getState().setActiveProfile(undefined);
                lockParent();
                window.location.assign('/');
              }}
              className="min-h-[48px] rounded-xl bg-berry-500 px-4 font-semibold text-cloud-0"
            >
              {en ? 'Yes, delete everything' : 'أيوه، امسح كل حاجة'}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-[48px] rounded-xl border-2 border-ink-700 px-4">
              {en ? 'Keep my data' : 'خلّي البيانات'}
            </button>
          </div>
        )}
      </section>
      <p className="text-sm opacity-70">{en ? 'More parent tools (progress, export) are coming in a later phase.' : 'أدوات أكتر للكبار (التقدّم والتصدير) جاية في مرحلة جاية.'}</p>
    </main>
  );
}
