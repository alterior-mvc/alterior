import { Module, Injectable, Optional } from "@alterior/di";
import { OnInit, Application, RolesService, Constructor } from "@alterior/runtime";
import * as Queue from "bull";
import { TaskModuleOptions, TaskModuleOptionsRef } from "./tasks";
import { TaskRunner, TaskQueueClient, TaskWorkerRegistry } from "task-runner";
import { TaskWorker } from "task-worker";

/**
 * Import this into your application module to run tasks enqueued by other 
 * services on a shared queue. The tasks which can be processed are specified 
 * in the `tasks` field of one or more modules.
 */
@Module({
    providers: [
        TaskRunner, TaskQueueClient
    ]
})
export class TasksModule implements OnInit {
    constructor(
        private app : Application,
        private rolesService : RolesService,
        private workerRegistry : TaskWorkerRegistry,
        @Optional() private _options : TaskModuleOptionsRef
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
    public static configure(options : TaskModuleOptions) {
        return {
            $module: TasksModule,
            providers: [
                { provide: TaskModuleOptionsRef, useValue: new TaskModuleOptionsRef(options) }
            ]
        }
    }

    worker : TaskWorker;

    get options(): TaskModuleOptions {
        return this._options ? this._options.options : {} || {};
    }

    get tasks(): Function[] {
        return [].concat(...this.app.runtime.definitions.map(x => x.metadata.tasks || []));
    }

    altOnInit() {

        this.workerRegistry.registerClasses(this.tasks);

        this.worker = new TaskWorker(this.app.runtime.injector, this.options, this.app.options);
        this.worker.registerClasses(this.tasks);

        let self = this;

        this.rolesService.registerRole({
            identifier: 'task-worker',
            instance: this,
            name: 'Task Worker',
            summary: 'Pulls from the task queue and executes them using task classes registered in the module tree',
            async start() {
                self.worker.start();
            },

            async stop() {
                self.worker.stop();
            }
        })

    }

    altOnStart() {
    }

    altOnStop() {
    }
}