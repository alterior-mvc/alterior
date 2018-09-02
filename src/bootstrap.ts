import 'reflect-metadata';

import * as rimraf from 'rimraf';
import * as mkdirp from 'mkdirp';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';

const getParameterNames = require('@avejidah/get-parameter-names');

import { ApplicationOptions, ApplicationInstance } from './application';
import { CONTROLLER_CLASSES } from './controller';
import { prepareMiddleware } from './middleware';
import { RouteReflector, RouteEvent, RouteDefinition, MountOptions } from './route';
import { Response } from './response';
import { ExpressRef } from './express-ref';
import { HttpException } from './errors';

import { ReflectiveInjector, Provider, Injector } from 'injection-js';
import { SanityCheckReporter } from './sanity';
import { ApplicationArgs } from './args';
import { ModuleOptions } from './modules';

require('source-map-support').install();

const EXPRESS_SUPPORTED_METHODS = [ 
	"checkout", "copy", "delete", "get", "head", "lock", "merge", 
	"mkactivity", "mkcol", "move", "m-search", "notify", "options", 
	"patch", "post", "purge", "put", "report", "search", "subscribe", 
	"trace", "unlock", "unsubscribe",
];

const BOOTSTRAP_PROVIDERS : Provider[] = [
	SanityCheckReporter,
	ApplicationArgs,
	ApplicationInstance
];

export interface ServiceDescription {
	name? : string;
	description? : string;
	version? : string;
	routes? : RouteDescription[];
}

export interface RouteDescription {
	definition : RouteDefinition;

	httpMethod : string;
	method? : string;
	path : string;
	group? : string;
	
	description? : string;
	parameters? : RouteParamDescription[];
}

export interface RouteParamDescription {
	name : string;
	type : string;
	description? : string;
	required? : boolean;
}

export class ServiceDescriptionRef {
	constructor(
		readonly description : ServiceDescription
	) {
	}
}

import * as ejs from 'ejs';

async function generateFile(templateFile : string, data : any, outputFile : string): Promise<void> {
	let content = ejs.render(fs.readFileSync(templateFile).toString(), data, {
		outputFunctionName: 'echo'
	} as any);
	fs.writeFileSync(outputFile, content);
}

export async function generateClient(appInstance : ApplicationInstance, outputFolder : string) {
	let templateFolder = path.join(__dirname, '..', 'src', 'templates');
	// Clear and prepare the output folder

	//await new Promise((res, rej) => rimraf(outputFolder, err => err ? rej(err) : res()));
	await new Promise((res, rej) => mkdirp(outputFolder, err => err ? rej(err) : res()));

	let groups = Object.keys(appInstance.serviceDescription.routes.map(x => x.group).reduce((pv, cv) => (pv[cv] = 1, pv), {}))
	let providers = [];
	let exports = [];

	
	for (let group of groups) {
		let upperedGroup = group;
		if (upperedGroup !== '')
			upperedGroup = upperedGroup.charAt(0).toUpperCase() + upperedGroup.slice(1);
		let hyphenName = group.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
		let routes = appInstance.serviceDescription.routes.filter(x => x.group == group);

		await generateFile(path.join(templateFolder, 'api.ts.ejs'), {
			name: upperedGroup,
			routes
		}, path.join(outputFolder, `${hyphenName}.ts`));

		providers.push({
			file: `./${hyphenName}`,
			item: `${upperedGroup}Api`,
		});
		exports.push(`./${hyphenName}`)
	}

	await generateFile(
		path.join(templateFolder, 'index.ts.ejs'), 
		{
			exports
		}, 
		path.join(outputFolder, 'index.ts')
	);

	await generateFile(
		path.join(templateFolder, 'api.module.ts.ejs'), 
		{
			providers
		}, 
		path.join(outputFolder, 'api.module.ts')
	);

}

/**
 * Bootstrap an Alterior application.
 */
export async function bootstrap(app : Function, providers = [], additionalOptions? : ApplicationOptions): Promise<ApplicationInstance> {
	let bootstrapper = new Bootstrapper(app, providers, additionalOptions);
	
	try {
		return await bootstrapper.bootstrap(app, providers, additionalOptions);
	} catch (e) {
		if (!bootstrapper.appOptions.silent) {
			console.error('Error while bootstrapping Alterior app:');
			console.error(e);
		}

		throw e;
	}
}

export class ApplicationOptionsRef {
	constructor(
		options : ApplicationOptions
	) {
		this.options = Object.assign({}, options);
	}

	readonly options : ApplicationOptions;
}

export interface ControllerContext {
	pathPrefix? : string;

	/* PRIVATE */

	visited? : any[];
}

/**
 * Handles bootstrapping the application.
 */
class Bootstrapper {
	constructor(
		app : Function, 
		providers = [], 
		public appOptions? : ApplicationOptions
	) {
		// Read an @AppOptions() decorator if any, and merge providers from it 
		// into the bootstrapped providers

		let appProvidedOptions = <ApplicationOptions>Reflect.getMetadata("alterior:Application", app) || {};
		
		this.appOptions = Object.assign({
			verbose: false,
			silent: false,
			hideExceptions: false,
			port: 3000,
			autostart: true,
			providers: [],
			middleware: [],
			controllers: [],
			autoRegisterControllers: true
		}, appProvidedOptions, this.appOptions);
	}

	private applicationArgs : ApplicationArgs;
	private injector : ReflectiveInjector;

	private getOrDefault<T>(v : T, o : T): T {
		return v !== undefined ? v : o;
	}

	public async setupDI() {

	}

	private verboseInfo(...args) {
		if (this.appOptions.verbose) {
			console.info(...args);
		}
	}

	private verboseDir(...args) {
		if (this.appOptions.verbose) {
			console.dir(...args);
		}
	}

	private getAltMiddlewareMetadata(middleware) {
		return Reflect.getMetadata('alterior:middleware', middleware);
	}

	expressApp : express.Application;
	
	private initializeAndRegisterExpress(providers) {
		this.verboseInfo('starting express...');
		this.expressApp = express();

		// Make Express available via DI
		providers.push({
			provide: ExpressRef,
			useValue: {application: this.expressApp} 
		});
	}

	gatherProviders(moduleClass : Function, visited? : Function[]) {

		if (!visited)
			visited = [];
		
		let providers = [];

		if (visited.includes(moduleClass))
			return [];
		
		let mod : ModuleOptions = Reflect.getMetadata('alterior:module', moduleClass);
		if (!mod)
			return [];
		
		providers = providers.concat(mod.providers);

		for (let imp of mod.imports) {
			if (visited.includes(imp))
				continue;
			visited.push(imp);
			providers = providers.concat(this.gatherProviders(imp, visited.slice()));
		}

		return providers;
	}

	gatherControllers(moduleClass : Function, visited? : Function[]) {
		let moduleMetadata : ModuleOptions = Reflect.getMetadata('alterior:module', moduleClass);
		moduleMetadata.declarations.filter(x => Reflect.getMetadata('alterior:Controller', x))
	}

	/**
	 * Bootstrap the given application into an application instance.
	 * @param app 
	 * @param providers 
	 * @param additionalOptions 
	 */
	public async bootstrap(app : Function, providers : Provider[] = [], additionalOptions? : ApplicationOptions): Promise<ApplicationInstance> {

		if (typeof app !== 'function') {
			throw new Error(
				`You must pass a class/constructor function as the first parameter ` 
				+ `to bootstrapApplication(). You provided: ` 
				+ `${typeof app} with value '${app}'`
			);
		}
	
		providers = BOOTSTRAP_PROVIDERS.concat(providers);

		try {
			providers = providers.concat(await Promise.all(this.appOptions.providers));
		} catch(e) {
			console.error(`Alterior: Caught exception while initializing application providers:`);
			console.error(e);
			process.exit(1);
			throw e;
		}

		this.initializeAndRegisterExpress(providers);

		// Determine our set of controller classes.
		// It may be provided via @AppOptions(), or it may
		// be provided by the controllers module (which exports a list of all
		// loaded classes that have @Controller() on them)

		let controllers : any[] = [];

		if (this.appOptions.controllers)
			controllers = controllers.concat(this.appOptions.controllers);

		if (this.appOptions.autoRegisterControllers)
			controllers = controllers.concat(CONTROLLER_CLASSES);
		
		let moduleMetadata : ModuleOptions = Reflect.getMetadata('alterior:module', app);
		
		if (moduleMetadata) {
			providers = providers.concat(this.gatherProviders(app));
			moduleMetadata.declarations.filter(x => Reflect.getMetadata('alterior:Controller', x))
		} else {
			controllers.push(app);
		}

		// Set up the service description

		this._serviceDescription.name = this.appOptions.name;
		this._serviceDescription.description = this.appOptions.description;

		// Make our controllers available via DI 
		// (we will instantiate the controllers via DI later)

		this.verboseInfo('registering controllers...');
		providers = providers.concat(controllers);

		// Make global middleware available via DI

		this.verboseInfo('adding global middleware...');

		let index = 0;
		for (let middleware of this.appOptions.middleware) {
			if (middleware == null)
				throw new Error(`AppOptions provided null middleware (at position ${index})`);
			index += 1;
		}

		let allMiddleware = this.appOptions.middleware;
		let alteriorMiddlewares = allMiddleware.filter(x => this.getAltMiddlewareMetadata(x));
		providers = providers.concat(alteriorMiddlewares);

		// Load asynchronous assets

		this.verboseInfo(`async providers initialized successfully`);

		// Publish simple data providers into the DI container.

		providers.push(
			{
				provide: ApplicationOptionsRef,
				useValue: new ApplicationOptionsRef(this.appOptions)
			}, 
			{
				provide: ServiceDescriptionRef,
				useValue: new ServiceDescriptionRef(this.serviceDescription)
			}
		);

		// Late resolve an instance of ApplicationInstance. We do this by first making a temporary
		// injector, constructing our instance, and then late-binding a provider for a singleton instance.

		let environmentInjector = ReflectiveInjector.resolveAndCreate(providers);
		let appContainer = <ApplicationInstance>environmentInjector.get(ApplicationInstance);
		let injector = environmentInjector.resolveAndCreateChild([
			{ provide: ApplicationInstance, useValue: appContainer }
		]);

		// Create the injector. 
		// This is where the magic of DI happens. 

		
		let appInstance = injector.get(app);

		// Install global middleware

		(this.appOptions.middleware || []).forEach(x => {
			if ('name' in x)
				this.expressApp.use(<any>prepareMiddleware(injector, x));
			else
			this.expressApp.use(x[0], prepareMiddleware(injector, x[1]));
		});

		// Instantiate all the controllers in the application, and register
		// their respective routed methods with the express app we made before.

		let allRoutes = [];

		this.verboseInfo(`initializing routes...`);

		for (let controller of controllers) {
			this.verboseInfo(`Registering controller ${controller.name || controller}`);
			this.initializeController(injector, controller, allRoutes);
		}

		// Framework is booted.

		this.verboseInfo('alterior booted successfully');
		this.verboseDir(allRoutes);

		// Self-testing mechanism 

		if (this.isTestInvocation(injector)) {
			await this.handleTestInvocation(injector, appInstance);
			return;
		}

		let container = <ApplicationInstance>injector.get(ApplicationInstance);
		container.bind(appInstance, this.expressApp, this.appOptions.port, this.serviceDescription);

		// Run the application. 

		if (appInstance['altOnInit'])
			appInstance['altOnInit']();

		if (this.appOptions.autostart) {
			if (!this.appOptions.silent)
				console.info(`listening on ${this.appOptions.port}`);
			container.start();
		}

		return container;
	}

	private _serviceDescription : ServiceDescription = {
		routes: [],
		version: '0.0.0'
	};

	get serviceDescription() {
		return this._serviceDescription;
	}

	private async initializeController(injector : ReflectiveInjector, controller : Function, allRoutes : any[], context? : ControllerContext) {

		// Prepare the context for ease of use.

		if (!context)
			context = {};

		if (!context.pathPrefix)
			context.pathPrefix = '';
	
		if (!context.visited)
			context.visited = [];

		if (context.visited.includes(controller)) {
			console.warn(`Controller visited multiple times and skipped. May indicate recursion.`);
			return;
		}
		
		context.visited.push(controller);

		this.verboseInfo(`Initializing controller ${controller.name || controller} with path prefix '${context.pathPrefix}'`);

		// Reflect upon our routes

		let routeReflector = new RouteReflector(controller, context.pathPrefix);
		let routes = routeReflector.routes;
		let controllerInstance = injector.get(controller);
		let controllerMetadata = Reflect.getMetadata('alterior:Controller', controller);

		this.verboseInfo(` - ${routeReflector.mounts.length} mounts`);
		this.verboseInfo(` - ${routeReflector.routes.length} routes`);

		for (let mount of routeReflector.mounts) {
			let providers : Provider[] = (mount.options || {} as MountOptions).providers || [];
			let controllers = (mount.controllers || []).slice();
			let controllerType = Reflect.getMetadata('design:type', controller.prototype, mount.propertyKey);
			
			if (typeof controllerType === 'function' && controllerType !== Object)
				controllers.push(controllerType);

			providers.push(...(controllers as Provider[]));

			this.verboseInfo(` - Setting up mount (base '${mount.path}') with ${controllers.length} controllers...`);
			let mountInjector : ReflectiveInjector;
			
			this.verboseInfo(` - Providers: `);
			this.verboseDir(providers);
			try {
				mountInjector = injector.resolveAndCreateChild(providers);
			} catch (e) {
				console.error(`Failed to resolve and create dependency injector for mount with path '${mount.path}'`);
				console.error(e);
				throw e;
			}

			for (let controller of controllers) {
				this.initializeController(mountInjector, controller, allRoutes, {
					pathPrefix: `${context.pathPrefix.replace(/\/+$/g, '')}/${mount.path.replace(/^\/+/g, '')}`
				});
			}
		}

		// Register all of our routes with Express

		for (let route of routes) {

			// Ensure indexes are valid.

			let middleware = route.options.middleware as any || [];
			let invalidIndex = middleware.findIndex(x => !x);
			if (invalidIndex >= 0)
				throw new Error(`Route '${route.path}' provided null middleware at position ${invalidIndex}`);

			let middlewareProviders : Provider[] = middleware.filter(x => Reflect.getMetadata('alterior:middleware', x))
			let childInjector = injector.resolveAndCreateChild(middlewareProviders);

			// Add it to the global route list

			allRoutes.push({
				controller: controller,
				route
			});

			// Select the appropriate express "registrar" method (ie get, put, post, delete, patch) 

			let loweredMethod = route.httpMethod.toLowerCase();
			if (!EXPRESS_SUPPORTED_METHODS.includes(loweredMethod))
				throw new Error(`The requested method '${loweredMethod}' is not supported by Express.`);
			let registrar : Function = this.expressApp[loweredMethod];
			let args : any[] = [ route.path ];

			// Prepare the middlewares (if they are DI middlewares, they get injected)

			(route.options.middleware || [])
				.forEach(x => args.push(prepareMiddleware(childInjector, x)));

			let routeParams = (route.path || "").match(/:([A-Za-z][A-Za-z0-9]*)/g) || [];

			routeParams = routeParams.map(x => x.substr(1));

			// Document the route. We'll add the parameters later.

			let group : string = undefined;
			let controllerGroup : string = undefined;
			
			if (controllerMetadata && controllerMetadata.options && controllerMetadata.options.group) {
				controllerGroup = controllerMetadata.options.group;
			} else {
				controllerGroup = controller.name.replace(/Controller$/, '');
				controllerGroup = controllerGroup.charAt(0).toLowerCase()+controllerGroup.slice(1);
			}

			if (route.options && route.options.group)
				group = route.options.group;
			else (controllerMetadata && controllerMetadata.options && controllerMetadata.options.group)
				group = controllerGroup;
			
			let routeDescription : RouteDescription = {
				definition: route,
				httpMethod: route.httpMethod,
				group,
				method: route.method,
				path: route.path,
				parameters: []
			};
			this._serviceDescription.routes.push(routeDescription);

			// Do analysis of the controller method ahead of time so we can 
			// minimize the amount of overhead of actual web requests

			let returnType = Reflect.getMetadata("design:returntype", controllerInstance.constructor.prototype, route.method);
			let paramTypes = Reflect.getMetadata("design:paramtypes", controllerInstance.constructor.prototype, route.method);
			let paramNames = getParameterNames(controllerInstance[route.method]);
			let paramFactories = [];
			let pathParameterMap : any = {};

			// Construct a set of easily addressable path parameter descriptions (pathParameterMap)
			// that can be decorated with insights from reflection later.

			let pathParamMatches = route.path.match(/:([A-Za-z0-9]+)/g) || [];
			let pathParamNames = Object.keys(pathParamMatches.reduce((pv, cv) => (pv[cv] = 1, pv), {}));

			routeDescription.parameters.push(
				...pathParamNames
					.map(id => <RouteParamDescription>{
						name: id.replace(/^:/, ''),
						type: 'path'
					})
					.map(desc => pathParameterMap[desc.name] = desc)
			)

			if (paramTypes) {
				for (let i = 0, max = paramNames.length; i < max; ++i) {
					let paramName = paramNames[i];
					let paramType = paramTypes[i];
					let simpleTypes = [String, Number];
					let paramDesc : RouteParamDescription = null;

					if (paramType === RouteEvent) {
						paramFactories.push(ev => ev);
					} else if (paramName === "body") {
						paramFactories.push((ev : RouteEvent) => ev.request['body']);
						paramDesc = {
							name: 'body',
							type: 'body',
							description: `An instance of ${paramType}`
						};
					} else if (paramName === "session") {
						paramFactories.push((ev : RouteEvent) => ev.request['session']);
						
						paramDesc = {
							name: 'session',
							type: 'session',
							description: `An instance of ${paramType}`
						};

					} else if (paramName === "req" || paramName === "request") {
						paramFactories.push((ev : RouteEvent) => ev.request);
					} else if (paramName === "res" || paramName === "response") {
						paramFactories.push((ev : RouteEvent) => ev.response);
					} else if (routeParams.find(x => x == paramName) && simpleTypes.indexOf(paramType) >= 0) {

						// This is a route parameter binding.

						paramFactories.push((ev : RouteEvent) => ev.request.params[paramName]);

						// Add documentation information via reflection.

						let paramDesc : RouteParamDescription = pathParameterMap[paramName];
						if (!paramDesc) {
							pathParameterMap[paramName] = paramDesc = { 
								name: paramName, type: 'path' 
							};
							routeDescription.parameters.push(paramDesc);
						}

						// Decorate the parameter description with reflection info

						
						paramDesc.description = `An instance of ${paramType}`;
					} else {
						let sanitizedType = paramType ? (paramType.name || '<unknown>') : '<undefined>';
						throw new Error(
							`Unable to fulfill route method parameter '${paramName}' of type '${sanitizedType}'\r\n`
							+ `While preparing route ${route.method} ${route.path} with method ${route.method}()`
						);
					}

					if (paramDesc) {
						routeDescription.parameters.push(paramDesc);
					}
				}
			} else {
				paramFactories = [
					(ev : RouteEvent) => ev.request, 
					(ev : RouteEvent) => ev.response
				];
			}

			// Append the actual controller method

			args.push(async (req : express.Request, res : express.Response) => {

				/**
				 * Handle exception response
				 */
				let handleExceptionResponse = (e) => {
					
					if (e.constructor === HttpException) {
						let httpException = <HttpException>e;
						res.status(httpException.statusCode);
						
						httpException.headers
							.forEach(header => res.header(header[0], header[1]));

						res.send(httpException.body);
					} else {
						if (!this.appOptions.silent) {
							console.error(`Exception while handling route ${route.path} via method ${controller.name}.${route.method}():`);
							console.error(e);
						}
						
						let response : any = {
							message: 'An exception occurred while handling this request.'
						};

						if (!this.appOptions.hideExceptions) {
							if (e.constructor === Error)
								response.error = e.stack;
							else
								response.error = e;
						}

						res.status(500).send(JSON.stringify(response));
					}
				}

				if (!this.appOptions.silent)
					console.info(`[${new Date().toLocaleString()}] ${route.path} => ${controller.name}.${route.method}()`);

				// Execute our function by resolving the parameter factories into a set of parameters to provide to the 
				// function.

				let ev = new RouteEvent(req, res);
				let result;

				try {
					result = await controllerInstance[route.method].apply(controllerInstance, paramFactories.map(x => x(ev)));
				} catch (e) {
					handleExceptionResponse(e);
					return;
				}

				// Return value handling

				let handleResponse = async (result) => {
						
					if (result === undefined)
						return;

					if (result === null) {
						res	.status(200)
							.header('Content-Type', 'application/json')
							.send(JSON.stringify(result))
						;
						return;
					}

					if (result.constructor === Response) {
						let response = <Response>result;
						res.status(response.status);
						response.headers.forEach(x => res.header(x[0], x[1]));
						res.send(response.body); 
					} else {
						res	.status(200)
							.header('Content-Type', 'application/json')
							.send(JSON.stringify(result))
						;
					}
				};

				await handleResponse(result);
			});

			// Send into express (registrar is one of express.get, express.put, express.post etc)

			this.verboseInfo(`   |- registering route ${loweredMethod.toUpperCase()} ${args[0]}`);
			registrar.apply(this.expressApp, args);
		}
	}

	isTestInvocation(injector) {
		let argsService = <ApplicationArgs>injector.get(ApplicationArgs);
		let args = argsService.get();

		return (args.length > 0 && args[0] == "test");
	}

	async handleTestInvocation(injector, appInstance) {
		let reporter = <SanityCheckReporter>injector.get(SanityCheckReporter);
		let healthy = true;

		try {
			if (appInstance['altOnSanityCheck']) {
				healthy = await appInstance['altOnSanityCheck']();
			}

			if (!healthy)
				throw "Sanity check returned false (see your application's altOnSanityCheck() method)";

			reporter.reportSuccess();
		} catch(e) {
			reporter.reportFailure(e);
		}
	}
}