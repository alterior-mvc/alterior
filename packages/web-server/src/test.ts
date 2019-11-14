//require('wtfnode').init();

import "reflect-metadata";
import { suite } from 'razmin';

suite()
    .withTimeout(10 * 1000)
    .include(['**/*.test.js'])
    .run()
;