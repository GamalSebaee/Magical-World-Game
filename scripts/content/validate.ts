/**
 * Validates all content (05 §3). Usage: tsx scripts/content/validate.ts [--release]
 * Exit code 1 on any error. Warnings (planned/unreviewed items) become errors with --release.
 */
import { rawContent } from '../../src/content/bundle';
import { validateContent } from '../../src/services/content/validateContent';
import { contentFilesOnDisk, publicFileExists } from './lib';

const release = process.argv.includes('--release');
const report = validateContent(rawContent, {
  release,
  fileExists: publicFileExists,
  filesOnDisk: contentFilesOnDisk(),
});

const quiet = process.argv.includes('--quiet');
if (report.warnings.length) {
  console.warn(`content: ${report.warnings.length} warning(s) (become errors with --release)`);
  if (!quiet) for (const w of report.warnings) console.warn(`  ⚠ ${w}`);
}
if (report.errors.length) {
  console.error(`content: ${report.errors.length} error(s)`);
  for (const e of report.errors) console.error(`  ✖ ${e}`);
  process.exit(1);
}
console.log(`content: OK${release ? ' (release)' : ''}`);
