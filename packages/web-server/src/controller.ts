import { Injector, Provider, Type } from "@alterior/di";
import { ALT_ON_LISTEN, ControllerAnnotation, ControllerOptions, MiddlewareDefinition, MountOptions } from "./metadata";
import { RouteReflector } from "./metadata/route-reflector-private";
import { prepareMiddleware } from "./middleware";
import { WebServer } from "./web-server";
import { RouteInstance } from "./route-instance";
import { ALT_ON_INIT, ALT_ON_START, ALT_ON_STOP, fireLifecycleEvent, handleLegacyLifecycleEvent } from '@alterior/runtime';

export interface ControllerContext {
	pathPrefix?: string;
}

/**
 * Represents an instance of a controller, which can be used to handle requests.
 */
export class ControllerInstance {
	constructor(
		readonly server: WebServer,
		readonly type: Function,
		readonly injector: Injector,
		readonly routeTable: any[],
		pathPrefix: string = '',
		readonly isModule = false
	) {
		this.instance = this.injector.get(<Type<any>>this.type);
		this.options = ControllerAnnotation.getForClass(this.type)?.options ?? {};
		this.pathPrefix = this.combinePaths(pathPrefix, this.options.basePath);
		this.routes = this.findRoutes();

		// Ensure indexes are valid.

		this.middleware = [...(this.options?.middleware ?? [])];
		let invalidIndex = this.middleware.findIndex(x => !x);
		if (invalidIndex >= 0)
			throw new Error(`Controller '${this.type}' provided null/undefined middleware at position ${invalidIndex}`);

	}

	readonly middleware: MiddlewareDefinition[];
	readonly pathPrefix: string;

	readonly instance: any;
	readonly routes: RouteInstance[];
	private _controllers: ControllerInstance[] = [];
	readonly options: ControllerOptions;

	private findRoutes() {

		// Reflect upon our routes

		let routeReflector = new RouteReflector(this.instance);
		let routeDefinitions = routeReflector.routes;

		for (let mount of routeReflector.mounts) {
			let controller = mount.controller;
			let mountInjector = this.injector;
			let providers: Provider[] = (mount.options || {} as MountOptions).providers || [];
			let existingInstance = mountInjector.get(<Type<any>>controller, null);

			// If the controller is not provided by the injector, or if the mounter has customized the providers,
			// then create a new injector that can provide the controller 

			if (!existingInstance || providers.length > 0) {
				providers.push(controller as Provider);
				try {
					mountInjector = Injector.resolveAndCreate(providers, this.injector);
				} catch (e) {
					console.error(`Failed to resolve and create dependency injector for mount with path '${mount.path}'`);
					console.error(e);
					throw e;
				}
			}

			let subPrefix = this.combinePaths(
				this.pathPrefix,
				mount.path
			);

			let instance = new ControllerInstance(
				this.server,
				controller,
				mountInjector,
				this.routeTable,
				subPrefix
			);

			this.controllers.push(instance);
			this.instance[mount.propertyKey] = instance.instance;
		}

		// Register all of our routes with Express

		return routeDefinitions.map(
			definition => new RouteInstance(
				this.server,
				this.instance,
				this.injector,
				this.middleware,
				this.group,
				this.type,
				this.routeTable,
				definition
			)
		);
	}

	combinePaths(...paths: (string | undefined)[]) {
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

	get controllers() {
		return this._controllers;
	}

	get group(): string {
		let controllerGroup: string | undefined = undefined;

		if (this.options && this.options.group) {
			controllerGroup = this.options.group;
		} else {
			controllerGroup = this.type.name.replace(/Controller$/, '');
			controllerGroup = controllerGroup.charAt(0).toLowerCase() + controllerGroup.slice(1);
		}

		return controllerGroup;
	}

	private prepareMiddleware(): any[] {
		// Procure an injector which can handle injecting the middlewares' providers
		let childInjector = Injector.resolveAndCreate(
			<Provider[]>this.middleware.filter(x => Reflect.getMetadata('alterior:middleware', x)),
			this.injector
		);

		// Prepare the middlewares (if they are DI middlewares, they get injected)

		return this.middleware.map(x => prepareMiddleware(childInjector, x));
	}

	private _initialized = false;

	async initialize() {
		if (this._initialized)
			return;

		this._initialized = true;

		if (!this.isModule)
			await this.fireLifecycleEvent(ALT_ON_INIT);

		for (let controller of this.controllers)
			await controller.initialize();
	}

	async start() {
		if (!this.isModule)
			await this.fireLifecycleEvent(ALT_ON_START);
	}

	/**
	 * Notify the controller that it's web service is now listening to the desired port
	 * @param server 
	 */
	async listen(server: WebServer) {
		await this.fireLifecycleEvent(ALT_ON_LISTEN);
	}

	async stop() {
		if (!this.isModule)
			await this.fireLifecycleEvent(ALT_ON_STOP);
	}

	/**
	 * Fire a particular lifecycle event on this controller. You should only call this directly if you are 
	 * implementing custom lifecycle events.
	 * 
	 * @param eventName The event to fire
	 */
	async fireLifecycleEvent(eventName: symbol) {
		if (this.instance) {
			await fireLifecycleEvent(this.instance, eventName);
			handleLegacyLifecycleEvent(this.server.logger, this.instance, eventName);
		}
	}

	mount(webServer: WebServer) {
		WebServer.register(this.instance, this.server);

		for (let middleware of this.prepareMiddleware())
			webServer.engine.addConnectMiddleware(this.pathPrefix, middleware);

		this.routes.forEach(r => r.mount(this.pathPrefix));
		this.controllers.forEach(c => c.mount(webServer));

	}
}