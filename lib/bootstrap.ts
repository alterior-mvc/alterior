import 'reflect-metadata';

const getParameterNames = require('@avejidah/get-parameter-names');

import { AppOptions, ApplicationOptions, ApplicationInstance } from './application';
import { controllerClasses } from './controller';
import { Middleware, prepareMiddleware } from './middleware';
import { RouteReflector, RouteEvent } from './route';
import { Response } from './response';
import { ExpressRef } from './express';
import { HttpException } from './errors';

import * as express from 'express';
import { ReflectiveInjector } from '@angular/core';
import { SanityCheckReporter } from './sanity';
import { ApplicationArgs } from './args';

/**
 * Bootstrap an Alterior application.
 */
export function bootstrap(app : Function, providers = [], additionalOptions? : ApplicationOptions): Promise<ApplicationInstance> {

	// Define the most basic injectables

	let bootstrapProviders = providers;
	providers = [
		SanityCheckReporter,
		ApplicationArgs,
		ApplicationInstance
	];

	// Then pile on providers from our bootstrap call

	bootstrapProviders.forEach(x => providers.push(x));

	// Read an @AppOptions() decorator if any, and merge providers from it 
	// into the bootstrapped providers

	let appOptions : ApplicationOptions = {
		autostart: true,
		verbose: false,
		silent: false
	};

	let appProvidedOptions = <ApplicationOptions>Reflect.getMetadata("alterior:Application", app) || {};
	
	for (let key in appProvidedOptions)
		appOptions[key] = appProvidedOptions[key];
		 
	for (let key in additionalOptions)
		appOptions[key] = additionalOptions[key];

	let autostart = appOptions.autostart;
	let verbose = appOptions.verbose;
	let silent = appOptions.silent;

	(appOptions.providers || [])
		.filter(x => !x['then'])
		.forEach(x => providers.push(x));

	let asyncProviders = (appOptions.providers || []).filter(x => x['then']);
	let port = appOptions.port || 3000;

	// Determine our set of controller classes.
	// It may be provided via @AppOptions(), or it may
	// be provided by the controllers module (which exports a list of all
	// loaded classes that have @Controller() on them)

	let autoRegisterControllers = true;
	let controllers : any[] = appOptions.controllers || [];

	if ("autoRegisterControllers" in appOptions)
		autoRegisterControllers = appOptions.autoRegisterControllers;
	
	if (autoRegisterControllers)
		controllers = controllerClasses.slice(0);

	// Make our controllers available via DI 
	// (we will instantiate the controllers via DI later)

	(controllers || [])
		.forEach(x => providers.push(x));

	// Make global middleware available via DI

	(appOptions.middleware || [])
		.filter(x => Reflect.getMetadata('alterior:middleware', x) != null)
		.forEach(x => providers.push(x))
	;

	providers.push({provide: app, useClass: app});

	// Construct an express app

	let expressApp = express();

	// Make Express available via DI

	providers.push({
		provide: ExpressRef,
		useValue: {application: expressApp} 
	});

	// Load asynchronous assets

	return Promise
		.all(asyncProviders || [])
		.catch(e => {
			console.error(e);
			process.exit(1);
			throw e;
		})
		.then(resolvedProviders => resolvedProviders.forEach(x => providers.push(x)))
		.then(() => {

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

			(appOptions.middleware || []).forEach(x => {
				if ('name' in x)
					expressApp.use(<any>prepareMiddleware(injector, x));
				else
					expressApp.use(x[0], prepareMiddleware(injector, x[1]));
			});

			// Instantiate all the controllers in the application, and register
			// their respective routed methods with the express app we made before.

			let allRoutes = [];

			for (let controller of controllers) {
				let routes = (new RouteReflector(controller)).routes;
				let controllerInstance = injector.get(controller);

				// Prepare a child injector that inherits from our application injector. 

				let childProviders = [];
				for (let route of routes) {
					(route.options.middleware || [])
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

					let registrar : Function = expressApp[route.httpMethod.toLowerCase()];
					let args : any[] = [route.path];

					// Prepare the middlewares (if they are DI middlewares, they get injected)

					(route.options.middleware || [])
						.forEach(x => args.push(prepareMiddleware(childInjector, x)));

					let routeParams = (route.path || "").match(/:([A-Za-z][A-Za-z0-9]*)/) || [];

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
								throw new Error(`Unable to fulfill route method parameter '${paramName}' of type '${paramType.name}'`);
							}

						}
					} else {
						paramFactories = [
							(ev : RouteEvent) => ev.request, 
							(ev : RouteEvent) => ev.response
						];
					}

					// Append the actual controller method

					args.push((req : express.Request, res : express.Response) => {
 
						if (!silent)
							console.log(`[${new Date().toLocaleString()}] ${route.path} => ${controller.name}.${route.method}()`);

						// Execute our function by resolving the parameter factories into a set of parameters to provide to the 
						// function.

						let ev = new RouteEvent(req, res);
						let result;
						
						try {
							result = controllerInstance[route.method].apply(controllerInstance, paramFactories.map(x => x(ev)));
						} catch (e) {
							if (e.constructor === HttpException) {
								let httpException = <HttpException>e;
								res.status(httpException.statusCode).send(httpException.body);
							} else {
								res.status(500).send(JSON.stringify({
									message: 'Failed to resolve this resource.',
									error: e 
								}));
							}
						}

						// Return value handling

						if (result === undefined)
							return;

						if (result.then) {
							result = <Promise<any>>result;
							result.then(result => {
								if (typeof result === 'object')
									result = JSON.stringify(result);

								res.status(200).header('Content-Type', 'application/json').send(result);
							}).catch(e => {
								if (e.constructor === HttpException) {
									let httpException = <HttpException>e;
									res.status(httpException.statusCode).send(httpException.body);
								} else {
									res.status(500).send(JSON.stringify({
										message: 'Failed to resolve this resource.',
										error: e 
									}));
								}
							});
						} else if (result.constructor === Response) {
							let response = <Response>result;
							res.status(response.status);
							response.headers.forEach(x => res.header(x[0], x[1]));
							res.send(response.body); 
						} else {
							res.status(200).header('Content-Type', 'application/json').send(JSON.stringify(result));
						}

					});

					// Send into express (registrar is one of express.get, express.put, express.post etc)

					registrar.apply(expressApp, args);
				}
			}

			// Framework is booted.

			if (verbose) {
				console.log('alterior booted successfully');
				console.log(allRoutes);
			}


			// Self-testing mechanism 

			let argsService = <ApplicationArgs>injector.get(ApplicationArgs);
			let args = argsService.get();

			if (args.length > 0 && args[0] == "test") {
				let reporter = <SanityCheckReporter>injector.get(SanityCheckReporter);

				Promise.resolve(true)
				.then(() => {
					if (appInstance['altOnSanityCheck']) {
						return appInstance['altOnSanityCheck']();
					}

					return true;
				}).then(result => {
					if (!result)
						throw "Check returned false";
					
					reporter.reportSuccess();
				}).catch(e => {
					reporter.reportFailure(e);
				});
				return;
			}

			// Run the application. 

			if (appInstance['altOnInit'])
				appInstance['altOnInit']();

			let container = <ApplicationInstance>injector.get(ApplicationInstance);
			container.bind(appInstance, expressApp, port);

			if (autostart) {
				if (!silent)
					console.log(`listening on ${port}`);
				container.start();
			}

			return container;
		}).catch(e => {
			console.log('error while initializing');
			console.error(e);
			//process.exit(1);
			throw e;
		});
}
