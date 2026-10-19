'use client';

import '@game/registerScenes';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { AppServices } from '@features/boot/appServices';
import { ChildScreen } from '@features/shell/ChildScreen';
import { useSession } from '@features/settings/sessionStore';
import { say } from '@features/voice/voice';
import { GameHost } from '@game/core/GameHost';
import type { MapSceneData, SceneObjectInfo } from '@game/core/sceneTypes';
import { MAP_SCENE } from '@game/core/scenes/keys';
import { t } from '@shared/i18n/uiStrings';
import { BigButton } from '@shared/ui/BigButton';
import { BookIcon } from '@shared/ui/icons';

/** C5 World map. Only worlds with playable levels are shown: no locks, no teasers. */
export default function MapPage() {
  return (
    <ChildScreen cue={[{ ui: 'screen.map.where' }]} back={{ href: '/profiles/', kind: 'home' }} testId="map">
      {({ services, lang }) => <MapView services={services} lang={lang} />}
    </ChildScreen>
  );
}

function MapView({ services, lang }: { services: AppServices; lang: 'ar' | 'en' }) {
  const router = useRouter();
  const reducedMotion = useSession((s) => s.reducedMotion);
  const [hidden, setHidden] = useState<string[]>();
  const [mirror, setMirror] = useState<SceneObjectInfo[]>([]);

  useEffect(() => {
    void services.storage.settings.get().then((s) => setHidden(s.hiddenWorlds));
  }, [services]);

  const worlds = useMemo(() => (hidden ? services.content.playableWorlds(hidden) : []), [services, hidden]);
  const go = (id: string) => {
    const w = worlds.find((x) => x.id === id);
    if (w) say(services, [{ ref: w.nameAudio }]);
    router.push(`/world/${id}/`);
  };
  const data: MapSceneData = useMemo(
    () => ({
      worlds: worlds.map((w) => ({ id: w.id, asset: w.mapHotspot.asset, x: w.mapHotspot.position.x, y: w.mapHotspot.position.y })),
      assets: services.content.assetTable(),
      reducedMotion,
      onSelect: go,
      onLayout: setMirror,
    }),
    // `go` only depends on worlds/services.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [worlds, services, reducedMotion],
  );

  if (!hidden) return null;
  return (
    <>
      <div className="fixed inset-0 z-0">
        <GameHost scene={MAP_SCENE} data={data} dataKey={`${worlds.map((w) => w.id).join(',')}:${reducedMotion}`} />
      </div>
      {/* Focusable mirror of the canvas hotspots, for keyboards, screen readers and tests (02 §4.3). */}
      <nav aria-label={t('map', lang)} className="pointer-events-none fixed inset-0 z-10">
        {mirror.map((o) => {
          const w = worlds.find((x) => x.id === o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-label={w?.name[lang] ?? o.id}
              data-testid={`world-${o.id}`}
              onClick={() => go(o.id)}
              className="pointer-events-none absolute rounded-full opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100"
              style={{ left: o.rect.x, top: o.rect.y, width: o.rect.width, height: o.rect.height }}
            />
          );
        })}
      </nav>
      <div className="pointer-events-none fixed inset-x-0 top-[max(12px,var(--safe-top))] z-20 flex justify-center gap-3 [&>*]:pointer-events-auto">
        <BigButton label={t('stickers', lang)} size="target" onPress={() => router.push('/stickers/')} data-testid="open-stickers">
          <BookIcon />
        </BigButton>
        <BigButton label={t('avatar', lang)} size="target" onPress={() => router.push('/avatar/')} data-testid="open-avatar">
          <span className="text-3xl" aria-hidden="true">🙂</span>
        </BigButton>
      </div>
    </>
  );
}
