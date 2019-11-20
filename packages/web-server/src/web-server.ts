import * as uuid from 'uuid';
import * as http from 'http';

import { Injector, ReflectiveInjector, Module } from "@alterior/di";
import { prepareMiddleware } from "./middleware";
import { RouteEvent } from "./metadata";
import { RouteInstance, RouteDescription } from './route';
import { ApplicationOptions, Application, AppOptionsAnnotation, AppOptions } from '@alterior/runtime';
import { ExpressRef } from './express-ref';
import { Logger } from '@alterior/logging';
import { WebServerEngine } from './web-server-engine';
import { ExpressEngine } from './express-engine';
import { WebServerOptions } from './web-server-options';
import { ServiceDescription } from './service-description';
import { ServiceDescriptionRef } from './service-description-ref';

/**
 * Implements a web server which is comprised of a set of Controllers.
 */
export class WebServer {
    constructor(
        injector : Injector,
		options : WebServerOptions,
		readonly logger : Logger,
		readonly appOptions : ApplicationOptions = {}
    ) {
		this.setupServiceDescription();
		this.setupInjector(injector);
		this.options = options || {};
		this._engine = this._injector.get(WebServerEngine);

		this.installGlobalMiddleware();
	}
	
	private _injector : Injector;
    readonly options : WebServerOptions;
    private httpServer : http.Server;
	private _serviceDescription : ServiceDescription;
	private _engine : WebServerEngine;

	get engine() {
		return this._engine;
	}

	public static bootstrapCloudFunction(entryModule : any, options? : ApplicationOptions) {
		let appReady : Promise<Application>;
		let expressRef : ExpressRef = null;

		return async (req, res) => {
			if (!appReady) {
				let appOptionsAnnot = AppOptionsAnnotation.getForClass(entryModule);
				@AppOptions(appOptionsAnnot ? appOptionsAnnot.options : {})
				@Module({
					imports: [ entryModule ],
					providers: [
						{ provide: WebServerEngine, useClass: ExpressEngine }
					]
				})
				class EntryModule {
				}
		
				appReady = Application.bootstrap(
					EntryModule, 
					Object.assign({}, options, { 
						autostart: false 
					})
				);
			}

			if (!expressRef) {
				let app = await appReady;
				expressRef = app.injector.get(ExpressRef);
			}
			
		    expressRef.application(req, res);
		}
	}
	
	/**
	 * Setup the service description which provides a view of all the routes 
	 * registered in this web server.
	 */
	private setupServiceDescription() {
		let version = '0.0.0';
		let name = 'Untitled Web Service';

		if (this.appOptions.version)
			version = this.appOptions.version;

		if (this.appOptions.name)
			name = this.appOptions.name;

		this._serviceDescription = {
			routes: [],
			name,
			version
		};
	}

	/**
	 * Construct an injector suitable for use in this web server component,
	 * inheriting from the given injector.
	 * 
	 * @param injector 
	 */
	private setupInjector(injector : Injector) {
		let providers = [
			{
				provide: ServiceDescriptionRef,
				useValue: new ServiceDescriptionRef(this._serviceDescription)
			}
		];
		
		let ownInjector = ReflectiveInjector.resolveAndCreate(providers, injector);
		this._injector = ownInjector;
	}

	public get injector() {
		return this._injector;
	}

    // public get express() {
    //     return this.expressApp;
    // }

	get serviceDescription() {
		return this._serviceDescription;
	}

	/**
	 * Install the registered global middleware onto our Express 
	 * application.
	 */
    private installGlobalMiddleware() {
        let middlewares = this.options.middleware || [];
        for (let middleware of middlewares) {
			middleware = prepareMiddleware(this.injector, middleware);
			this.engine.addConnectMiddleware('/', middleware as any);
        }
	}
	
    async start() {
		this.httpServer = await this.engine.listen(this.options.port || 3000);
    }

    stop() {
		if (!this.httpServer)
			return;
		
		this.httpServer.close();
    }

	reportRequest(event : RouteEvent, source : string) {
		if (!this.options.silent) {
			let req : any = event.request;
			let method = event.request.method;
			let path = event.request.path;

			// When using fastify as the underlying server, you must 
			// access route-specific metadata from the underlying Node.js 
			// request

			if (req.req) {
				if (!method)
					method = req.req.method;
				if (!path)
					path = req.req.path;
			}

			this.logger.info(`${method.toUpperCase()} ${path} => ${source}`);
		}
	}

	/**
	 * Installs this route into the given Express application. 
	 * @param app 
	 */
	addRoute(definition : RouteDescription, method : string, path : string, handler : (event : RouteEvent) => void, middleware = []) {
		this.serviceDescription.routes.push(definition);

		this.engine.addRoute(method, path, ev => {
			let requestId = uuid.v4();
			return this.logger.withContext({ host: 'web-server', requestId }, `${method.toUpperCase()} ${path} | ${requestId}`, () => {
				return handler(ev);
			});
		}, middleware);
	}

	handleError(error : any, event : RouteEvent, route : RouteInstance, source : string) {

		if (this.options.onError)
			this.options.onError(error, event, route, source);

		if (this.options.handleError) {
			this.options.handleError(error, event, route, source);
			return;
		}

		if (!this.options.silentErrors) {
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
			.send(response)
		;
	}
}

