# @alterior/tasks
[![Version](https://img.shields.io/npm/v/@alterior/tasks.svg)](https://www.npmjs.com/package/@alterior/tasks)

A framework for enqueuing and processing jobs from Redis queues in Typescript. Build background task runners with this. 

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

export class MyTaskHost extends Worker {
    constructor(
        private logger : Logger,
        private taskRunner : TaskRunner
    ) {

    }
    get name() { return '@myorg/mypackage:MyTask'; }
    
    async transcodeToFormat({ videoId : string, format : string }) {
        this.logger.info('Transcoding to format...');
        run(`ffmpeg /storage/${video}.mp4`);
    }

    async transcode({ videoId : string }) {
        this.logger.info('Queuing transcoding tasks...');

        this.taskRunner.worker()

        await this.enqueue('transcodeToFormat', { videoId: 'abcdef', format: '1080p' });
        await this.enqueue('transcodeToFormat', { videoId: 'abcdef', format: '720p' });
    }
}
```

However, it is more scalable and type-safe to specify a task per class:

```typescript

@Task()
export class TranscodeToFormatTask extends TaskRunner {
    execute() {
        run(`ffmpeg /storage/${video}.mp4`);
    }
}

@Task()
export class TranscodeTask extends TaskRunner {
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
