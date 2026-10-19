'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '@features/boot/AppProvider';
import type { AppServices } from '@features/boot/appServices';
import { useSession } from '@features/settings/sessionStore';
import { useAudioStatus, useScreenCue } from '@features/voice/voice';
import type { SayItem } from '@game/core/engine/types';
import type { ChildProfile } from '@services/storage/records';
import { primaryLang, type Lang } from '@shared/i18n/language';
import { t } from '@shared/i18n/uiStrings';
import { BigButton } from '@shared/ui/BigButton';
import { BackIcon, EarIcon, HomeIcon, MapIcon } from '@shared/ui/icons';
import { Nono } from '@shared/ui/Nono';

export interface ScreenCtx {
  services: AppServices;
  profile?: ChildProfile;
  lang: Lang;
  replayCue(): void;
}

/**
 * Common chrome for child screens (03 §0): waits for boot, guards the active profile, plays the
 * screen's spoken cue, shows an always-available ear button and one way back, and captions
 * placeholder audio. No screen built on this is a dead end.
 */
export function ChildScreen({
  cue,
  back,
  requireProfile = true,
  children,
  className = '',
  testId,
}: {
  cue?: SayItem[];
  back?: { href: string | ((services: AppServices) => string); kind: 'home' | 'back' | 'map' };
  requireProfile?: boolean;
  children: (ctx: ScreenCtx) => ReactNode;
  className?: string;
  testId?: string;
}) {
  const router = useRouter();
  const { services, profile } = useGuardedProfile(requireProfile);
  const lang = primaryLang(useSession((s) => s.languageMode));
  const replayCue = useScreenCue(services, cue);

  if (!services || (requireProfile && !profile)) {
    return (
      <main className="child-screen flex items-center justify-center" aria-busy="true">
        <Nono mood="waiting" size={110} />
      </main>
    );
  }

  const BackGlyph = back?.kind === 'map' ? MapIcon : back?.kind === 'back' ? BackIcon : HomeIcon;
  return (
    <main className={`child-screen relative flex flex-col ${className}`} data-testid={testId}>
      <header className="relative z-20 flex items-start justify-between gap-3">
        {back ? (
          <BigButton
            label={t(back.kind === 'map' ? 'map' : back.kind === 'back' ? 'back' : 'home', lang)}
            size="target"
            onPress={() => router.push(typeof back.href === 'string' ? back.href : back.href(services))}
            data-testid="back"
          >
            <BackGlyph />
          </BigButton>
        ) : (
          <span />
        )}
        {cue && <EarButton services={services} onPress={replayCue} lang={lang} />}
      </header>
      {children({ services, profile, lang, replayCue })}
      <CaptionBubble services={services} />
    </main>
  );
}

/**
 * Waits for boot and resolves the active child profile; sends the child to profile choice when
 * there is none (or it was deleted). Used by every child screen.
 */
export function useGuardedProfile(requireProfile = true): { services?: AppServices; profile?: ChildProfile } {
  const { boot } = useApp();
  const router = useRouter();
  const services = boot.phase === 'ready' ? boot.services : undefined;
  const profileId = useSession((s) => s.activeProfileId);
  const [profile, setProfile] = useState<ChildProfile | undefined>();

  useEffect(() => {
    if (boot.phase === 'error') router.replace('/');
  }, [boot.phase, router]);

  useEffect(() => {
    if (!services || !requireProfile) return;
    if (!profileId) {
      router.replace('/profiles/');
      return;
    }
    let live = true;
    void services.storage.profiles.get(profileId).then((p) => {
      if (!live) return;
      if (p) setProfile(p);
      else router.replace('/profiles/');
    });
    return () => {
      live = false;
    };
  }, [services, profileId, requireProfile, router]);

  return { services, profile: requireProfile ? profile : undefined };
}

/** Replays the current spoken cue. Pulses when audio is blocked so a tap can unlock it. */
export function EarButton({ services, onPress, lang }: { services: AppServices; onPress(): void; lang: Lang }) {
  const status = useAudioStatus(services.audio);
  return (
    <BigButton
      label={t('listenAgain', lang)}
      size="target"
      className={status?.blocked && !status.unlocked ? 'animate-attention' : ''}
      onPress={async () => {
        if (!services.audio.unlocked) await services.audio.unlock();
        onPress();
      }}
      data-testid="ear"
    >
      <EarIcon />
    </BigButton>
  );
}

/**
 * Shows what is being said while the audio is a placeholder (an Arabic tone stand-in, or robotic
 * English), so adults can follow along. Hidden for approved audio.
 */
export function CaptionBubble({ services, position = 'bottom' }: { services: AppServices; position?: 'top' | 'bottom' }) {
  const status = useAudioStatus(services.audio);
  const show = !!status?.caption && status.placeholder && (status.speaking || status.blocked);
  return (
    <p
      aria-live="polite"
      data-testid="caption"
      className={`pointer-events-none fixed inset-x-4 ${position === 'top' ? 'top-[calc(max(12px,var(--safe-top))+76px)]' : 'bottom-[max(16px,var(--safe-bottom))]'} z-40 mx-auto max-w-md rounded-2xl border-2 border-ink-700 bg-cloud-0/95 px-4 py-2 text-center text-lg shadow transition-opacity ${show ? 'opacity-100' : 'opacity-0'}`}
    >
      <span dir="auto">{status?.caption}</span>
    </p>
  );
}
