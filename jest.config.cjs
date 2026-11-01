// Engine/rating/solver sources use explicit `.ts` imports so the same files
// run unchanged in Jest (Babel), Metro and Deno.
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/packages', '<rootDir>/tools'],
  testMatch: ['**/test/**/*.test.ts'],
  transform: {
    '\.ts$': [
      'babel-jest',
      {
        configFile: false,
        babelrc: false,
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },
};
