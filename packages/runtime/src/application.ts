import 'reflect-metadata';

import { InjectionToken, inject } from '@alterior/di';
import { APP_OPTIONS, AppOptionsAnnotation, ApplicationOptions } from './app-options';
import { ApplicationArgs } from './args';
import { Runtime } from './runtime';
import { Constructor } from './reflector';
import { ModuleAnnotation } from './module-annotation';

/**
 * Represents the current runtime execution context.
 * This is exposed via a zone-local variable, and the Runtime
 * populates it with useful information as it becomes available.
 */
export class ExecutionContext {
	/**
	 * Retrieve the Alterior application which is currently being executed.
	 * If an application has not been bootstrapped yet, the value is null.
	 */
	public application: Application | null = null;

	static readonly ZONE_LOCAL_NAME  = '@alterior/runtime:ExecutionContext';

	/**
	 * Get the current execution context, if any.
	 */
	public static get current(): ExecutionContext {
		return Zone.current.get(ExecutionContext.ZONE_LOCAL_NAME);
	}

	/**
	 * Execute the given function in a new zone which has
	 * this ExecutionContext instance as the current execution context.
	 */
	public async run<T>(callback: () => Promise<T>): Promise<T> {
		let zone = Zone.current.fork({
			name: `AlteriorExecutionContext`,
			properties: {
				[ExecutionContext.ZONE_LOCAL_NAME]: this
			}
		});

		return await zone.run(() => callback());
	}

	public runSync<T>(callback: () => T): T {
		let zone = Zone.current.fork({
			name: `AlteriorExecutionContext`,
			properties: {
				[ExecutionContext.ZONE_LOCAL_NAME]: this
			}
		});

		return zone.run(() => callback());
	}
}

/**
 * Handles bootstrapping the application.
 */
export class Application {
	readonly runtime = inject(Runtime);
	readonly options = inject(APP_OPTIONS);
	readonly args = inject(ApplicationArgs);
	
	public async start() {
		await this.runtime.start();
	}

	public async stop() {
		await this.runtime.stop();
	}

	get injector() {
		return this.runtime.injector;
	}

	inject<T>(ctor: Constructor<T>): T;
	inject<T>(token: InjectionToken<T>): T;
	inject<T, U>(ctor: Constructor<T>, notFoundValue: U): T | U;
	inject<T, U>(token: InjectionToken<T>, notFoundValue: U): T | U;
	inject(ctor: any, notFoundValue?: any): any {
		return this.injector.get(ctor, notFoundValue);
	}

	private static validateEntryModule(module: Function) {
		if (typeof module !== 'function') {
			throw new Error(
				`You must pass a Module class as the first parameter ` 
				+ `to bootstrap(). You provided: ` 
				+ `${typeof module} with value '${module}'`
			);
		}
	
		let moduleMetadata = ModuleAnnotation.getForClass(module);
		if (!moduleMetadata)
			throw new Error(`You must pass a module class decorated by @Module()`);
	}
	
	/**
	 * Bootstrap an Alterior application.
	 */
	public static bootstrap(entryModule: Function, options: ApplicationOptions = {}): Promise<Application> {
		let executionContext = new ExecutionContext();
		return executionContext.run(async () => {
			this.validateEntryModule(entryModule);

			options = {
				version: '0.0.0',
				verbose: false,
				silent: false,
				autostart: true,
				providers: [],
				...AppOptionsAnnotation.getForClass(entryModule)?.options ?? {},
				...options
			};
	
			let modules = Runtime.resolveModules(entryModule);

			// Wait for all modules to be ready before proceeding. This can be used to connect to databases or 
			// remote services or otherwise prepare the modules before bootstrapping happens.
			await Promise.all(modules.map(m => m.metadata?.prepare?.()));

			let runtime = new Runtime(modules, options);
	
			executionContext.application = runtime.getService(Application);
			
			await runtime.init();

			return executionContext.application;
		});
	}
	
}