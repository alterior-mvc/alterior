import "reflect-metadata";
import { suite } from "razmin";

suite()
    .include([
        '**/client.test.js',
        '**/headers.test.js',
        '**/module.test.js',
        '**/params.test.js',
        '**/request.test.js',
        '**/response.test.js',
        '**/xhr.test.js',
        '**/xsrf.test.js',
    ])
    .run()
;