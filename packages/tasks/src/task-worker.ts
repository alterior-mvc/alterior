import { InvalidOperationError, ArgumentError, ArgumentNullError } from "@alterior/common";
import { Injector, Provider, ReflectiveInjector } from "injection-js";
import { TaskAnnotation, TaskJob, TaskModuleOptions, TaskQueueClient } from "./tasks";
import { ApplicationOptions } from "@alterior/runtime";
import { Type } from "@alterior/runtime";
import * as Queue from "bull";
import { Logger } from "@alterior/logging";

export interface TaskHandler {
	worker : Worker;
    handler : (methodName : string, args : any[]) => Promise<any>;
}

export class TaskWorker {
    constructor(
		private _injector : Injector,
		private _client : TaskQueueClient,
        private _options : TaskModuleOptions,
		private _appOptions : ApplicationOptions,
		private _logger : Logger
    ) {
		if (!_injector)
			throw new ArgumentNullError(`injector`);

		if (!_options)
			throw new ArgumentNullError(`options`);

		if (!_appOptions)
			throw new ArgumentNullError(`appOptions`);

    }

    public get injector() {
        return this._injector;
    }

    public get options() {
        return this._options;
    }

    public get appOptions() {
        return this._appOptions;
    }

    private _taskHandlers = {};

	get queue() {
		return this._client.queue;
	}

	stop() {
		this.queue.close();
	}

	start() {
		this.queue.process(async (job : Queue.Job<TaskJob>, done) => {
			let task = job.data;

			if (!task || !task.id) {
				await job.discard();
				done(new Error(`Invalid job task`));
			}

			let handler : TaskHandler = this._taskHandlers[task.id];

			await this._logger.withContext({ host: 'tasks', worker: handler.worker }, `Task ${handler.worker.constructor.name}`, async () => {
				try {
					let result = await handler.handler(task.method, task.args);
					done(undefined, result);
				} catch (e) {
					console.error(`Caught error while running task ${job.data.id}.${job.data.method || 'execute'}():`);
					console.error(e);
					
					done(e);
				}
			});

		});
	}

    registerHandler(name : string, handler : TaskHandler) {
        this._taskHandlers[name] = handler;
	}
	
	registerClasses(taskClasses : Function[]) {

		let providers : Provider[] = taskClasses as Provider[];
        let ownInjector = ReflectiveInjector.resolveAndCreate(providers, this.injector);
		let allRoutes = [];

		let tasks = taskClasses.map(taskClass => {

			let id = taskClass.name;
			let annotation = TaskAnnotation.getForClass(taskClass);
			let instance : Worker = ownInjector.get(taskClass);

			if (instance.name)
				id = instance.name;

			if (annotation && annotation.id)
				id = annotation.id;

			this.registerHandler(id, {
				worker: instance,
				handler: async (methodName, args) => {
					let impl = instance.constructor.prototype[methodName];

					if (typeof impl !== 'function' || methodName.startsWith('_'))
						throw new InvalidOperationError(`Invalid task method ${methodName}`);
					
					return await instance[methodName](...args);
				}
			});
		});
	}
}