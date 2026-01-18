import { WebServer } from "./web-server";
import { Provider, ReflectiveInjector, Injector } from "@alterior/di";
import { RouteInstance } from './route';
import { ControllerAnnotation, ControllerOptions, MountOptions, RouteReflector, MiddlewareDefinition } from "./metadata";
import { prepareMiddleware } from "./middleware";
import { ConnectMiddleware } from "./web-server-engine";

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
		context? : ControllerContext,
		readonly isModule = false
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

	get middleware() {
		let middleware : MiddlewareDefinition[] = [];
		if (this.options.middleware)
			middleware = middleware.concat(this.options.middleware);
		if (this.options.globalMiddleware)
			middleware = middleware.concat(this.options.globalMiddleware);

		return middleware;
	}

	combinePaths(...paths) {
		let finalPath = '';

		for (let path of paths) {
			let segment = path ? path.replace(/^\/|\/$/g, '') : undefined;
			if (segment)
				finalPath += `/${segment}`;
		}

		finalPath = finalPath.replace(/^\/|\/$/g, '');

		if (!finalPath || finalPath === '/')
			return '';
		
		return '/' + finalPath;
	}

	private prepare() {
		this._instance = this.injector.get(this.type);

		// Reflect upon our routes


		let routeReflector = new RouteReflector(this.type);
		let routeDefinitions = routeReflector.routes;
		let controllerMetadata = ControllerAnnotation.getForClass(this.type);
		let controllerOptions = controllerMetadata?.options ?? {};
		this._options = controllerOptions;

		for (let mount of routeReflector.mounts) {
			let controller = mount.controller;
			let mountInjector = this.injector;
			let providers : Provider[] = (mount.options || {} as MountOptions).providers || [];
			let existingInstance = mountInjector.get(controller, null);

			// If the controller is not provided by the injector, or if the mounter has customized the providers,
			// then create a new injector that can provide the controller 

			if (!existingInstance || providers.length > 0) {
				providers.push(controller as Provider);
				try {
					mountInjector = ReflectiveInjector.resolveAndCreate(providers, this.injector);
				} catch (e) {
					console.error(`Failed to resolve and create dependency injector for mount with path '${mount.path}'`);
					console.error(e);
					throw e;
				}
			}

			let subPrefix = this.combinePaths(
				this.context.pathPrefix, 
				this._options.basePath,
				mount.path
			);

			let instance = new ControllerInstance(
				this.server, 
				controller, 
				mountInjector, 
				this.routeTable, 
				{
					pathPrefix: subPrefix
				}
			);

			this.controllers.push(instance);
			this.instance[mount.propertyKey] = instance.instance;
		}

		// Register all of our routes with the web server

		this._routes = routeDefinitions.map(
			definition => new RouteInstance(
				this.server, 
				this.instance,
				this.injector, 
				this.options.preRouteMiddleware ?? [], 
				this.options.postRouteMiddleware ?? [],
				this.options.interceptors ?? [],
				this.group, 
				this.type, 
				this.routeTable,
				definition
			)
		);
	}

	private _routes : RouteInstance[];

	get pathPrefix() {
		return this.combinePaths(this._context.pathPrefix, this._options.basePath);
	}
	
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

	private prepareMiddleware() {
		
		// Load up the defined middleware for this route
		let middleware = this.middleware;

		// Ensure indexes are valid.

		let invalidIndex = middleware.findIndex(x => !x);
		if (invalidIndex >= 0)
			throw new Error(`Controller '${this.type}' provided null middleware at position ${invalidIndex}`);

		// Prepare the middlewares (if they are DI middlewares, they get injected)

		this.resolvedMiddleware = middleware.map(x => prepareMiddleware(this.injector, x));
	}

	resolvedMiddleware : ConnectMiddleware[];

	initialize() {
		if (!this.isModule && this.instance && typeof this.instance.altOnInit === 'function') 
			this.instance.altOnInit();
	}

	start() {
		if (!this.isModule && this.instance && typeof this.instance.altOnStart === 'function')
			this.instance.altOnStart();
	}

	/**
	 * Notify the controller that it's web service is now listening to the desired port
	 * @param server 
	 */
	listen(server : WebServer) {
		if (this.instance && typeof this.instance.altOnListen === 'function')
			this.instance.altOnListen(server);
	}

	stop() {
		if (!this.isModule && this.instance && typeof this.instance.altOnStop === 'function')
			this.instance.altOnStop();
	}

	mount(webServer : WebServer) {
		WebServer.register(this.instance, this.server);
		
		this.prepareMiddleware();
		for (let middleware of this.resolvedMiddleware)
			webServer.engine.addConnectMiddleware(this.pathPrefix, middleware);
		
		this.routes.forEach(r => r.mount(this.pathPrefix));
		this.controllers.forEach(c => c.mount(webServer));

	}
}