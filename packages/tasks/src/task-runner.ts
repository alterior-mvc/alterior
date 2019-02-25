import { Injectable, Inject } from "@alterior/di";
import * as BullQueue from "bull";
import { QUEUE_OPTIONS, TaskJob, TaskAnnotation, TaskClientOptionsRef, TaskClientOptions } from "./tasks";
import { Optional } from "injection-js";
import { InvalidOperationError, ArgumentError } from "@alterior/common";

export interface WorkerJobData {
    method : string;
    arguments : any[];
}

export abstract class Worker {
    constructor(
        private taskRunner : TaskRunner
    ) {
        this.construct();
    }

    abstract get name() : string;

    protected get currentJob() : QueueJob<WorkerJobData> {
        return Zone.current.get('workerStateJob');
    }

    private construct() {
        this.taskRunner.client.process(`worker-${this.name}`, async (job : QueueJob<WorkerJobData>) => {

            let zone = Zone.current.fork({
                name: `worker-state-${this.name}`,
                properties: {
                    workerStateJob: job
                }
            });

            let result = await zone.run(async () => await this[job.data.method](...job.data.arguments));

            // WORKAROUND:
            // @types/bull declares the callback function return value as Promise<void>, but bull supports 
            // returning data from the job by returning a value, thus the real return value declaration should 
            // be Promise<any>.
            // https://github.com/OptimalBits/bull/pull/209/files

            return <any> result;
        });

        this.initialize();
    }

    initialize() {
    }
}

export type RemoteService<T> = {
    [P in keyof T]: 
        T[P] extends (...args: any[]) => any ? 
            // methods
            (ReturnType<T[P]> extends Promise<any> ?
                T[P] // dont modify methods that are already promises
                : (...args : Parameters<T[P]>) => Promise<ReturnType<T[P]>>
            )
            // fields
            : never
    ;
}

export type RemoteWorker<T> = {
    [P in keyof T]: 
        T[P] extends (...args: any[]) => any ? 
            // methods
            (...args : Parameters<T[P]>) => Promise<QueueJob<WorkerJobData>>
            
            // fields
            : never
    ;
};

export type QueueOptions = BullQueue.QueueOptions;
export type JobOptions = BullQueue.JobOptions;
export type QueueJob<T> = BullQueue.Job<T>;
export type Queue<T> = BullQueue.Queue<T>;

interface Constructor<T> {
    new (...args) : T;
}

export type PromiseWrap<T> = T extends PromiseLike<any> ? T : Promise<T>;

export class TaskWorkerProxy {
    private static create<T extends Worker>(taskRunner : TaskRunner, target : T, handler : (key, ...args) => any): any {
        return <RemoteWorker<T>> new Proxy({}, {
            get(t, key : string, receiver) {
                if (typeof target[key] !== 'function')
                    return undefined;

                return (...args) => handler(key, ...args);
            }
        })
    }

    static createAsync<T extends Worker>(taskRunner : TaskRunner, target : T): RemoteWorker<T> {
        return this.create(taskRunner, target, 
            (key, ...args) => taskRunner.client.enqueue<WorkerJobData>(
                target.name, 
                `Job:${target.constructor.name}`,
                {
                    method: key,
                    arguments: args
                }
            )
        );
    }
    
    static createSync<T extends Worker>(taskRunner : TaskRunner, target : T): RemoteService<T> {
        return this.create(taskRunner, target, 
            async (key, ...args) => (await taskRunner.client.enqueue<WorkerJobData>(
                target.name, 
                `Job:${target.constructor.name}`,
                {
                    method: key,
                    arguments: args
                }
            )).finished
        );
    }
}

@Injectable()
export class TaskQueueClient {
    constructor(
        @Inject(QUEUE_OPTIONS)
        @Optional()
        private taskClientOptionsRef : TaskClientOptionsRef
    ) {
    }

    /**
     * Get the task client options. See 
     */
    get options(): TaskClientOptions {
        return this.taskClientOptionsRef.options || {};
    }

    get queueOptions() {
        let queueOptions = Object.assign({}, this.options.queueOptions);

        if (!queueOptions.redis) {
            queueOptions.redis = {
                port: 6379,
                host: '127.0.0.1',
                db: 6
            }
        }

        return queueOptions;
    }

    /**
     * If processors are not enabled, `.process()` will be a no-op.
     * See `TaskClientOptionsRef` for how to configure.
     */
    get enableProcessors() {
        if (this.options.enableProcessors === undefined)
            return true;
           
        return this.options.enableProcessors;
    }

    /**
     * Enqueue a new task. To handle the task on the worker side, register for it with `.process()`
     */
    async enqueue<DataT>(queueName : string, jobName : string, data : DataT, opts? : JobOptions): Promise<QueueJob<DataT>> {
        let queue = new BullQueue(queueName, this.queueOptions);
        let job = await queue.add(jobName, data, opts);
        return job;
    }

    /**
     * Register to process queued tasks from the given queue. The given callback is called with 
     * each job to be processed. To enqueue a task see `.enqueue()`
     */
    process<T>(queueName : string, callback : (job : QueueJob<T>) => Promise<void>, concurrency : number = 1) {
        if (!this.enableProcessors)
            return;
        
        let queue = new BullQueue(queueName, this.queueOptions);
        queue.process(callback);
    }

    queues : Map<string,Queue<any>> = new Map<string,Queue<any>>();

    /**
     * Construct a new Queue, specifying a name and options. 
     */
    defineQueue<T = any>(queueName : string, opts : QueueOptions) : Queue<T> {
        let queue = this.queues.get(queueName);
        if (queue)
            throw new InvalidOperationError(`Queue named '${queueName}' is already defined.`);

        queue = new BullQueue(queueName, opts);

        if (!this.enableProcessors)
            (queue as any).process = () => {};

        this.queues.set(queueName, queue);

        return queue;
    }

    getQueue<T = any>(queueName : string) : Queue<T> {
        let queue = this.queues.get(queueName);
        if (!queue)
            throw new ArgumentError(`Queue named '${queueName}' is already defined.`);

        return queue;
    }
}

interface TaskWorkerEntry<T extends Worker = any> {
    type : Constructor<T>;
    local : T;
    remoteWorker : RemoteWorker<T>;
    remoteService : RemoteService<T>;
}

@Injectable()
export class TaskRunner {
    constructor(
        private _client : TaskQueueClient
    ) {
        this.init();
    }

    get client() {
        return this._client;
    }

    init() {
    }

    private _entries : { [name : string] : TaskWorkerEntry } = {};

    register(worker : Worker) {
        if (this._entries[worker.name])
            throw new Error(`Another worker is already registered with name '${worker.name}'`);
        
        this._entries[worker.name] = {
            type: <any> worker.constructor,
            local: worker,
            remoteService: TaskWorkerProxy.createSync(this, worker),
            remoteWorker: TaskWorkerProxy.createAsync(this, worker)
        };
    }

    get all() : TaskWorkerEntry[] {
        return Object.values(this._entries);
    }

    get<T extends Worker>(cls : Constructor<T>): TaskWorkerEntry<T> {
        let entry = this.all.find(x => x.constructor === cls);

        if (!entry)
            throw new Error(`Worker class ${cls.name} is not registered. Use TaskRunner.register(${cls.name})`);
        
        return <TaskWorkerEntry<T>> entry;
    }

    getByName(name : string) {
        return this._entries[name];
    }

    /**
     * Acquire a Remote for the given service where any calls to the remote will 
     * resolve to a QueueJob which can be further interacted with. Promise will 
     * resolve once the item has been successfully delivered to the event queue.
     */
    worker<T extends Worker>(workerClass : Constructor<T>): RemoteWorker<T> {
        return this.get<T>(workerClass).remoteWorker;
    }

    /**
     * Acquire a Remote for the given service where any calls to the remote will await 
     * the full completion of the remote call and resolve to the return value of the 
     * remote function. If you only want to enqueue a task, use `worker()` instead.
     */
    service<T extends Worker>(workerClass : Constructor<T>): RemoteService<T> {
        return this.get<T>(workerClass).remoteService;
    }
}
