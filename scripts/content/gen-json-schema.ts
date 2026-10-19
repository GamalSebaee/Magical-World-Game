/** Writes JSON Schema files generated from the Zod schemas, for editor autocomplete (05 §1). */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { AssetManifest, AudioManifest, LevelDefinition, WorldDefinition } from '../../src/content/schema';
import { CONTENT_DIR } from './lib';

const out = path.join(CONTENT_DIR, 'schema/json');
fs.mkdirSync(out, { recursive: true });
const targets = {
  'level.schema.json': LevelDefinition,
  'world.schema.json': WorldDefinition,
  'audio-manifest.schema.json': AudioManifest,
  'assets-manifest.schema.json': AssetManifest,
};
for (const [file, schema] of Object.entries(targets)) {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  fs.writeFileSync(path.join(out, file), JSON.stringify(json, null, 2) + '\n');
}
console.log(`json schema: wrote ${Object.keys(targets).length} file(s) to src/content/schema/json`);
