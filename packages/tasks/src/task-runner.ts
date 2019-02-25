import { Injectable, Inject } from "@alterior/di";
import * as BullQueue from "bull";
import { QUEUE_OPTIONS, TaskJob, TaskAnnotation, TaskModuleOptionsRef, TaskModuleOptions } from "./tasks";
import { Optional, Injector, Provider, ReflectiveInjector } from "injection-js";
import { InvalidOperationError, ArgumentError } from "@alterior/common";

export abstract class Worker {
    abstract get name() : string;

    protected get currentJob() : QueueJob<TaskJob> {
        return Zone.current.get('workerStateJob');
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
            (...args : Parameters<T[P]>) => Promise<QueueJob<TaskJob>>
            
            // fields
            : never
    ;
};

export type QueueOptions = BullQueue.QueueOptions;
export type JobOptions = BullQueue.JobOptions;
export type QueueJob<T> = BullQueue.Job<T>;
export type Queue<T> = BullQueue.Queue<T>;

export interface Constructor<T> {
    new (...args) : T;
}

export type PromiseWrap<T> = T extends PromiseLike<any> ? T : Promise<T>;

export class TaskWorkerProxy {
    private static create<T extends Worker>(handler : (key, ...args) => any): any {
        return <RemoteWorker<T>> new Proxy({}, {
            get(t, key : string, receiver) {
                return (...args) => handler(key, ...args);
            }
        })
    }

    static createAsync<T extends Worker>(queueClient : TaskQueueClient, id : string): RemoteWorker<T> {
        return this.create(
            (key, ...args) => queueClient.enqueue<TaskJob>(
                'alteriorTasks', 
                undefined,
                {
                    id,
                    method: key,
                    args
                }
            )
        );
    }
    
    static createSync<T extends Worker>(queueClient : TaskQueueClient, id : string): RemoteService<T> {
        return this.create( 
            async (key, ...args) => (await queueClient.enqueue<TaskJob>(
                `alteriorTasks`, 
                undefined,
                {
                    id,
                    method: key,
                    args
                }
            )).finished
        );
    }
}

interface TaskWorkerEntry<T extends Worker = any> {
    type : Constructor<T>;
    local : T;
    async : RemoteWorker<T>;
    sync : RemoteService<T>;
}

@Injectable()
export class TaskWorkerRegistry {
    constructor(
        private injector : Injector,
        private client : TaskQueueClient
    ) {

    }

    private _entries : { [name : string] : TaskWorkerEntry } = {};

    private registerClass(injector : Injector, taskClass : Constructor<Worker>) {
        let instance = <Worker> injector.get(taskClass);
        let id = instance.name;
        
        if (this._entries[id])
            throw new Error(`Another worker is already registered with name '${id}'`);

        this._entries[id] = {
            type: <any> taskClass,
            local: instance,
            sync: TaskWorkerProxy.createSync(this.client, id),
            async: TaskWorkerProxy.createAsync(this.client, id)
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

    registerClasses(classes : Function[]) {
        let taskClasses : Constructor<Worker>[] = classes as any;
        let ownInjector = ReflectiveInjector.resolveAndCreate(taskClasses as Provider[], this.injector);
        taskClasses.forEach(taskClass => this.registerClass(ownInjector, taskClass));
    }
}

@Injectable()
export class TaskQueueClient {
    constructor(
        @Inject(QUEUE_OPTIONS)
        @Optional()
        private taskClientOptionsRef : TaskModuleOptionsRef
    ) {
    }

    /**
     * Get the task client options. See 
     */
    get options(): TaskModuleOptions {
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

@Injectable()
export class TaskRunner {
    constructor(
        private _client : TaskQueueClient,
        private _registry : TaskWorkerRegistry
    ) {
    }

    get registry() {
        return this._registry;
    }

    get client() {
        return this._client;
    }

    /**
     * Acquire a Remote for the given service where any calls to the remote will 
     * resolve to a QueueJob which can be further interacted with. Promise will 
     * resolve once the item has been successfully delivered to the event queue.
     */
    worker<T extends Worker>(workerClass : Constructor<T>): RemoteWorker<T> {
        return this.registry.get<T>(workerClass).async;
    }

    /**
     * Acquire a Remote for the given service where any calls to the remote will await 
     * the full completion of the remote call and resolve to the return value of the 
     * remote function. If you only want to enqueue a task, use `worker()` instead.
     */
    service<T extends Worker>(workerClass : Constructor<T>): RemoteService<T> {
        return this.registry.get<T>(workerClass).sync;
    }
}
