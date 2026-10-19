import { rawContent } from '@content/bundle';
import { WorldView } from './WorldView';

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(rawContent.worlds).map((worldId) => ({ worldId }));
}

export default async function WorldPage({ params }: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await params;
  return <WorldView worldId={worldId} />;
}
