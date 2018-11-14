import { Injectable, Inject } from "@alterior/di";
import * as Queue from "bull";
import { QUEUE_OPTIONS, TaskJob, TaskAnnotation } from "./tasks";
import { Optional } from "injection-js";
import { TranscodeTask } from "../../../test";
import { InvalidOperationError } from "@alterior/common";

interface Constructor<T> {
    new (...args) : T;
}

interface TaskProxyOptions {
    /**
     * Specify what behavior promises returned by 
     * queued functions should have. The default is 
     * 'queued' which resolves when the task is successfully
     * added to the queue. If you want to know when the task 
     * has finished processing or obtain the return value,
     * use 'finished' instead. 
     * 
     * The meaning of the values are:
     * 
     * - 'queued': Promise completes when the item is 
     *   successfully queued with the task coordinator 
     *   (usually Redis). Value of resolved promise is 
     *   always `undefined`. If an error occurs while 
     *   queuing the job, the promise rejects with that 
     *   error. This is the default because it is assumed
     *   that the caller does not intend to wait for the 
     *   background task to complete inline using await.
     * 
     * - 'finished': Promise completes when the item is 
     *   successfully processed and has completed.
     *   Value of resolved promises is the value returned
     *   by the task (running remotely, so the value has 
     *   been serialized and deserialized). If an error occurs
     *   while queuing the job, or if an error is thrown while
     *   the job is executing, that error (after serialization)
     *   is used to reject the promise.
     */
    await? : 'error' | 'queued' | 'finished'
}

@Injectable()
export class TaskRunner {
    constructor(
        @Inject(QUEUE_OPTIONS)
        @Optional()
        private queueOptions : Queue.QueueOptions
    ) {
        this._queue = new Queue('tasks', queueOptions || {
            redis: {
                port: 6379,
                host: '127.0.0.1',
                db: 6
            }
        });
    }

    private _queue : Queue.Queue<TaskJob>;
    
    /**
     * Enqueue a low-level task job description and directly interact with the resulting queue job.
     * Consider using task proxies (via get()) instead. 
     * @param task 
     */
    async enqueue(task : TaskJob): Promise<Queue.Job<TaskJob>> {
        return await this._queue.add(task);
    }

    /**
     * Retrieve a proxy for the given task class. Calling the methods of the 
     * returned proxy will be added to the task queue to be executed by any 
     * subscribed workers. The meaning of promise resolution on called methods 
     * is configurable using the `await` option.
     * 
     * Limitations: 
     * 
     * - Calling synchronous methods on the proxy is not supported and will 
     *   result in a Promise instead of the expected return value of the 
     *   original (remote) synchronous method. Avoid this pattern: all methods 
     *   on Task classes should be async.
     * 
     * @param ctor 
     * @param options 
     */
    get<T extends Object>(ctor : Constructor<T>, options? : TaskProxyOptions) : T {

        let instance = Object.create(ctor.prototype);
        let taskAnnotation = TaskAnnotation.getForClass(ctor);

        options = Object.assign({
            await: 'queued'
        }, options || {});

        if (!taskAnnotation) 
            throw new Error(`No @Task() annotation on class ${ctor.name}`);

        return <T> new Proxy<T>(instance, {
            get: (target, prop) => {
                if (typeof prop === 'string' && typeof instance[prop] === 'function') {
                    if (prop.startsWith('_'))
                        throw new InvalidOperationError(`Cannot call potentially private method (${prop} starts with _)`);

                    return async (...args) => {
                        let job = await this.enqueue({
                            id: taskAnnotation.id || ctor.name, 
                            method: prop.toString(), 
                            args
                        });
                        
                        if (options.await === 'finished') 
                            return await job.finished();
                    };
                } 
                
                // Unhandled path, do simple lookup
                return target[prop];
            }
        });
    }
}
