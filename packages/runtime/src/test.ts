import { suite } from 'razmin';
import * as requireGlob from 'require-glob';

suite(async () => await requireGlob(["./**/*.test.js"]));