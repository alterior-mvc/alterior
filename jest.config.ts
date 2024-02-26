import { Config } from 'jest';

import * as path from 'path';

/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default <any><Config>{
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  preset: 'ts-jest',
  roots: [
    "./src/"
  ],
  setupFiles: [
    path.join(__dirname, 'jest.setup.ts')
  ],
  testMatch: [ "**/*.test.ts" ],
  watchman: false,
};
