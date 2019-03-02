import 'reflect-metadata';

import { ApplicationOptions, AppOptionsAnnotation } from './app-options';
import { ReflectiveInjector, Provider, Injectable, 
		 ModuleAnnotation, Injector } from '@alterior/di';
import { Runtime } from './modules';
import { ApplicationArgs } from './args';
import { RolesService } from './roles.service';
import { Environment } from '@alterior/common';

require('source-map-support').install();

declare let module : never;

export class ApplicationOptionsRef {
	constructor(
		options : ApplicationOptions
	) {
		this.options = Object.assign({}, options);
	}

	readonly options : ApplicationOptions;
}

/**
 * Handles bootstrapping the application.
 */
@Injectable()
export class Application {
	constructor(
		readonly runtime? : Runtime,
		private _optionsRef? : ApplicationOptionsRef,
		private _args? : ApplicationArgs
	) {

	}

	public start() {
		this.runtime.start();
	}

	public stop() {
		this.runtime.stop();
	}

	get injector() {
		return this.runtime.injector;
	}

	inject<T>(ctor : { new() : T }): T {
		return this.injector.get(ctor);
	}

	get args() : string[] {
		return this._args.get();
	}

	get options() : ApplicationOptions {
		return this._optionsRef.options;
	}

	private static loadOptions(entryModule : Function, bootstrapOptions : ApplicationOptions): ApplicationOptions {
		// Read an @AppOptions() decorator if any, and merge providers from it 
		// into the bootstrapped providers

		let appOptionsAnnotation = AppOptionsAnnotation.getForClass(entryModule);
		let appProvidedOptions : ApplicationOptions = appOptionsAnnotation ? appOptionsAnnotation.options : {} || {};
		
		return Object.assign(
			{
				version: '0.0.0',
				verbose: false,
				silent: false,
				hideExceptions: false,
				port: 3000,
				autostart: true,
				providers: [],
				middleware: [],
				controllers: [],
				autoRegisterControllers: true
			}, 
			appProvidedOptions, 
			bootstrapOptions
		);
	}

	private static validateEntryModule(module : Function) {
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

	private _bootstrapped : boolean = false;

	/**
	 * Bootstrap an Alterior application.
	 */
	public static async bootstrap(entryModule : Function, options? : ApplicationOptions): Promise<Application> {
		this.validateEntryModule(entryModule);
		
		options = this.loadOptions(entryModule, options);

		let runtime = new Runtime(entryModule);

		let providers : Provider[] = [
			ApplicationArgs,
			RolesService,
			Environment
		];

		runtime.contributeProviders(providers);
		providers.push(
			{
				provide: ApplicationOptionsRef,
				useValue: new ApplicationOptionsRef(options)
			}
		);
		providers.push(Application);

		let injector : ReflectiveInjector;
		try {
			injector = ReflectiveInjector.resolveAndCreate(providers);
		} catch (e) {
			console.error(`Failed to resolve injector:`);
			console.error(e);
			console.error(`Providers:`);
			console.dir(providers);
			console.error(`Modules:`);
			console.dir(runtime.definitions);
			throw e;
		}

		runtime.load(injector);
		runtime.fireEvent('OnInit');
		runtime.configure();

		if (options.autostart)
			runtime.start();

		return runtime.getService(Application);
	}
	
}