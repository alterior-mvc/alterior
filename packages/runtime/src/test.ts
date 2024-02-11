import "reflect-metadata";
import "source-map-support/register";
import { suite } from 'razmin';

suite()
    .withTimeout(10 * 1000)
    .include(['**/*.test.js'])
    .run()
;