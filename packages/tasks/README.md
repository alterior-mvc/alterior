# @alterior/tasks
[![Version](https://img.shields.io/npm/v/@alterior/tasks.svg)](https://www.npmjs.com/package/@alterior/tasks)

Provides a type-safe task queue framework coordinated via Redis.

## Getting started

Install the Alterior runtime, the DI library, and the tasks module:

```
npm install reflect-metadata
npm install @alterior/runtime @alterior/di @alterior/tasks
```

## A minimal example

First, build a task worker:

```typescript
import { Worker } from '@alterior/tasks';
import { Logger } from '@alterior/logger';

@Task()
export class HelloPrinter extends Worker {
    name = '@myorg/mypackage:Hello';
    
    async sayHello(thing : string) {
        console.log(`Hello ${thing}!`);
    }
}
```

However, it is more scalable and type-safe to specify a task per class:

```typescript

@Task()
export class TranscodeToFormatTask extends Worker {
    execute() {
        run(`ffmpeg /storage/${video}.mp4`);
    }
}

@Task()
export class TranscodeTask extends Worker {
    execute() {
        await TranscodeToFormatTask.enqueue({ videoId: 'abcdef', format: '1080p' });
    }
}

@Module({
    tasks: [ MyTask ]
})
export class MyModule {
}

Application.bootstrap(MyModule, [ TaskRunner ]);
```
