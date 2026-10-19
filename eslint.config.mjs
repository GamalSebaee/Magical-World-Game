import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Import boundaries from 02-architecture §3. Each entry: files in `from` may not import `banned`.
 * Enforced with no-restricted-imports so no extra plugin is needed.
 */
const layer = (patterns, message) => ({ group: patterns, message });

const CONTENT_JSON = layer(
  ['@content/*.json', '@content/**/*.json', '**/content/**/*.json'],
  'Read content through services/content (02 §3 rule 5).',
);

// Flat config: a later entry for the same rule replaces an earlier one, so every directory gets
// exactly one `no-restricted-imports` entry with all of its patterns.
const boundaries = [
  {
    files: ['src/shared/**'],
    patterns: [
      layer(['@app/*', '@features/*', '@game/*', '@services/*', '@content/*'], 'shared/ imports nothing from the project.'),
    ],
  },
  {
    files: ['src/services/**'],
    patterns: [layer(['@app/*', '@features/*', '@game/*'], 'services/ may only import shared/ and content/.')],
  },
  {
    files: ['src/game/**'],
    patterns: [layer(['@app/*', '@features/*'], 'game/ may not import app/ or features/.'), CONTENT_JSON],
  },
  {
    files: ['src/features/**'],
    patterns: [layer(['@app/*'], 'features/ may not import app/.'), CONTENT_JSON],
  },
  { files: ['src/app/**'], patterns: [CONTENT_JSON] },
];

export default tseslint.config(
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts', 'public/sw.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
    },
  },
  ...boundaries.map(({ files, patterns }) => ({
    files,
    ignores: ['**/*.test.*'],
    rules: { 'no-restricted-imports': ['error', { patterns }] },
  })),
  {
    // Only `*/scene.ts` adapters and scene classes talk to Phaser; controllers stay framework-free.
    files: ['src/**'],
    ignores: ['src/game/core/phaserHost.ts', 'src/game/core/scenes/**', 'src/game/activities/*/scene.ts'],
    // A different rule name from the boundary rule above, so both apply.
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [{ name: 'phaser', message: 'Import Phaser only in scene adapters (02 §3 rule 2).', allowTypeImports: true }] },
      ],
    },
  },
  {
    // Child safety (09 §6): no external links or new windows in child screens.
    files: ['src/app/(child)/**', 'src/features/**/child/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="href"][value.value=/^(https?:)?\\/\\//]',
          message: 'No external links in the child area.',
        },
        { selector: 'CallExpression[callee.object.name="window"][callee.property.name="open"]', message: 'No new windows in the child area.' },
        { selector: 'JSXAttribute[name.name="target"][value.value="_blank"]', message: 'No new windows in the child area.' },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**', 'scripts/**', '*.config.*'],
    rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-console': 'off' },
  },
);
