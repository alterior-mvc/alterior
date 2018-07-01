import 'reflect-metadata';

const getParameterNames = require('@avejidah/get-parameter-names');

import { AppOptions, ApplicationOptions, ApplicationInstance } from './application';
import { CONTROLLER_CLASSES } from './controller';
import { Middleware, prepareMiddleware } from './middleware';
import { RouteReflector, RouteEvent } from './route';
import { Response } from './response';
import { ExpressRef } from './express-ref';
import { HttpException } from './errors';

import * as express from 'express';
import { ReflectiveInjector, Provider } from '@angular/core';
import { SanityCheckReporter } from './sanity';
import { ApplicationArgs } from './args';

require('source-map-support').install();

const BOOTSTRAP_PROVIDERS = [
	SanityCheckReporter,
	ApplicationArgs,
	ApplicationInstance
];

/**
 * Bootstrap an Alterior application.
 */
export async function bootstrap(app : Function, providers = [], additionalOptions? : ApplicationOptions): Promise<ApplicationInstance> {
	let bootstrapper = new Bootstrapper(app, providers, additionalOptions);
	
	try {
		return await bootstrapper.bootstrap(app, providers, additionalOptions);
	} catch (e) {
		if (!bootstrapper.appOptions.silent) {
			console.log('Error while bootstrapping Alterior app:');
			console.error(e);
		}

		throw e;
	}
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

	/**
	 * Bootstrap the given application into an application instance.
	 * @param app 
	 * @param providers 
	 * @param additionalOptions 
	 */
	public async bootstrap(app : Function, providers = [], additionalOptions? : ApplicationOptions): Promise<ApplicationInstance> {

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

		let controllers : any[] = this.appOptions.controllers;
		if (this.appOptions.autoRegisterControllers)
			controllers = CONTROLLER_CLASSES.slice(0);

		// Make our controllers available via DI 
		// (we will instantiate the controllers via DI later)

		this.verboseInfo('registering controllers...');
		providers = providers.concat(controllers);
		controllers.push(app);

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
		providers.push({provide: app, useClass: app});

		// Load asynchronous assets

		this.verboseInfo(`async providers initialized successfully`);

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
		container.bind(appInstance, this.expressApp, this.appOptions.port);

		// Run the application. 

		if (appInstance['altOnInit'])
			appInstance['altOnInit']();

		if (this.appOptions.autostart) {
			if (!this.appOptions.silent)
				console.log(`listening on ${this.appOptions.port}`);
			container.start();
		}

		return container;
	}

	private async initializeController(injector, controller, allRoutes) {
		
		let routes = (new RouteReflector(controller)).routes;
		let controllerInstance = injector.get(controller);

		// Prepare a child injector that inherits from our application injector. 

		let childProviders = [];
		for (let route of routes) {
			(route.options.middleware || [])
				.map((x, i) => {
					if (x == null) {
						throw new Error("Route "+route.path+" provided null middleware at position "+i);
					}
					return x;
				})
				.filter(x => Reflect.getMetadata('alterior:middleware', x) != null)
				.forEach(x => childProviders.push(x));
		}

		let childInjector = injector.resolveAndCreateChild(childProviders);

		// Register all of our routes with Express

		for (let route of routes) {
			
			allRoutes.push({
				controller: controller,
				route
			});

			// Select the appropriate express "registrar" method (ie get, put, post, delete, patch) 

			let registrar : Function = this.expressApp[route.httpMethod.toLowerCase()];
			let args : any[] = [route.path];

			// Prepare the middlewares (if they are DI middlewares, they get injected)

			(route.options.middleware || [])
				.forEach(x => args.push(prepareMiddleware(childInjector, x)));

			let routeParams = (route.path || "").match(/:([A-Za-z][A-Za-z0-9]*)/g) || [];

			routeParams = routeParams.map(x => x.substr(1));

			// Do analysis of the controller method ahead of time so we can 
			// minimize the amount of overhead of actual web requests

			let returnType = Reflect.getMetadata("design:returntype", controllerInstance.constructor.prototype, route.method);
			let paramTypes = Reflect.getMetadata("design:paramtypes", controllerInstance.constructor.prototype, route.method);
			let paramNames = getParameterNames(controllerInstance[route.method]);
			let paramFactories = [];

			if (paramTypes) {
				for (let i = 0, max = paramNames.length; i < max; ++i) {
					let paramName = paramNames[i];
					let paramType = paramTypes[i];
					let simpleTypes = [String, Number];

					if (paramType === RouteEvent) {
						paramFactories.push(ev => ev);
					} else if (paramName === "body") {
						paramFactories.push((ev : RouteEvent) => ev.request['body']);
					} else if (paramName === "session") {
						paramFactories.push((ev : RouteEvent) => ev.request['session']);
					} else if (paramName === "req" || paramName === "request") {
						paramFactories.push((ev : RouteEvent) => ev.request);
					} else if (paramName === "res" || paramName === "response") {
						paramFactories.push((ev : RouteEvent) => ev.response);
					} else if (routeParams.find(x => x == paramName) && simpleTypes.indexOf(paramType) >= 0) {
						// This is a route parameter binding.
						paramFactories.push((ev : RouteEvent) => ev.request.params[paramName]);
					} else {
						throw new Error(
							`Unable to fulfill route method parameter '${paramName}' of type '${paramType.name}'\r\n`
							+ `While preparing route ${route.method} ${route.path} with method ${route.method}()`
						);
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
					console.log(`[${new Date().toLocaleString()}] ${route.path} => ${controller.name}.${route.method}()`);

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