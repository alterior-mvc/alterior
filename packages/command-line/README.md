# @/command-line

Provides a framework for creating command line tools using Alterior. Naturally this is the command line handling library for the Alterior CLI.

# Getting Started

```typescript
// src/main.ts

import PKG = require('../package.json');
let line = new CommandLine()
    .info({
        executable: 'my-tool',
        description: 'An example CLI application',
        copyright: 'Copyright 2023 Me',
        version: PKG.version
    })
    .command('frobulate', cmd => {
        cmd .info({
                description: 'Frobulate the given value',
                argumentUsage: '<value>'
            })
            .run(([ value ]) => {
                console.log(`You have frobulated ${value}!`);
            })
        ;
    })
    .run(() => line.showHelp());
;

line.process();
```