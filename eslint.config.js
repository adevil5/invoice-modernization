import js from '@eslint/js';
import typescript from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Ignore files
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', '**/*.mjs', '**/*.js', '!jest.config.js'],
  },
  
  // Base JavaScript configuration
  js.configs.recommended,
  
  // TypeScript configuration
  ...typescript.configs.recommended,
  ...typescript.configs.recommendedTypeChecked,
  ...typescript.configs.strict,
  
  // Prettier must come last to disable conflicting rules
  prettierConfig,
  
  // Project-specific configuration
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },
  
  // Custom rules for TypeScript files
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: {
            regex: '^I[A-Z]',
            match: false,
          },
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'UPPER_CASE'],
        },
      ],
      'no-console': 'error',
      'prefer-const': 'error',
      'curly': ['error', 'all'],
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
    },
  },
  
  // Test file overrides
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  
  // Global ignores
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      '*.config.js',
      '*.config.ts',
      'jest.config.js',
      '*.generated.ts',
      '*.d.ts',
      'infrastructure/terraform/',
      '.env*',
      '.vscode/',
      '.idea/',
      '.DS_Store',
      '*.log',
    ],
  },
];