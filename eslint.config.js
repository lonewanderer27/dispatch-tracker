import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'
import { readdirSync } from 'node:fs'

// One folder per feature under src/features/. Read at lint time so a new feature is covered at once.
const featureNames = readdirSync(new URL('./src/features', import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const noParentImports = {
  regex: '^\\.\\./',
  message: "Import with the '@/' alias, not '../'.",
}
const noAppImports = {
  regex: '^@/app(/|$)',
  message: 'src/app/ composes the features. A feature or src/shared/ must not import it.',
}

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
    'supabase/functions/**/*.ts',
    'src/types/database.types.ts',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Layer boundaries: app -> features -> shared -> types. See docs/architecture/0008-Feature-Folders.md.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [noParentImports] }] },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}', 'src/types/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noParentImports,
            noAppImports,
            {
              regex: '^@/features(/|$)',
              message: 'src/shared/ and src/types/ must not import a feature.',
            },
          ],
        },
      ],
    },
  },
  ...featureNames.map((name) => ({
    files: [`src/features/${name}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noParentImports,
            noAppImports,
            {
              regex: `^@/features/(?!${name}(/|$))`,
              message: `A feature imports only itself and src/shared/. Move code that ${name} shares with another feature to src/shared/.`,
            },
          ],
        },
      ],
    },
  })),
  {
    files: ['*.config.{js,ts}', 'e2e/**/*.ts', 'tests/**/*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
])
