import * as getParameterNames from '@avejidah/get-parameter-names';
import * as express from 'express';

import { ExpressRef } from "./express-ref";
import { Provider, ReflectiveInjector, Injector } from "injection-js";
import { prepareMiddleware } from "./middleware";
import { RouteReflector, MountOptions, RouteEvent } from "./route";
import { HttpException } from "@alterior/common";
import { RouteDefinition } from "./route";
import { Server } from 'http';
import { Response } from './response';
import { Annotations, Annotation } from '@alterior/annotations';

export class InputOptions {
	type : string;
	name : string;
}

/**
 * Should be attached to a parameter to indicate how it should be fulfilled given the current
 * HTTP request.
 */
export class InputAnnotation extends Annotation {
	constructor(options : InputOptions) {
		super(options);
	}

	type : string;
	name : string;
}

/**
 * Apply to a parameter to indicate that it represents a query parameter (ie foo in /bar?foo=1)
 * @param name 
 */
export function Query(name : string) {
	return InputAnnotation.decorator({
		factory: () => {
			return new InputAnnotation({ type: 'query', name })
		}
	})();
}

/**
 * Apply to a parameter to indicate that it represents a path parameter (ie 'thing' in /hello/:thing)
 * @param name 
 */
export function PathParam(name : string) {
	return InputAnnotation.decorator({
		factory: () => {
			return new InputAnnotation({ type: 'path', name })
		}
	})();
}

/**
 * Apply to a parameter to indicate that it represents the body of the request. 
 */
export function Body() {
	return InputAnnotation.decorator({
		factory: () => {
			return new InputAnnotation({ type: 'body', name: '' })
		}
	})();
}

export interface WebServerOptions {
    port? : number;
    middleware? : Function[];
    hideExceptions? : boolean;
    verbose? : boolean;
    silent? : boolean;
}

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

export interface ControllerContext {
	pathPrefix? : string;

	/* PRIVATE */

	visited? : any[];
}

const EXPRESS_SUPPORTED_METHODS = [ 
	"checkout", "copy", "delete", "get", "head", "lock", "merge", 
	"mkactivity", "mkcol", "move", "m-search", "notify", "options", 
	"patch", "post", "purge", "put", "report", "search", "subscribe", 
	"trace", "unlock", "unsubscribe",
];

/**
 * Implements a web server which is comprised of a set of Controllers.
 */
export class WebServer {
    constructor(
        injector : Injector,
        controllers : Function[],
        options : WebServerOptions
    ) {
        this.options = options || {};
        this.bootstrap(injector, controllers);
    }

    readonly options : WebServerOptions;
    private expressApp : express.Application;
    private expressServer : Server;

    start() {
        this.expressServer = this.express.listen(this.options.port || 3000);
    }

    stop() {
		if (!this.expressServer)
			return;
		
		this.expressServer.close();
    }

    public get express() {
        return this.expressApp;
    }

	private verboseInfo(...args) {
		if (this.options.verbose) {
			console.info(...args);
		}
	}

	private verboseDir(...args) {
		if (this.options.verbose) {
			console.dir(...args);
		}
    }
    
    private installGlobalMiddleware(injector) {
        let middlewares = this.options.middleware || [];
        for (let middleware of middlewares) {
            middleware = prepareMiddleware(injector, middleware);
            this.expressApp.use(middleware as any);
        }
    }

	private _serviceDescription : ServiceDescription = {
		routes: [],
		version: '0.0.0'
	};

	get serviceDescription() {
		return this._serviceDescription;
    }
    
    private bootstrap(injector : Injector, controllers : Function[]) {

		let providers : Provider[] = [];
		
		this.expressApp = express();

		// Determine our set of controller classes.

        providers = providers.concat(controllers);

        let ownInjector = ReflectiveInjector.resolveAndCreate(providers, injector);
        
        this.installGlobalMiddleware(ownInjector);
        
		let allRoutes = [];
		this.verboseInfo(`initializing routes...`);

		for (let controller of controllers) {
			this.verboseInfo(`Registering controller ${controller.name || controller}`);
			this.initializeController(ownInjector, controller, allRoutes);
		}
    }
    
	private async initializeController(injector : Injector, controller : Function, allRoutes : any[], context? : ControllerContext) {

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
				mountInjector = ReflectiveInjector.resolveAndCreate(providers, injector);
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

			let middlewareProviders : Provider[] = middleware.filter(x => Reflect.getMetadata('alterior:middleware', x));
			let childInjector = ReflectiveInjector.resolveAndCreate(middlewareProviders, injector);

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
				let paramAnnotations = Annotations.getParameterAnnotations(controller, route.method, false);

				for (let i = 0, max = paramNames.length; i < max; ++i) {
					let paramName = paramNames[i];
					let paramType = paramTypes[i];
					let simpleTypes = [String, Number];
					let paramDesc : RouteParamDescription = null;

					let inputAnnotation = paramAnnotations[i].find(x => x instanceof InputAnnotation) as InputAnnotation;

					// TODO:
					// - Require @Param() on path parameters, but inflect 
					//   missing value from function definition
					// - Support @Inject() on parameters

					if (inputAnnotation) {
						let inputName = paramName;
						if (inputAnnotation.name)
							inputName = inputAnnotation.name;

						if (inputAnnotation.type === 'body') {
							paramFactories.push((ev : RouteEvent) => ev.request['body']);
							paramDesc = {
								name: 'body',
								type: 'body',
								description: `An instance of ${paramType}`
							};
						} else if (inputAnnotation.type === 'path') {
							// This is a route parameter binding.

							paramFactories.push((ev : RouteEvent) => ev.request.params[inputName]);

							// Add documentation information via reflection.

							let paramDesc : RouteParamDescription = pathParameterMap[inputName];
							if (!paramDesc) {
								pathParameterMap[inputName] = paramDesc = { 
									name: inputName, type: 'path' 
								};
								routeDescription.parameters.push(paramDesc);
							}

							// Decorate the parameter description with reflection info
							paramDesc.description = `An instance of ${paramType}`;

						} else if (inputAnnotation.type === 'query') {
							
							// This is a query parameter binding.

							paramFactories.push((ev : RouteEvent) => ev.request.query[inputName]);

							// Add documentation information via reflection.

							let paramDesc : RouteParamDescription = pathParameterMap[inputName];
							if (!paramDesc) {
								pathParameterMap[inputName] = paramDesc = { 
									name: inputName, type: 'query' 
								};
								routeDescription.parameters.push(paramDesc);
							}
						}
					} else if (paramType === RouteEvent) {
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
						if (!this.options.silent) {
							console.error(`Exception while handling route ${route.path} via method ${controller.name}.${route.method}():`);
							console.error(e);
						}
						
						let response : any = {
							message: 'An exception occurred while handling this request.'
						};

						if (!this.options.hideExceptions) {
							if (e.constructor === Error)
								response.error = e.stack;
							else
								response.error = e;
						}

						res.status(500).send(JSON.stringify(response));
					}
				}

				if (!this.options.silent)
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
					if (result === undefined) {
						res.end();
						return;
					}

					if (result === null) {
						res	.status(200)
							.header('Content-Type', 'application/json')
							.send(JSON.stringify(result))
						;
						return;
					}

					try {
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
					} catch (e) {
						console.error(`Caught exception:`);
						console.error(e);

						throw e;
					}
				};

				await handleResponse(result);
			});

			// Send into express (registrar is one of express.get, express.put, express.post etc)

			this.verboseInfo(`   |- registering route ${loweredMethod.toUpperCase()} ${args[0]}`);
			registrar.apply(this.expressApp, args);
		}
	}
}