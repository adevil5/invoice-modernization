/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@domain/(.*)\\.js$': '<rootDir>/src/domain/$1',
    '^@application/(.*)\\.js$': '<rootDir>/src/application/$1',
    '^@infrastructure/(.*)\\.js$': '<rootDir>/src/infrastructure/$1',
    '^@interfaces/(.*)\\.js$': '<rootDir>/src/interfaces/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ES2022',
          moduleResolution: 'bundler',
        },
      },
    ],
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@aws-sdk|@smithy|@aws-crypto|uuid)/)'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};