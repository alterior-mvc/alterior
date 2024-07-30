import * as uuid from 'uuid';
import * as http from 'http';
import * as ws from 'ws';

import { Injector, ReflectiveInjector, Module, Provider } from "@alterior/di";
import { prepareMiddleware } from "./middleware";
import { WebEvent } from "./metadata";
import { RouteInstance, RouteDescription } from './route';
import { ApplicationOptions, Application, AppOptionsAnnotation, AppOptions } from '@alterior/runtime';
import { LogSeverity, Logger } from '@alterior/logging';
import { WebServerEngine } from './web-server-engine';
import { ParameterDisplayFormatter, RequestReporter, RequestReporterFilter, WebServerOptions } from './web-server-options';
import { ServiceDescription } from './service-description';
import { ServiceDescriptionRef } from './service-description-ref';
import { WebConduit } from './web-conduit';
import { ellipsize } from './utils';
import { HttpError } from '@alterior/common';
import { HTTP_MESSAGES } from './http-messages';

const REPORTING_STATE = Symbol('Reporting state');

/**
 * Implements a web server which is comprised of a set of Controllers.
 */
export class WebServer {
	constructor(
		injector: Injector,
		options: WebServerOptions,
		readonly logger: Logger,
		readonly appOptions: ApplicationOptions = {}
	) {
		this.setupServiceDescription();
		this.setupInjector(injector);
		this.options = options || {};
		if (!this.options.port) {
			if (this.options.certificate) {
				this.options.port = 443;
			} else {
				this.options.port = 3000;
			}
		}

		this._engine = this._injector.get(WebServerEngine, null);

		if (!this._engine) {
			this._engine = ReflectiveInjector.resolveAndCreate([
				{ provide: WebServerEngine, useClass: options?.engine ?? WebServerEngine.default }
			], this._injector).get(WebServerEngine, null);
		}

		if (!this._engine) {
			throw new Error(
				`No WebServerEngine found! Set WebServerEngine.default to an engine (@alterior/express, @alterior/fastify) `
				+ `or provide a WebServerEngine via dependency injection.`
			);
		}

		this.installGlobalMiddleware();
		this._websockets = new ws.Server({ noServer: true });
		this.requestReporter = options?.requestReporter ?? this.requestReporter;
		this.requestReporterFilters = options?.requestReporterFilters ?? this.requestReporterFilters;
	}

	private _injector: Injector;
	readonly options: WebServerOptions;
	private _websockets: ws.Server;

	/**
	 * Websocket server instance. 
	 * @type ws.Server
	 */
	get websockets(): any {
		return this._websockets;
	}

	private _httpServer: http.Server;
	get httpServer() { return this._httpServer; }

	private _insecureHttpServer: http.Server;
	get insecureHttpServer() { return this._insecureHttpServer; }

	private _serviceDescription: ServiceDescription;
	private _engine: WebServerEngine;

	get engine() {
		return this._engine;
	}

	private static _servers = new WeakMap<Object, WebServer>();

	public static for(webService: any): WebServer {
		let server = this._servers.get(webService);
		if (!server)
			throw new Error(`Failed to retrieve server for the given web service`);
		return server;
	}

	public static register(webService: any, server: WebServer) {
		this._servers.set(webService, server);
	}

	public static bootstrapCloudFunction(entryModule: any, options?: ApplicationOptions) {
		let appOptionsAnnot = AppOptionsAnnotation.getForClass(entryModule);
		@AppOptions(appOptionsAnnot ? appOptionsAnnot.options: {})
		@Module({
			imports: [entryModule]
		})
		class EntryModule {
		}

		let app = Application.bootstrap(
			EntryModule,
			Object.assign({}, options, {
				autostart: false
			})
		);

		return WebServer.for(app.injector.get(entryModule))
			.engine.app;
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
	private setupInjector(injector: Injector) {
		let providers: Provider[] = [
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

	get serviceDescription() {
		return this._serviceDescription;
	}

	/**
	 * Install the registered global middleware onto our web server 
	 * application.
	 */
	private installGlobalMiddleware() {
		let middlewares = this.options.middleware || [];
		for (let middleware of middlewares) {
			if (middleware instanceof Array)
				this.engine.addConnectMiddleware(middleware[0], prepareMiddleware(this.injector, middleware[1]));
			else
				this.engine.addConnectMiddleware('/', prepareMiddleware(this.injector, middleware));
		}
	}

	/**
	 * Start the web server.
	 */
	async start() {
		if (this._httpServer)
			return;
		this._httpServer = await this.engine.listen(this.options);

		let isSecure = !!this.options.certificate || !!this.options.sniHandler;
		if (isSecure && this.options.insecurePort && !this.engine.listenInsecurely) {
			throw new Error(
				`Provided ServerEngine does not support listening on secondary insecure port. ` 
				+ `You may need to upgrade it to a newer version.`
			);
		}

		if (this.options.insecurePort)
			this._insecureHttpServer = await this.engine.listenInsecurely(this.options);
	}

	/**
	 * Stop the web server. The listening port will be closed.
	 * @returns 
	 */
	stop() {
		if (!this._httpServer)
			return;

		this._httpServer.close();
		this._httpServer = null;
	}

	private requestReporter: RequestReporter = WebServer.DEFAULT_REQUEST_REPORTER;
	private requestReporterFilters: RequestReporterFilter[] = [];
	private parameterDisplayFormatter: ParameterDisplayFormatter = WebServer.DEFAULT_PARAMETER_LOG_FORMATTER;

	/**
	 * Modify how parameters are formatted for display within logs and other display purposes. In addition to general
	 * formatting, this function is responsible for:
	 * - Ellipsizing long values to prevent creating excessively large log values
	 * - Masking the parameter value based on configuration (see sensitiveParameters, sensitivePlaceholder, and parameterValueFilters
	 *   options)
	 * @param formatter 
	 */
	setParameterDisplayFormatter(formatter: ParameterDisplayFormatter) {
		this.parameterDisplayFormatter = formatter;
	}

	/**
	 * Format a parameter value for display within logs or other auxiliary purposes. Will also apply sensitive value
	 * masking as well as ellipsization for long values. Formatting routine can be changed using setParameterDisplayFormatter
	 * or via the parameterDisplayFormatter server option.
	 * 
	 * @param event 
	 * @param value 
	 * @param forKey 
	 * @returns 
	 */
	formatParameterForDisplay(event: WebEvent, value: any, forKey: string): string {
		return this.parameterDisplayFormatter(event, value, forKey);
	}

	/**
	 * Filter which requests are reported via logging. Useful for filtering requests which happen very often,
	 * such as health checks.
	 * @param filter 
	 */
	addRequestReporterFilter(filter: RequestReporterFilter) {
		this.requestReporterFilters.push(filter);
	}

	/**
	 * Remove a request reporting filter added previously with addRequestReporterFilter()
	 * @param filter 
	 */
	removeRequestReporterFilter(filter: RequestReporterFilter) {
		this.requestReporterFilters = this.requestReporterFilters.filter(x => x !== filter);
	}

	/**
	 * Modify how requests are reported to logging.
	 * @param reporter 
	 */
	setRequestReporter(reporter: RequestReporter) {
		this.requestReporter = reporter;
	}

	reportRequest(reportingEvent: 'middleware' | 'starting' | 'finished', event: WebEvent, source: string) {
		if (this.options.silent)
			return;

		if (!this.requestReporterFilters.every(x => x(event, source)))
			return;

		event.context(() => this.requestReporter(reportingEvent, event, source, this.logger));
	}

	get sensitiveParameters() {
		return this.options.sensitiveParameters ?? [];
	}

	/**
	 * Placeholder used when masking sensitive information within a string.
	 * Set via the sensitivePlaceholder server option.
	 */
	get sensitiveMask() {
		return this.options.sensitiveMask ?? '****';
	}

	get sensitivePatterns() {
		return this.options.sensitivePatterns ?? [];
	}

	get longParameterThreshold() {
		return this.options.longParameterThreshold ?? 100;
	}

	get longRequestThreshold() {
		return this.options.longRequestThreshold ?? 1_000;
	}

	get hungRequestThreshold() {
		return this.options.hungRequestThreshold ?? 3_000;
	}

	/**
	 * Attempt to mask any sensitive information found within the given string. If this information comes from a parameter,
	 * the name of the parameter may cause the entire string to be masked. Will be masked using the sensitivePlaceholder property.
	 * @param value 
	 * @param parameterName 
	 * @returns 
	 */
	maskSensitiveInformation(value: string, parameterName?: string) {
		if (parameterName && this.sensitiveParameters.includes(parameterName))
			return this.sensitiveMask;

		for (let filter of this.sensitivePatterns)
			value = value.replace(filter, this.sensitiveMask);
	
		return value;
	}

	public static DEFAULT_PARAMETER_LOG_FORMATTER: ParameterDisplayFormatter = (event: WebEvent, value: any, forKey: string) => {
		let parameterString: string;
		try {
			parameterString = JSON.stringify(value);
		} catch (e) {
			parameterString = String(value);
		}

		return ellipsize(
			event.server.options.longParameterThreshold, 
			event.server.maskSensitiveInformation(parameterString, forKey)
		);
	};

	public static DEFAULT_REQUEST_REPORTER: RequestReporter = (reportingEvent: 'middleware' | 'starting' | 'finished', event: WebEvent, source: string, logger: Logger) => {
		let metadata = event.metadata[REPORTING_STATE] ??= { startedAt: Date.now(), state: 'running' };

		let logRequest = () => {
			let req: any = event.request;
			let method = event.request.method;
			let path = event.request['path'];
			if (!('path' in event.request))
				throw new Error(`WebServerEngine must provide request.path!`);

			let queryString = '';
			let host = event.request.headers?.['host'] ?? '';
			let longParameterThreshold = event.server.longParameterThreshold;

			if ('query' in event.request) {
				if (typeof event.request.query === 'string') {
					queryString = event.request.query.startsWith('?') ? event.request.query : `?${event.request.query}`;
				} else if (typeof event.request.query === 'object') {
					queryString = `?${
						Object.keys(event.request.query)
							.map(key => [key, (event.request as any).query[key]])
							.map(([key, value]) => 
								`${encodeURIComponent(ellipsize(longParameterThreshold, key))}` 
								+ `${ String(value) === '' ? '' : `=${encodeURIComponent(value)}` }`
							)
							.join(`&`)
					}`;

					queryString = queryString === '?' ? '' : queryString;
				}
			}

			// When using fastify as the underlying server, you must 
			// access route-specific metadata from the underlying Node.js 
			// request

			if (req.req) {
				if (!method)
					method = req.req.method;
				if (!path)
					path = req.req.path;
			}

			let time = event.metadata[REPORTING_STATE].startedAt;
			let timeDelta = (Date.now() - time) | 0;
			let state = event.metadata[REPORTING_STATE].state;
			let done = reportingEvent === 'finished';

			let displayState = '';
			let severity: LogSeverity = 'info';
			let statusSuffix = '';

			if (done) {
				if (state === 'long') {
					displayState = 'done';
				} else if (state === 'hung') {
					displayState = `unhung`;
				}

				if (event.response.statusCode >= 500)
					severity = 'error';
				
				statusSuffix = ` » ${event.response.statusCode} ${event.response.statusMessage ?? HTTP_MESSAGES[event.response.statusCode]}`;
			} else {
				displayState = 'running';
				if (state === 'long') {
					displayState = 'long';
					severity = 'warning';
				} else if (state === 'hung') {
					displayState = 'hung';
					severity = 'error';
				}
			}

			if (event.metadata['uncaughtError'] && !event.server.options.silentErrors) {
				let error = event.metadata['uncaughtError'];
				
				if (error instanceof HttpError) {
					if (error.body?.error === 'invalid-request') {
						statusSuffix = `${statusSuffix} (${error.body.message})`;
					}
				} else {
					let displayableError: string;
					if (error instanceof Error) {
						displayableError = String(error.stack);
					} else {
						try {
							displayableError = JSON.stringify(error);
						} catch (e) {
							displayableError = String(error);
						}
					}
	
					if (displayableError)
						statusSuffix = `${statusSuffix}\n    ${displayableError}`;
				}
			}

			logger.log(
				`${displayState ? `[${displayState}] ` : ``}${method.toUpperCase()} ${host}${path}${queryString} » ${source} [${timeDelta} ms]${statusSuffix}`,
				{ severity }
			);

		}
		
		if (reportingEvent === 'starting') {
			metadata.longTimeout = setTimeout(() => {
				metadata.state = 'long';
				logRequest();
			}, event.server.longRequestThreshold ?? 1_000);
			
			metadata.hungTimeout = setTimeout(() => {
				metadata.state = 'hung';
				logRequest();
			}, event.server.hungRequestThreshold ?? 3_000);
		} else if (reportingEvent === 'finished') {
			clearTimeout(metadata.longTimeout);
			clearTimeout(metadata.hungTimeout);
			logRequest();
		}
	}

	async startConduit() {
		return new WebConduit(await this.startSocket());
	}

	async startSocket() {
		if (!WebEvent.current)
			throw new Error(`WebSocket.start() can only be called while handling an incoming HTTP request`);

		if (!WebEvent.request['__upgradeHead'])
			throw new Error(`Client is not requesting an upgrade`);

		return await new Promise<WebSocket>((resolve, reject) => {
			this
				._websockets
				.handleUpgrade(
					WebEvent.request,
					WebEvent.request.socket,
					WebEvent.request['__upgradeHead'],
					socket => {
						WebEvent.response.detachSocket(WebEvent.request.socket);
						resolve(<any>socket);
					}
				)
				;
		});
	}

	static async startSocket() {
		return WebServer.for(WebEvent.controller).startSocket();
	}

	static async startConduit() {
		return WebServer.for(WebEvent.controller).startConduit();
	}

	/**
	 * Determine the request ID for a web event and apply it to the 
	 * requestId field.
	 * @param event 
	 */
	 private addRequestId(event: WebEvent) {
		let requestId: string;
		let idHeaderNames = this.options.requestIdHeader;

		if (typeof idHeaderNames === 'string')
			idHeaderNames = [ idHeaderNames ];

		if (idHeaderNames) {
			for (let idHeaderName of idHeaderNames) {
				let idHeader = event.request.headers[idHeaderName];
				if (!idHeader)
					continue;

				if (Array.isArray(idHeader))
					idHeader = idHeader[0];
				
				if (this.options.requestIdValidator) {
					if (this.options.requestIdValidator.test(idHeader))
						requestId = idHeader;
				} else {
					if (uuid.validate(idHeader))
						requestId = idHeader;
				}

				if (requestId)
					break;
			}
		}

		if (!requestId)
			requestId = uuid.v4();

		event.requestId = requestId;
	}

	/**
	 * Installs this route into the given web server application. 
	 * @param app 
	 */
	addRoute(definition: RouteDescription, method: string, path: string, handler: (event: WebEvent) => void, middleware = []) {
		this.serviceDescription.routes.push(definition);

		this.engine.addRoute(method, path, ev => {
			this.addRequestId(ev);
			this.logger.run(() => {
				this.logger.withContext({ host: 'web-server', requestId: ev.requestId }, ev.requestId, () => handler(ev));
			});
		}, middleware);
	}

	handleError(error: any, event: WebEvent, route: RouteInstance, source: string) {
		if (error.constructor instanceof HttpError) {
			let httpError = <HttpError>error;
			event.response.statusCode = httpError.statusCode;
			
			httpError.headers
				.forEach(header => event.response.setHeader(header[0], header[1]));

			event.response.setHeader('Content-Type', 'application/json; charset=utf-8');
			event.response.write(JSON.stringify(httpError.body));
			event.response.end();

			return;
		}

		if (this.options.onError)
			this.options.onError(error, event, route, source);

		if (this.options.handleError) {
			this.options.handleError(error, event, route, source);
			return;
		}

		let response: any = {
			message: 'An exception occurred while handling this request.'
		};

		if (!this.options.hideExceptions) {
			if (error instanceof Error && !('toJSON' in error)) {
				let stack = error.stack.split(/\r?\n/).slice(1).map(line => line.replace(/ +at /, ''));
				response.error = {
					message: error.message ?? '«undefined»',
					constructor: error.constructor.name ?? '«undefined»',
					stack: stack ?? '«undefined»'
				};
			} else {
				response.error = error;
			}
		}

		event.response.statusCode = 500;
		event.response.setHeader('Content-Type', 'application/json; charset=utf-8');
		event.response.write(JSON.stringify(response));
		event.response.end();
	}
}

