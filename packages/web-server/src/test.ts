import "reflect-metadata";
import { suite } from 'razmin';
import * as requireGlob from 'require-glob';

suite(async () => await requireGlob([
    "./**/*.test.js"
]), {
    testExecutionSettings: {
        timeout: 10 * 1000
    }
});