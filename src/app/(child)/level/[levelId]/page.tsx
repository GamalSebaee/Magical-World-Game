import { LevelIntro } from './LevelIntro';

export default async function LevelIntroPage({ params }: { params: Promise<{ levelId: string }> }) {
  const { levelId } = await params;
  return <LevelIntro levelId={levelId} />;
}
