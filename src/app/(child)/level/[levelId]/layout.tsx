import type { ReactNode } from 'react';
import { rawContent } from '@content/bundle';

export const dynamicParams = false;

/** Only levels authored in this build get pages; nothing links to the others. */
export function generateStaticParams() {
  return Object.keys(rawContent.levels).map((levelId) => ({ levelId }));
}

export default function LevelLayout({ children }: { children: ReactNode }) {
  return children;
}
