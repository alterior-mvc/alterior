import { Module, inject } from "@alterior/di";
import { Logger, LoggingModule } from "@alterior/logging";
import { Application, OnInit, RolesService } from "@alterior/runtime";
import { TaskRunner } from "./task-runner";
import { TaskWorker } from "./task-worker";
import { TaskModuleOptions, TaskModuleOptionsRef, TaskQueueClient, TaskWorkerRegistry } from "./tasks";

/**
 * Import this into your application module to run tasks enqueued by other 
 * services on a shared queue. The tasks which can be processed are specified 
 * in the `tasks` field of one or more modules.
 */
@Module({
    providers: [
        TaskQueueClient,
        TaskWorkerRegistry,
        TaskRunner
    ],
    imports: [
        LoggingModule
    ]
})
export class TasksModule implements OnInit {
    private app = inject(Application);
    private rolesService = inject(RolesService);
    private client = inject(TaskQueueClient);
    private workerRegistry = inject(TaskWorkerRegistry);
    private logger = inject(Logger);
    private _options = inject(TaskModuleOptionsRef, { optional: true });

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
    public static configure(options: TaskModuleOptions) {
        return {
            $module: TasksModule,
            providers: [
                { provide: TaskModuleOptionsRef, useValue: new TaskModuleOptionsRef(options) }
            ]
        }
    }

    worker: TaskWorker | undefined;

    get options(): TaskModuleOptions {
        return this._options ? this._options.options : {} || {};
    }

    get tasks(): Function[] {
        return [...(this.app.runtime.definitions.map(x => x.metadata?.tasks ?? []))].flat();
    }

    altOnInit() {

        this.workerRegistry.registerClasses(this.tasks);

        this.worker = new TaskWorker(
            this.app.runtime.injector,
            this.client,
            this.options,
            this.app.options,
            this.logger
        );
        this.worker.registerClasses(this.tasks);

        let self = this;

        this.rolesService.registerRole({
            identifier: 'task-worker',
            instance: this,
            name: 'Task Worker',
            summary: 'Pulls from the task queue and executes them using task classes registered in the module tree',
            async start() {
                self.worker?.start();
            },

            async stop() {
                self.worker?.stop();
            }
        })

    }
}