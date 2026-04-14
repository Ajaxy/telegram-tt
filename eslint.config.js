import eslint from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import stylisticJs from '@stylistic/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import { importX } from 'eslint-plugin-import-x';
import jestPlugin from 'eslint-plugin-jest';
import noNullPlugin from 'eslint-plugin-no-null';
import reactHooksStaticDeps from 'eslint-plugin-react-hooks-static-deps';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import ttMultitabPlugin from 'eslint-plugin-tt-multitab';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylistic,
  eslintReact.configs['recommended-typescript'],
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  ttMultitabPlugin.configs.recommended,
  stylisticJs.configs.customize({
    semi: true,
    arrowParens: 'always',
    braceStyle: '1tbs',
    quoteProps: 'as-needed',
  }),
  globalIgnores([
    'src/lib/rlottie/**',
    'src/lib/video-preview/polyfill',
    'src/lib/fasttextweb/**',
    'src/lib/gramjs/tl/',
    'src/lib/lovely-chart/**',
    'src/lib/music-metadata-browser',
    'src/lib/secret-sauce/',
    'src/lib/fastBlur.js',
    'src/types/language.d.ts',
    'dist/',
    'public/',
    'deploy/update_version.js',
    'tauri/target/',
  ]),
  {
    name: 'teact-config',
    files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'],
    settings: {
      react: {
        version: '19',
      },
    },
    rules: {
      'no-null/no-null': 'error',
      'no-console': 'error',
      'no-template-curly-in-string': 'error',
      'object-shorthand': 'error',
      curly: ['error', 'multi-line'],
      eqeqeq: ['error', 'always'],
      'no-implicit-coercion': [
        'error',
        {
          boolean: true,
          disallowTemplateShorthand: true,
        },
      ],
      'no-prototype-builtins': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@stylistic/comma-dangle': ['error', {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'always-multiline',
        enums: 'always-multiline',
        tuples: 'always-multiline',
        generics: 'ignore',
      }],
      '@stylistic/multiline-ternary': 'off',
      '@stylistic/operator-linebreak': 'off',
      '@stylistic/max-len': ['error', {
        code: 120,
        ignoreComments: true,
        ignorePattern: '\\sd=".+"', // Ignore lines with "d" attribute
      }],
      '@stylistic/indent': ['error', 2, {
        SwitchCase: 1,
        flatTernaryExpressions: false,
      }],
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Side effect imports
            ['^\\u0000'],
            // Lib and global imports
            [
              '^react',
              '^@?\\w',
              'dist(/.*|$)',
              '^(\\.+/)+(lib/(teact|gramjs))(/.*|$)',
              '^(\\.+/)+global$',
            ],
            // Type imports
            [
              '^(\\.+/)+.+\\u0000$',
              '^(\\.+/|\\w+/)+(types)(/.*|$)',
              '^(\\.+/|\\w+/)+(types)\\u0000',
            ],
            // Config, utils, helpers
            [
              '^(\\.+/)+config',
              '^(\\.+/)+(lib)(?!/(gramjs|teact))(/.*|$)',
              '^(\\.+/)+global/.+',
              '^(\\.+/)+(util)(/.*|$)',
              '^\\.\\.(?!/?$)',
              '^\\.\\./?$',
              '^\\./(?=.*/)(?!/?$)',
              '^\\.(?!/?$)',
              '^\\./?$',
            ],
            // Hooks
            [
              '.+(/hooks/)(.*|$)',
            ],
            // Components
            [
              '/[A-Z](([a-z]+[A-Z]?)*)',
            ],
            // Styles and CSS modules
            [
              '^.+\\.s?css$',
            ],
            // Assets: images, stickers, etc
            [
              '^(\\.+/)+(assets)(/.*|$)',
            ],
          ],
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/prefer-for-of': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'none',
          caughtErrors: 'none',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'unused-imports/no-unused-imports': 'error',
      'import-x/namespace': ['error', { allowComputed: true }],
      'import-x/no-named-as-default-member': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks-static-deps/exhaustive-deps': [
        'error',
        {
          // eslint-disable-next-line @stylistic/max-len
          additionalHooks: '(useSyncEffect|useAsync|useDebouncedCallback|useThrottledCallback|useEffectWithPrevDeps|useLayoutEffectWithPrevDeps|useDerivedState|useDerivedSignal|useThrottledResolver|useDebouncedResolver|useThrottleForHeavyAnimation)$',
          staticHooks: {
            getActions: true,
            useFlag: [false, true, true],
            useForceUpdate: true,
            useReducer: [false, true],
            useLastCallback: true,
          },
        },
      ],
      '@eslint-react/exhaustive-deps': 'off',
      '@eslint-react/set-state-in-effect': 'off',
      '@eslint-react/unsupported-syntax': 'off',
      '@eslint-react/no-clone-element': 'off',
      '@eslint-react/component-hook-factories': 'off',
      '@eslint-react/no-use-context': 'off',
      '@eslint-react/no-context-provider': 'off',
      '@eslint-react/no-array-index-key': 'off',
      '@eslint-react/web-api/no-leaked-timeout': 'off',
      '@eslint-react/no-missing-key': 'off',
      '@eslint-react/no-nested-component-definitions': 'off',
      '@eslint-react/no-unused-props': 'off',
      '@eslint-react/dom-no-unsafe-iframe-sandbox': 'off',
      '@eslint-react/dom/no-unsafe-iframe-sandbox': 'off',
      '@eslint-react/no-leaked-conditional-rendering': 'error',
    },
    plugins: {
      'no-null': noNullPlugin,
      'simple-import-sort': simpleImportSortPlugin,
      'unused-imports': unusedImports,
      'react-hooks-static-deps': reactHooksStaticDeps,
      jest: jestPlugin,
      'tt-multitab': ttMultitabPlugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: jestPlugin.environments.globals.globals,
    },
  },
);
