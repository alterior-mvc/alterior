import 'reflect-metadata';
import * as express from "express";
import * as http from "http";

// require('reflect-metadata');

import { accessControl } from './accesscontrol';
import { controllerClasses } from './controllers';
import { ReflectiveInjector, Provider } from '@angular/core';
import { mongoSession } from './sessions';
import * as mongodb from 'mongodb';
import { RouteReflector } from './controllers';
import { MongoClientFactory } from './mongo';
import { ExpressRef } from './express';
import { prepareMiddleware } from './middleware';

export interface OnSanityCheck {
	/**
	 * Perform a sanity check to see that this service would be healthy, if started.
	 */
	altOnSanityCheck() : Promise<boolean>;
}

export interface OnInit {
	altOnInit(); 
}

export interface ApplicationOptions {
	providers? : Provider[];
	middleware? : (Function | [string, Function])[];
	controllers? : Function[];
	asyncProviders?: Promise<Provider>[];
	autoregisterControllers? : boolean;
}

export function AppOptions(appOptions? : ApplicationOptions) {
	if (!appOptions) 
		appOptions = {};
	
	return function(target) {
		Reflect.defineMetadata("slvr:Application", appOptions, target);
	}
}

export function bootstrap(app : Function, providers = []): Promise<ApplicationInstance> {

	// Read an @AppOptions() decorator if any, and merge providers from it 
	// into the bootstrapped providers

	console.log('options');
	let appOptions = <ApplicationOptions>Reflect.getMetadata("slvr:Application", app);
	(appOptions.providers || [])
		.forEach(x => providers.push(x));

	// Determine our set of controller classes.
	// It may be provided via @AppOptions(), or it may
	// be provided by the controllers module (which exports a list of all
	// loaded classes that have @Controller() on them)

	console.log('controller-classes');
	let controllers : any[] = appOptions.controllers || [];
	if (appOptions.autoregisterControllers)
		controllers = controllerClasses.slice(0);

	// Make our controllers available via DI 
	// (we will instantiate the controllers via DI later)

	console.log('controller-di');
	(appOptions.controllers || [])
		.forEach(x => providers.push(x));

	// Make global middleware available via DI

	console.log('middleware-di');
	(appOptions.middleware || [])
		.filter(x => Reflect.getMetadata('slvr:middleware', x) != null)
		.forEach(x => providers.push(x))
	;

	console.log('app-di');
	providers.push({provide: app, useClass: app});

	// Construct an express app

	let expressApp = express();

	// Make Express available via DI

	console.log('express-di');
	providers.push({
		provide: ExpressRef,
		useValue: {application: expressApp} 
	});

	// Load asynchronous assets

	console.log('async-di');
	return Promise
		.all(appOptions.asyncProviders || [])
		.catch(e => {
			console.log('error while resolving async providers');
			console.error(e);
			process.exit(1);
			throw e;
		})
		.then(resolvedProviders => resolvedProviders.forEach(x => providers.push(x)))
		.then(() => {
			console.log('async-di complete');

			// Create the injector. 
			// This is where the magic of DI happens. 

			console.log(providers);
			console.log('injector...');
			let injector = ReflectiveInjector.resolveAndCreate(providers);
			
			console.log('get app instance');
			let appInstance = injector.get(app);

			// Install global middleware

			console.log('install global middleware');
			(appOptions.middleware || []).forEach(x => {
				if ('name' in x)
					expressApp.use(<any>prepareMiddleware(injector, x));
				else
					expressApp.use(x[0], prepareMiddleware(injector, x[1]));
			});

			// Instantiate all the controllers in the application, and register
			// their respective routed methods with the express app we made before.

			console.log('instantiate controllers');
			for (let controller of controllers) {
				console.log('controller '+controller.name);
				let routes = (new RouteReflector(controller)).routes;
				let controllerInstance = injector.get(controller);

				// Prepare a child injector that inherits from our application injector. 

				console.log('- child-injector');
				let childProviders = [];
				for (let route of routes) {
					(route.options.middleware || [])
						.filter(x => Reflect.getMetadata('slvr:middleware', x) != null)
						.forEach(x => childProviders.push(x));
				}

				let childInjector = injector.resolveAndCreateChild(childProviders);

				// Register all of our routes with Express

				console.log('- routes');
				for (let route of routes) {
					
					// Select the appropriate express "registrar" method (ie get, put, post, delete, patch) 

					console.log('  route '+route.httpMethod.toLowerCase()+':'+route.path);

					let registrar : Function = expressApp[route.httpMethod.toLowerCase()];
					let args : any[] = [route.path];

					// Prepare the middlewares (if they are DI middlewares, they get injected)

					console.log('  - middleware-prep');
					(route.options.middleware || [])
						.forEach(x => args.push(prepareMiddleware(childInjector, x)));

					// Append the actual controller method

					console.log('  - middleware-di');
					args.push((req, res) => controllerInstance[route.method](req, res));

					// Send into express (registrar is one of express.get, express.put, express.post etc)

					console.log('  - register route');
					console.log(registrar);
					console.log(args);
					registrar.apply(expressApp, args);
				}
			}

			// Framework is booted.

			console.log('alterior booted successfully');

			// Self-testing mechanism 

			if (process.argv.length >= 3 && process.argv[2] == "test") {

				new Promise((resolve, reject) => {
					if (app['altOnSanityCheck']) {
						return app['altOnSanityCheck']();
					}
				}).then(result => {
					if (!result)
						throw "Check returned false";
					
					console.log('App passed the sanity check.');
					process.exit(99);
				}).catch(e => {
					console.log('App failed the sanity check.');
					console.log(e);
					process.exit(1);
				});
				return;
			}

			// Run the application.

			console.log('listening on 3000');
			let server = expressApp.listen(3000);
			return new ApplicationInstance(app, expressApp, server);
		}).catch(e => {
			console.log('error while initializing');
			console.error(e);
			process.exit(1);
			throw e;
		});
}

export class ApplicationInstance {
	constructor(
		public app : any, 
		public express : express.Application,
		public http : http.Server
	) {

	}

	public shutdown() {
		// TODO: maybe https://www.npmjs.com/package/express-graceful-exit ?
		process.exit();
	}
}

export class ApplicationBase { 

	protected openAccessControl : boolean = true;

	constructor(config : any) {
		this.config = config;
		this.express = express();

		if (this.openAccessControl)
			this.express.use(accessControl);
		
		this.express.use('/static', express.static(config.uploadsPath));
	}

	public run() {
		this.initMongo().then(() => {
			this.initExpress();
			this.listen();
		}).catch(err => {
			console.error("error connecting to mongo");
			console.log(err);
			process.exit(1);
		})

	}

	private initExpress() {
		
		console.log("express init'ed");
		this.express.use(mongoSession(null));
		this.express.get('/', (req, res) => this.homeAction(req, res));

		console.log("controllers:");
		console.log(controllerClasses);

		this.controllers = controllerClasses.map(x => new x(this));
	}

	private controllers : any[];

	private initMongo(): Promise<void> {

		const mongoURL = "mongodb://localhost:27017/db";
		return <any>mongodb.MongoClient.connect(mongoURL)
			.then(db => this.db = db);
	}

	private listen() {
		console.log("listen");
		const apiPort = 3000;
		this.express.listen(apiPort, () => {
			console.log('Sliptap API listening on port 3000!');
		}); 
	}

	public homeAction(req : express.Request, res : express.Response) {
		res.send('@sliptap/backend.user-service');
	}

	public express : express.Application;
	public db : mongodb.Db;
	public config : any;


	public isAdmin(req): boolean {
		console.log('## admin check : starting ##');

		if (!req.session)
			return false;

		console.log('admin check : has session');

		console.log(req.session);
		if (!req.session.user)
			return false;

		console.log('admin check : has user');

		if (!req.session.user.isAdmin)
			return false;

		console.log('admin check : is admin');

		return true;
	}

	public init()
	{

	}
}