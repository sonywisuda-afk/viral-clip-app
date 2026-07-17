// Milestone 4 (AI Explainability) - apps/web has no test framework/component-
// testing convention today (confirmed: no Jest/RTL/Playwright anywhere in
// this app before this file). Deliberately scoped to ONLY lib/**/*.spec.ts
// (pure, no-JSX helper functions) rather than deciding React Testing Library
// vs. Playwright vs. something else for the whole app - that's a bigger,
// separate precedent-setting decision this milestone doesn't need to make.
// A dedicated tsconfig.jest.json overrides the Next.js tsconfig's
// `module: "esnext"`/`moduleResolution: "bundler"` (needed for Next's own
// bundler, incompatible with ts-jest's default CommonJS transform) without
// touching tsconfig.json itself.
//
// Recent Exports / Persistent Export History - this milestone's deferred
// decision (RTL vs. Playwright vs. something else) is made here: React
// Testing Library, the standard fit for Jest + Next.js + React 18 already in
// this stack. Global testEnvironment stays 'node' (existing lib/*.spec.ts
// files are unaffected) - the new components/**/*.spec.tsx file opts into
// jsdom itself via a per-file `/** @jest-environment jsdom */` docblock
// pragma, Jest's supported per-file override, rather than flipping the
// environment for the whole app.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/lib/**/*.spec.ts', '<rootDir>/components/**/*.spec.tsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  // Mirrors tsconfig.json's own "@/*" -> "./*" path alias (only needed now
  // that components/**/*.spec.tsx exist - lib/*.spec.ts never used it).
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
