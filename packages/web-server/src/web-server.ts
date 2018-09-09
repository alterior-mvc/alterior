import * as getParameterNames from '@avejidah/get-parameter-names';
import * as express from 'express';

import { Provider, ReflectiveInjector, Injector } from "injection-js";
import { prepareMiddleware } from "./middleware";
import { RouteReflector, MountOptions, RouteEvent } from "./route";
import { HttpError, BaseErrorT } from "@alterior/common";
import { RouteDefinition } from "./route";
import { Server } from 'http';
import { Response } from './response';
import { Annotations, IAnnotation } from '@alterior/annotations';
import { ControllerAnnotation, ControllerOptions } from './controller';
import { InputAnnotation } from './input';

export class WebServerSetupError extends BaseErrorT {
}

export interface WebServerOptions {
    port? : number;
    middleware? : Function[];
    hideExceptions? : boolean;
    verbose? : boolean;
	silent? : boolean;
	onError? : (error : any, event : RouteEvent, route : RouteInstance, source : string) => void;
	handleError? : (error : any, event : RouteEvent, route : RouteInstance, source : string) => void;
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

	handleError(error : any, event : RouteEvent, route : RouteInstance, source : string) {

		if (this.options.onError) {
			this.options.onError(error, event, route, source);
		}

		if (this.options.handleError) {
			this.options.handleError(error, event, route, source);
			return;
		}

		if (!this.options.silent) {
			console.error(`Error handling request '${event.request.path}'`);
			console.error(`Handled by: ${source}`);
			console.error(error);
		}

		let response : any = {
			message: 'An exception occurred while handling this request.'
		};

		if (!this.options.hideExceptions) {
			if (error.constructor === Error)
				response.error = error.stack;
			else
				response.error = error;
		}

		event.response
			.status(500)
			.send(JSON.stringify(response))
		;
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
	
	private _controllers : ControllerInstance[] = [];

	public get controllers() {
		return this._controllers.slice();
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
			this._controllers.push(new ControllerInstance(this, controller, ownInjector, allRoutes));
			//this.initializeController(ownInjector, controller, allRoutes);
		}

		this.controllers.forEach(c => c.mount(this.expressApp));
    }
}

export interface ControllerContext {
	pathPrefix? : string;

	/* PRIVATE */

	visited? : any[];
}

/**
 * Represents an instance of a controller, which can be used to handle requests.
 */
export class ControllerInstance {
	constructor(
		readonly server : WebServer,
		readonly type : Function, 
		readonly injector : Injector, 
		readonly routeTable : any[], 
		context? : ControllerContext
	) {
		this.setContext(context);
		this.prepare();
	}

	private _instance : any;

	get instance() {
		return this._instance;
	}

	private setContext(context : ControllerContext) {
		if (!context)
			context = {};

		if (!context.pathPrefix)
			context.pathPrefix = '';
	
		if (!context.visited)
			context.visited = [];

		if (context.visited.includes(this.type)) {
			console.warn(`Controller visited multiple times and skipped. May indicate recursion.`);
			return;
		}
		
		context.visited.push(this.type);
		this._context = context;
	}

	private _context : ControllerContext;
	get context() {
		return this._context;
	}

	private prepare() {
		this._instance = this.injector.get(this.type);

		// Reflect upon our routes


		let routeReflector = new RouteReflector(this.type, this.context.pathPrefix);
		let routeDefinitions = routeReflector.routes;
		let controllerMetadata = ControllerAnnotation.getForClass(this.type);
		let controllerOptions = controllerMetadata ? controllerMetadata.options : {} || {};
		this._options = controllerOptions;

		for (let mount of routeReflector.mounts) {
			let providers : Provider[] = (mount.options || {} as MountOptions).providers || [];
			let controllers = (mount.controllers || []).slice();
			let controllerType = Reflect.getMetadata('design:type', this.type.prototype, mount.propertyKey);
			
			if (typeof controllerType === 'function' && controllerType !== Object)
				controllers.push(controllerType);

			providers.push(...(controllers as Provider[]));

			let mountInjector : ReflectiveInjector;
			
			try {
				mountInjector = ReflectiveInjector.resolveAndCreate(providers, this.injector);
			} catch (e) {
				console.error(`Failed to resolve and create dependency injector for mount with path '${mount.path}'`);
				console.error(e);
				throw e;
			}

			for (let controller of controllers) {
				this.controllers.push(new ControllerInstance(this.server, controller, mountInjector, this.routeTable, {
					pathPrefix: `${this.context.pathPrefix.replace(/\/+$/g, '')}/${mount.path.replace(/^\/+/g, '')}`
				}));
			}
		}

		// Register all of our routes with Express

		this._routes = routeDefinitions.map(definition => new RouteInstance(this, definition));
	}

	private _routes : RouteInstance[];

	get routes() {
		return this._routes;
	}

	private _controllers : ControllerInstance[] = [];

	get controllers() {
		return this._controllers;
	}

	private _options : ControllerOptions;

	get options() {
		return this._options;
	}

	get group(): string {
		let controllerGroup : string = undefined;
		
		if (this._options && this._options.group) {
			controllerGroup = this._options.group;
		} else {
			controllerGroup = this.type.name.replace(/Controller$/, '');
			controllerGroup = controllerGroup.charAt(0).toLowerCase()+controllerGroup.slice(1);
		}

		return controllerGroup;
	}

	mount(app : express.Application) {
		this.routes.forEach(r => r.mount(app));
		this.controllers.forEach(c => c.mount(app));
	}
}

export interface RouteMethodMetadata {
	returnType : any;
	paramTypes : any[];
	paramNames : any[];
	pathParamNames : any[];
	paramAnnotations : IAnnotation[][];
}

export class RouteMethodParameter<T = any> {
	constructor(
		readonly route : RouteInstance,
		readonly target : Function,
		readonly methodName : string,
		readonly index : number,
		readonly name : string,
		readonly type : any,
		readonly annotations : IAnnotation[]
	) {
		this.prepare();
	}

	get inputAnnotation() {
		return this.annotations.find(x => x instanceof InputAnnotation) as InputAnnotation;
	}
	
	private _factory : (ev : RouteEvent) => Promise<T>;
	public get factory() {
		return this._factory;
	}

	async resolve(ev : RouteEvent) {
		return await this._factory(ev);
	}

	private _description : RouteParamDescription;

	get description() {
		return this._description;
	}

	prepare() {
		let inputAnnotation = this.inputAnnotation;
		let paramName = this.name;
		let factory = null;
		let paramDesc = null;
		let paramType = this.type;
		let route = this.route;
		let simpleTypes = [String, Number];

		if (inputAnnotation) {
			let inputName = paramName;
			if (inputAnnotation.name)
				inputName = inputAnnotation.name;

			if (inputAnnotation.type === 'body') {
				factory = (ev : RouteEvent) => ev.request['body'];
				paramDesc = {
					name: 'body',
					type: 'body',
					description: `An instance of ${paramType}`
				};
			} else if (inputAnnotation.type === 'path') {
				// This is a route parameter binding.

				factory = (ev : RouteEvent) => ev.request.params[inputName];

				// Add documentation information via reflection.

				paramDesc = route.pathParameterMap[inputName];
				if (!paramDesc) {
					route.pathParameterMap[inputName] = paramDesc = { 
						name: inputName, type: 'path' 
					};
				}

				// Decorate the parameter description with reflection info
				paramDesc.description = `An instance of ${paramType}`;

			} else if (inputAnnotation.type === 'query') {
				
				// This is a query parameter binding.

				factory = (ev : RouteEvent) => ev.request.query[inputName];

				// Add documentation information via reflection.

				paramDesc = this.route.pathParameterMap[inputName];
				if (!paramDesc) {
					this.route.pathParameterMap[inputName] = paramDesc = { 
						name: inputName, type: 'query' 
					};
				}
			} else if (inputAnnotation.type === 'session') {

				if (inputAnnotation.name)
					factory = (ev : RouteEvent) => (ev.request['session'] || {})[inputAnnotation.name];
				else
					factory = (ev : RouteEvent) => ev.request['session'];

				paramDesc = {
					name: inputAnnotation.name || '',
					type: 'session',
					description: `An instance of ${paramType}`
				};
			}
		} else if (paramType === RouteEvent) {
			factory = ev => ev;
		} else if (paramName === "body") {
			factory = (ev : RouteEvent) => ev.request['body'];
			paramDesc = {
				name: 'body',
				type: 'body',
				description: `An instance of ${paramType}`
			};
		} else if (paramName === "session") {
			factory = (ev : RouteEvent) => ev.request['session'];
			
			paramDesc = {
				name: 'session',
				type: 'session',
				description: `An instance of ${paramType}`
			};
		} else if (this.route.params.find(x => x == paramName) && simpleTypes.indexOf(paramType) >= 0) {

			// This is a route parameter binding.

			factory = (ev : RouteEvent) => ev.request.params[paramName];

			// Add documentation information via reflection.

			let paramDesc : RouteParamDescription = this.route.pathParameterMap[paramName];
			if (!paramDesc) {
				this.route.pathParameterMap[paramName] = paramDesc = { 
					name: paramName, type: 'path' 
				};
			}

			// Decorate the parameter description with reflection info

			paramDesc.description = `An instance of ${paramType}`;
		} else {
			let sanitizedType = paramType ? (paramType.name || '<unknown>') : '<undefined>';
			throw new Error(
				`Unable to fulfill route method parameter '${paramName}' of type '${sanitizedType}'\r\n`
				+ `While preparing route ${this.route.definition.method} ${this.route.definition.path} ` 
				+ `with method ${this.route.definition.method}()`
			);
		}

		this._factory = factory;
		this._description = paramDesc;
	}
}

/**
 * Represents a Route instance
 */
export class RouteInstance {
	constructor(
		readonly controller : ControllerInstance,
		readonly definition : RouteDefinition) 
	{
		this.prepare();
	}

	get serverOptions() {
		return this.controller.server.options;
	}

	get params() {
		return this._params;
	}

	private _params : string[];

	private prepare() {
		
		// Add it to the global route list

		this.controller.routeTable.push({
			controller: this.controller.type,
			route: this.definition
		});

		let routeParams = (this.definition.path || "").match(/:([A-Za-z][A-Za-z0-9]*)/g) || [];
		this._params = routeParams.map(x => x.substr(1));

		this.prepareMiddleware();
		this.prepareMethodMetadata();
		this.prepareParameters();
		this.prepareMetadata();
	}

	get options() {
		return this.definition.options || {};
	}

	get group(): string {
		return this.options.group || this.controller.group;
	}

	private _pathParameterMap = {};

	get pathParameterMap() {
		return this._pathParameterMap;
	}

	private prepareMetadata() {
		let route = this.definition;
		let routeDescription : RouteDescription = {
			definition: route,
			httpMethod: route.httpMethod,
			group: this.group,
			method: route.method,
			path: route.path,
			parameters: []
		};

		routeDescription.parameters.push(
			...this._methodMetadata.pathParamNames
				.map(id => <RouteParamDescription>{
					name: id.replace(/^:/, ''),
					type: 'path'
				})
				.map(desc => this.pathParameterMap[desc.name] = desc)
		);

		this._description = routeDescription;
	}

	private _description : RouteDescription;

	public get description() {
		return this._description;
	}

	private prepareMiddleware() {
		
		// Load up the defined middleware for this route
		let route = this.definition;
		let controllerOptions = this.controller.options;
		
		let middleware = [].concat(route.options.middleware || []);
		if (controllerOptions.middleware)
			middleware = [].concat(controllerOptions.middleware, middleware);

		// Ensure indexes are valid.

		let invalidIndex = middleware.findIndex(x => !x);
		if (invalidIndex >= 0)
			throw new Error(`Route '${route.path}' provided null middleware at position ${invalidIndex}`);

		// Procure an injector which can handle injecting the middlewares' providers

		let middlewareProviders : Provider[] = middleware.filter(x => Reflect.getMetadata('alterior:middleware', x));
		let childInjector = ReflectiveInjector.resolveAndCreate(middlewareProviders, this.controller.injector);

		let args : any[] = [ route.path ];

		// Prepare the middlewares (if they are DI middlewares, they get injected)

		this.middleware = middleware;
		this.resolvedMiddleware = middleware.map(x => prepareMiddleware(childInjector, x));
	}

	middleware : any[];
	resolvedMiddleware : any[];

	private prepareMethodMetadata() {
		let controller = this.controller.type;
		let route = this.definition;

		let returnType = Reflect.getMetadata("design:returntype", controller.prototype, route.method);
		let paramTypes = Reflect.getMetadata("design:paramtypes", controller.prototype, route.method);
		let paramNames = getParameterNames(controller.prototype[route.method]);

		// Construct a set of easily addressable path parameter descriptions (pathParameterMap)
		// that can be decorated with insights from reflection later.

		let pathParamMatches = route.path.match(/:([A-Za-z0-9]+)/g) || [];
		let pathParamNames = Object.keys(pathParamMatches.reduce((pv, cv) => (pv[cv] = 1, pv), {}));

		this._methodMetadata = {
			returnType,
			paramTypes, 
			paramNames,
			pathParamNames,
			paramAnnotations: Annotations.getParameterAnnotations(controller, route.method, false)
		}
	}

	private _methodMetadata : RouteMethodMetadata;

	get methodMetadata() {
		return this._methodMetadata;
	}

	private prepareParameters() {
		let controller = this.controller.type;
		let route = this.definition;
		let sourceName = `${controller.name || controller}.${route.method}()`;
		let { returnType, paramTypes, paramNames, paramAnnotations } = this._methodMetadata;
		
		let paramFactories = [];
		//let pathParameterMap : any = {};

		if (!paramTypes) {
			paramFactories = [
				(ev : RouteEvent) => ev.request, 
				(ev : RouteEvent) => ev.response
			];
			return;
		}

		for (let i = 0, max = paramNames.length; i < max; ++i) {
			this._parameters.push(new RouteMethodParameter(
				this,
				this.controller.type,
				this.definition.method,
				i, 
				paramNames[i],
				paramTypes[i],
				paramAnnotations[i] || []
			));
		}

		let unresolvedParameters = this._parameters.filter(x => !x.factory);

		if (unresolvedParameters.length > 0) {
			let details = unresolvedParameters
				.map(x => `${x.name} : ${x.type || 'any'} (#${x.index + 1})`)
				.join(', ')
			;

			throw new WebServerSetupError(
				`Could not resolve some method parameters on ${sourceName}: ` 
				+ `${details}`
			);
		}

	}

	_parameters : RouteMethodParameter[] = [];

	get parameters() {
		return this._parameters.slice();
	}

	get server() {
		return this.controller.server;
	}

	async execute(event : RouteEvent) {
		let route = this.definition;
		let controllerInstance = this.controller.instance;
		let controllerType = this.controller.type;

		// Execute our function by resolving the parameter factories into a set of parameters to provide to the 
		// function.

		if (!this.serverOptions.silent)
			console.info(`[${new Date().toLocaleString()}] ${route.path} => ${controllerType.name}.${route.method}()`);

		let result;

		try {
			result = await this.controller.instance[route.method](
				...(await Promise.all(this.parameters.map(x => x.resolve(event))))
			);
		} catch (e) {
			
			if (e.constructor === HttpError) {
				let httpError = <HttpError>e;
				event.response.status(httpError.statusCode);
				
				httpError.headers
					.forEach(header => event.response.header(header[0], header[1]));

				event.response.send(httpError.body);
				return;
			}

			this.server.handleError(e, event, this, `${controllerType.name}.${route.method}()`);
			return;
		}

		// Return value handling

		if (result === undefined) {
			event.response.end();
			return;
		}

		if (result === null) {
			event.response	.status(200)
				.header('Content-Type', 'application/json')
				.send(JSON.stringify(result))
			;
			return;
		}

		try {
			if (result.constructor === Response) {
				let response = <Response>result;
				event.response.status(response.status);
				response.headers.forEach(x => event.response.header(x[0], x[1]));
				event.response.send(response.body); 
			} else {
				event.response	.status(200)
					.header('Content-Type', 'application/json')
					.send(JSON.stringify(result))
				;
			}
		} catch (e) {
			console.error(`Caught exception:`);
			console.error(e);

			throw e;
		}
	}

	private readonly EXPRESS_SUPPORTED_METHODS = [ 
		"checkout", "copy", "delete", "get", "head", "lock", "merge", 
		"mkactivity", "mkcol", "move", "m-search", "notify", "options", 
		"patch", "post", "purge", "put", "report", "search", "subscribe", 
		"trace", "unlock", "unsubscribe",
	];
	
	private get expressRegistrarName() {
		let registrar = this.definition.httpMethod.toLowerCase();
		if (!this.EXPRESS_SUPPORTED_METHODS.includes(registrar))
			throw new Error(`The specified method '${this.definition.httpMethod}' is not supported by Express.`);
			
		return registrar;
	}

	/**
	 * Installs this route into the given Express application. 
	 * @param app 
	 */
	mount(app : express.Application) {
		app[this.expressRegistrarName](
			this.definition.path, 
			...this.resolvedMiddleware, 
			(req, res) => this.execute(new RouteEvent(req, res))
		);
	}
}