import 'reflect-metadata';

import { InjectionToken, ModuleAnnotation, inject } from '@alterior/di';
import { AppOptionsAnnotation, ApplicationOptions } from './app-options';
import { ApplicationArgs } from './args';
import { Runtime } from './runtime';
import { Constructor } from './reflector';

export class ApplicationOptionsRef {
	constructor(
		options: ApplicationOptions
	) {
		this.options = Object.assign({}, options);
	}

	readonly options: ApplicationOptions;
}

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
	private _optionsRef = inject(ApplicationOptionsRef);
	private _args = inject(ApplicationArgs);
	
	public start() {
		this.runtime.start();
	}

	public stop() {
		this.runtime.stop();
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

	get args(): string[] {
		return this._args.get();
	}

	get options(): ApplicationOptions {
		return this._optionsRef.options;
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
			
			runtime.fireEvent('OnInit');
			runtime.configure();
	
			if (runtime.selfTest) {
				console.log(`[Self Test] ✔ Looks good!`);
				process.exit(0);
			}
			
			if (options.autostart)
				runtime.start();

			runtime.fireEvent('AfterStart');

			return executionContext.application;
		});
	}
	
}