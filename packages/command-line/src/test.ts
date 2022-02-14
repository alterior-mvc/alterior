import 'reflect-metadata';
import 'zone.js';
import 'source-map-support';

import { suite } from 'razmin';

suite()
    .include([
        '**/*.test.js'
    ])
    .run()
;