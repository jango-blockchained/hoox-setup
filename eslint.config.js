import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '*.bak',
      '**/.wrangler/',
      '*.md',
    ],
  },
  js.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    files: [
      '**/*.js',
      '**/*.jsx',
      '**/*.mjs',
      '**/*.cjs',
      '**/*.ts',
      '**/*.tsx',
      '**/*.mts',
      '**/*.cts',
    ],
    languageOptions: {
      globals: {
        ...globals.es2021,
        ...globals.node,
        ...globals.jest,
        Bun: 'readonly',
      },
    },
    rules: {
      'prettier/prettier': 'warn',
      'no-console': 'off',
      'no-empty': 'warn',
      'no-control-regex': 'warn',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: null,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },
  {
    files: [
      'packages/hoox-cli/src/housekeeping.ts',
      'packages/hoox-cli/src/wafCommands.ts',
      'pages/dashboard/src/lib/settings/loader.ts',
      'pages/dashboard/src/lib/api.ts',
      'pages/dashboard/src/components/dashboard/settings-form.tsx',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'never',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSAnyKeyword',
          message:
            'Avoid `as any` in critical modules. Use runtime narrowing or concrete interfaces.',
        },
      ],
    },
  },
  {
    files: [
      'pages/dashboard/src/components/dashboard/setup-checklist.tsx',
      'pages/dashboard/src/app/api/settings/route.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
  },
];
