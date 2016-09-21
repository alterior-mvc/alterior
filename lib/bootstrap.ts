import 'reflect-metadata';

import { AppOptions, ApplicationOptions, ApplicationInstance } from './application';
import { controllerClasses } from './controller';
import { Middleware, prepareMiddleware } from './middleware';
import { RouteReflector } from './route';
import { ExpressRef } from './express';
import { HttpException } from './errors';

import * as express from 'express';
import { ReflectiveInjector } from '@angular/core';
import { SanityCheckReporter } from './sanity';
import { ApplicationArgs } from './args';

export function bootstrap(app : Function, providers = []): Promise<ApplicationInstance> {

	// Define the most basic injectables

	let bootstrapProviders = providers;
	providers = [
		SanityCheckReporter,
		ApplicationArgs
	];

	// Then pile on providers from our bootstrap call

	bootstrapProviders.forEach(x => providers.push(x));

	// Read an @AppOptions() decorator if any, and merge providers from it 
	// into the bootstrapped providers

	let appOptions = <ApplicationOptions>Reflect.getMetadata("slvr:Application", app) || {};
	let verbose = appOptions.verbose || false;
	let silent = appOptions.silent || false;

	(appOptions.providers || [])
		.filter(x => !x['then'])
		.forEach(x => providers.push(x));

	let asyncProviders = (appOptions.providers || []).filter(x => x['then']);
	let port = appOptions.port || 3000;

	// Determine our set of controller classes.
	// It may be provided via @AppOptions(), or it may
	// be provided by the controllers module (which exports a list of all
	// loaded classes that have @Controller() on them)

	let controllers : any[] = appOptions.controllers || [];
	if (appOptions.autoregisterControllers)
		controllers = controllerClasses.slice(0);

	// Make our controllers available via DI 
	// (we will instantiate the controllers via DI later)

	(appOptions.controllers || [])
		.forEach(x => providers.push(x));

	// Make global middleware available via DI

	(appOptions.middleware || [])
		.filter(x => Reflect.getMetadata('slvr:middleware', x) != null)
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

			// Create the injector. 
			// This is where the magic of DI happens. 

			let injector = ReflectiveInjector.resolveAndCreate(providers);
			
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
						.filter(x => Reflect.getMetadata('slvr:middleware', x) != null)
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

					// Append the actual controller method

					args.push((req, res) => {

						if (!silent)
							console.log(`[${new Date().toLocaleString()}] ${route.path} => ${controller.name}.${route.method}()`);

						let result = controllerInstance[route.method](req, res);

						if (!result)
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

			if (!silent) 
				console.log(`listening on ${port}`);

			let server = expressApp.listen(port);
			return new ApplicationInstance(appInstance, expressApp, server);
		}).catch(e => {
			console.log('error while initializing');
			console.error(e);
			process.exit(1);
			throw e;
		});
}
