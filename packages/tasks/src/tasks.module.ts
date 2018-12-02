import { Module, Injectable, Optional } from "@alterior/di";
import { OnInit, Application, RolesService } from "@alterior/runtime";
import * as Queue from "bull";
import { TaskWorkerOptions, TaskWorkerOptionsRef, TaskClientOptions, TaskClientOptionsRef } from "./tasks";
import { TaskRunner } from "task-runner";
import { TaskWorker } from "task-worker";

@Module({

})
export class TasksModule {
    constructor() {
    }

    static forRoot() {
        return this.configure({});
    }

    static configure(options : TaskClientOptions) {
        return {
            $module: TasksModule,
            providers: [
                TaskRunner,
                { provide: TaskClientOptionsRef, useValue: new TaskClientOptionsRef(options) }
            ]
        };
    }
}

/**
 * Import this into your application module to run tasks enqueued by other 
 * services on a shared queue. The tasks which can be processed are specified 
 * in the `tasks` field of one or more modules.
 */
@Module({
    providers: []
})
export class TaskWorkerModule implements OnInit {
    constructor(
        private app : Application,
        private rolesService : RolesService,
        @Optional() private _options : TaskWorkerOptionsRef
    ) {

    }

    /**
     * Used when importing this module from the root (app) module
     * using the default configuration.
     * Should be called only once in the application.
     */
    public static forRoot() {
        return this.configure({});
    }

    /**
     * Create a configured version of the WebServerModule that can be then 
     * be imported into an entry module (or feature module).
     * @param options The options to use for the web server
     */
    public static configure(options : TaskWorkerOptions) {
        return {
            $module: TaskWorkerModule,
            providers: [
                { provide: TaskWorkerOptionsRef, useValue: new TaskWorkerOptionsRef(options) },
                { provide: TaskClientOptionsRef, useValue: new TaskClientOptionsRef(options) }
            ]
        }
    }

    worker : TaskWorker;

    get options(): TaskWorkerOptions {
        return this._options ? this._options.options : {} || {};
    }

    get tasks(): Function[] {
        return [].concat(...this.app.runtime.definitions.map(x => x.metadata.tasks || []));
    }

    altOnInit() {
        this.worker = new TaskWorker(this.app.runtime.injector, this.options, this.app.options);
        this.worker.registerClasses(this.tasks);

        this.rolesService.registerRole({
            identifier: 'task-worker',
            instance: this,
            name: 'Task Worker',
            summary: 'Pulls from the task queue and executes them using task classes registered in the module tree',
            async start() {
                this.worker.start();
            },

            async stop() {
                this.worker.stop();
            }
        })

    }

    altOnStart() {
    }

    altOnStop() {
    }
}