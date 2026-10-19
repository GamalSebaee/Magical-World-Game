import { LevelResult } from './LevelResult';

export default async function LevelResultPage({ params }: { params: Promise<{ levelId: string }> }) {
  const { levelId } = await params;
  return <LevelResult levelId={levelId} />;
}
