import 'reflect-metadata';

import { Environment, Time } from '@alterior/common';
import {
	inject,
	Injectable,
	ModuleAnnotation,
	Provider,
	ReflectiveInjector
} from '@alterior/di';
import { ApplicationOptions, AppOptionsAnnotation } from './app-options';
import { ApplicationArgs } from './args';
import { Runtime } from './modules';
import { RolesService } from './roles.service';

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
	public application: Application = null;

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
@Injectable()
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

	inject<T>(ctor: { new(...args): T }, notFoundValue?: T): T {
		return this.injector.get(ctor, notFoundValue);
	}

	get args(): string[] {
		return this._args.get();
	}

	get options(): ApplicationOptions {
		return this._optionsRef.options;
	}

	private static loadOptions(entryModule: Function, bootstrapOptions: ApplicationOptions): ApplicationOptions {
		// Read an @AppOptions() decorator if any, and merge providers from it 
		// into the bootstrapped providers

		let appOptionsAnnotation = AppOptionsAnnotation.getForClass(entryModule);
		let appProvidedOptions: ApplicationOptions = appOptionsAnnotation ? appOptionsAnnotation.options: {} || {};
		
		return Object.assign(
			<ApplicationOptions>{
				version: '0.0.0',
				verbose: false,
				silent: false,
				autostart: true,
				providers: []
			}, 
			appProvidedOptions, 
			bootstrapOptions
		);
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
	public static bootstrap(entryModule: Function, options?: ApplicationOptions): Application {
		let executionContext = new ExecutionContext();
		return executionContext.runSync(() => {
			this.validateEntryModule(entryModule);

			options = this.loadOptions(entryModule, options);
	
			let runtime = new Runtime(entryModule);

			let providers: Provider[] = [
				ApplicationArgs,
				RolesService,
				Environment,
				Time
			];
	
			runtime.contributeProviders(providers);
			providers.push(
				{
					provide: ApplicationOptionsRef,
					useValue: new ApplicationOptionsRef(options)
				}
			);
			providers.push(Application);
			providers.push(options.providers ?? []);

			runtime.providers = providers;
	
			let injector: ReflectiveInjector;
			try {
				injector = ReflectiveInjector.resolveAndCreate(providers, options.parentInjector);
			} catch (e) {
				console.error(`Failed to resolve injector:`);
				console.error(e);
				console.error(`Providers:`);
				console.dir(providers);
				console.error(`Modules:`);
				console.dir(runtime.definitions);
				throw e;
			}

			(<RolesService>injector.get(RolesService)).silent = options.silent;
			
			runtime.load(injector);
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