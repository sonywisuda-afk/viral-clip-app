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
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/lib/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
};
