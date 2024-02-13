import { inject } from "@alterior/di";
import { Constructor, RemoteService, RemoteWorker, TaskWorkerRegistry, Worker } from "./tasks";

export class TaskRunner {
    private _registry = inject(TaskWorkerRegistry);

    get registry() {
        return this._registry;
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
