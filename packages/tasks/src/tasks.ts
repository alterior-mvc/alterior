import { Annotation, MetadataName, AnnotationDecorator } from "@alterior/annotations";
import { Injectable, InjectionToken, Optional, Injector, Provider, ReflectiveInjector } from "@alterior/di";
import BullQueue from "bull";

export interface TaskModuleOptions {
    queueName? : string;
    queueOptions? : BullQueue.QueueOptions;
}


/**
 * This injectable allows configuration of the task system. 
 * Include a provider for the injection token `QUEUE_OPTIONS`
 * which provides an instance of this class. 
 * 
 * For instance: `[ provide: QUEUE_OPTIONS, useValue: new TaskClientOptionsRef({ optionsHere }) ]`
 * 
 */
@Injectable()
export class TaskModuleOptionsRef {
    constructor(options : TaskModuleOptions) {
        this.options = options;
    }

    public options : TaskModuleOptions;
}

export interface TaskJob {
    id : string;
    method : string;
    args : any[];
}

export const QUEUE_OPTIONS = new InjectionToken<BullQueue.QueueOptions>('QueueOptions');

@MetadataName('@alterior/tasks:Task')
export class TaskAnnotation extends Annotation {
    constructor(readonly id? : string) {
        super();
    }
}

export const Task = TaskAnnotation.decorator();

export abstract class Worker {
    abstract get name() : string;
    get options() : JobOptions { return undefined; }

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
} & {
    withOptions(options : JobOptions) : RemoteService<T>;
}

export type RemoteWorker<T> = {
    [P in keyof T]: 
        T[P] extends (...args: any[]) => any ? 
            // methods
            (...args : Parameters<T[P]>) => Promise<QueueJob<TaskJob>>
            
            // fields
            : never
    ;
} & {
    withOptions(options : JobOptions) : RemoteWorker<T>;
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

    static createAsync<T extends Worker>(queueClient : TaskQueueClient, id : string, options? : JobOptions): RemoteWorker<T> {
        return this.create(
            (method, ...args) => {
                if (method === 'withOptions')
                    return TaskWorkerProxy.createAsync(queueClient, id, Object.assign({}, options, args[0]));
                else
                    return queueClient.enqueue({ id, method, args }, options)
            }
        );
    }
    
    static createSync<T extends Worker>(queueClient : TaskQueueClient, id : string, options? : JobOptions): RemoteService<T> {
        return this.create( 
            (method, ...args) => {
                if (method === 'withOptions')
                    return TaskWorkerProxy.createSync(queueClient, id, Object.assign({}, options, args[0]));
                else
                    return queueClient.enqueue({ id, method, args }, options).then(v => v.finished);
            }
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
export class TaskQueueClient {
    constructor(
        @Optional()
        private optionsRef : TaskModuleOptionsRef
    ) {
        this._queue = new BullQueue(this.queueName, this.queueOptions);
    }

    _queue : BullQueue.Queue;

    get queue(): Queue<TaskJob> {
        return this._queue;
    }
    
    /**
     * Get the task client options. See 
     */
    get options(): TaskModuleOptions {
        return (this.optionsRef ? this.optionsRef.options : undefined) || {};
    }

    get queueName(): string {
        return this.options.queueName || 'alteriorTasks';
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
     * Enqueue a new task. To handle the task on the worker side, register for it with `.process()`
     */
    async enqueue(data : TaskJob, opts? : JobOptions): Promise<QueueJob<TaskJob>> {
        return await this._queue.add(data, opts);
    }
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
            sync: TaskWorkerProxy.createSync(this.client, id, instance.options),
            async: TaskWorkerProxy.createAsync(this.client, id, instance.options)
        };
    }

    get all() : TaskWorkerEntry[] {
        return Object.values(this._entries);
    }

    get<T extends Worker>(cls : Constructor<T>): TaskWorkerEntry<T> {
        let entry = this.all.find(x => x.type === cls);

        if (!entry)
            throw new Error(`Worker class ${cls.name} is not registered. Add it to the 'tasks' property of a module or call TaskWorkerRegistry.register(${cls.name})`);
        
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
