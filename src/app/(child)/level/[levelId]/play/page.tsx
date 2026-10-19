import { LevelPlay } from './LevelPlay';

export default async function LevelPlayPage({ params }: { params: Promise<{ levelId: string }> }) {
  const { levelId } = await params;
  return <LevelPlay levelId={levelId} />;
}
