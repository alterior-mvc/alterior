import { AppOptions, ApplicationOptions, ApplicationInstance } from './application';
import { controllerClasses } from './controller';
import { Middleware, prepareMiddleware } from './middleware';
import { RouteReflector } from './route';

export function bootstrap(app : Function, providers = []): Promise<ApplicationInstance> {

	// Read an @AppOptions() decorator if any, and merge providers from it 
	// into the bootstrapped providers

	console.log('options');
	let appOptions = <ApplicationOptions>Reflect.getMetadata("slvr:Application", app);
	(appOptions.providers || [])
		.filter(x => !x['then'])
		.forEach(x => providers.push(x));

	let asyncProviders = (appOptions.providers || []).filter(x => x['then']);

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
		.all(asyncProviders || [])
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
