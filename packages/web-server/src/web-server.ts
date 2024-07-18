import * as uuid from 'uuid';
import * as http from 'http';
import * as ws from 'ws';

import { Injector, Provider, Type } from "@alterior/di";
import { prepareMiddleware } from "./middleware";
import { MiddlewareDefinition, WebEvent, WebRequest } from "./metadata";
import { ApplicationOptions, Application, AppOptionsAnnotation, AppOptions, Module } from '@alterior/runtime';
import { LogSeverity, Logger } from '@alterior/logging';
import { ConnectApplication, ConnectMiddleware, WebServerEngine } from './web-server-engine';
import { ParameterDisplayFormatter, RequestReporter, RequestReporterFilter, WebServerOptions } from './web-server-options';
import { ServiceDescription } from './service-description';
import { ServiceDescriptionRef } from './service-description-ref';
import { ReactiveSocket } from './reactive-socket';
import { ellipsize } from './utils';
import { HttpError } from '@alterior/common';
import { HTTP_MESSAGES } from './http-messages';
import { RouteDescription } from './route-description';
import { RouteInstance } from './route-instance';

const REPORTING_STATE = Symbol('Reporting state');
const DEFAULT_LONG_PARAMETER_THRESHOLD = 100;
const DEFAULT_LONG_REQUEST_THRESHOLD = 1_000;
const DEFAULT_HUNG_REQUEST_THRESHOLD = 3_000;

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
		this._serviceDescription = {
			routes: [],
			name: this.appOptions.name ?? 'Untitled Web Service',
			version: this.appOptions.version ?? '0.0.0'
		};
		this._injector = this.setupInjector(injector);
		this.options = options || {};
		if (!this.options.port) {
			if (this.options.certificate) {
				this.options.port = 443;
			} else {
				this.options.port = 3000;
			}
		}

		this._engine = this._injector.get(WebServerEngine, null) || this.createDefaultWebServerEngine(options);

		this.installGlobalMiddleware();
		this._websockets = new ws.Server({ noServer: true });
		this.requestReporter = options?.requestReporter ?? this.requestReporter;
		this.requestReporterFilters = options?.requestReporterFilters ?? this.requestReporterFilters;
	}

	private createDefaultWebServerEngine(options: WebServerOptions) {
		if (!WebServerEngine.default) {
			throw new Error(
				`No WebServerEngine found! Set WebServerEngine.default to an engine (@alterior/express, @alterior/fastify) `
				+ `or provide a WebServerEngine via dependency injection.`
			);
		}
		return Injector.resolveAndCreate([
			{ provide: WebServerEngine, useClass: options.engine || WebServerEngine.default }
		], this._injector).get(WebServerEngine);
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

	private _httpServer?: http.Server;
	private _insecureHttpServer?: http.Server;
	
	get httpServer() { return this._httpServer; }
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

		let appReady = Application.bootstrap(
			EntryModule,
			Object.assign({}, options, {
				autostart: false
			})
		);

		let connectApp: ConnectApplication;

		return async (req: WebRequest, res: http.ServerResponse) => {
			connectApp ??= WebServer.for((await appReady).injector.get(<Type<any>>entryModule))
				.engine.app;

			connectApp(req, res);
		}
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

		let ownInjector = Injector.resolveAndCreate(providers, injector);
		return ownInjector;
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
				this.engine.addConnectMiddleware(middleware[0], <ConnectMiddleware>prepareMiddleware(this.injector, middleware[1]));
			else
				this.engine.addConnectMiddleware('/', <ConnectMiddleware>prepareMiddleware(this.injector, middleware));
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
	async stop() {
		const server = this._httpServer;
		if (!server)
			return;

		await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
		if (this._httpServer === server)
			this._httpServer = undefined;
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

		this.requestReporter(reportingEvent, event, source, this.logger);
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
		return this.options.longParameterThreshold ?? DEFAULT_LONG_PARAMETER_THRESHOLD;
	}

	get longRequestThreshold() {
		return this.options.longRequestThreshold ?? DEFAULT_LONG_REQUEST_THRESHOLD;
	}

	get hungRequestThreshold() {
		return this.options.hungRequestThreshold ?? DEFAULT_HUNG_REQUEST_THRESHOLD;
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
			event.server?.longParameterThreshold ?? DEFAULT_LONG_PARAMETER_THRESHOLD, 
			event.server?.maskSensitiveInformation(parameterString, forKey) ?? parameterString
		);
	};

	/**
	 * Provides the default request logging behavior. This can be overridden by providing the requestReporter option
	 * when setting up the server.
	 * 
	 * @param reportingEvent 
	 * @param event 
	 * @param source 
	 * @param logger 
	 */
	public static DEFAULT_REQUEST_REPORTER: RequestReporter = (
		reportingEvent: 'middleware' | 'starting' | 'finished', 
		event: WebEvent, 
		source: string, 
		logger: Logger
	) => {
		let metadata = event.metadata[REPORTING_STATE] ??= { startedAt: Date.now(), state: 'running' };

		let logRequest = () => {
			let req: any = event.request;
			let method = event.request.method;
			let path = event.request['path'];
			if (!('path' in event.request))
				throw new Error(`WebServerEngine must provide request.path!`);

			let queryString = '';
			let host = event.request.headers?.['host'] ?? '';
			let longParameterThreshold = event.server?.longParameterThreshold ?? DEFAULT_LONG_PARAMETER_THRESHOLD;

			if (event.request.query) {
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
				
				statusSuffix = ` » ${event.response.statusCode} ${event.response.statusMessage 
					?? (HTTP_MESSAGES as Record<number, string>)[event.response.statusCode]}`;
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

			if (event.metadata['uncaughtError'] && !event.server?.options.silentErrors) {
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
				`${displayState ? `[${displayState}] ` : ``}${(method ?? '<UNKNOWN>').toUpperCase()} ${host}${path}${queryString} » ${source} [${timeDelta} ms]${statusSuffix}`,
				{},
				severity
			);

		}
		
		if (reportingEvent === 'starting') {
			metadata.longTimeout = setTimeout(() => {
				metadata.state = 'long';
				logRequest();
			}, event.server?.longRequestThreshold ?? DEFAULT_LONG_REQUEST_THRESHOLD);
			
			metadata.hungTimeout = setTimeout(() => {
				metadata.state = 'hung';
				logRequest();
			}, event.server?.hungRequestThreshold ?? DEFAULT_HUNG_REQUEST_THRESHOLD);
		} else if (reportingEvent === 'finished') {
			clearTimeout(metadata.longTimeout);
			clearTimeout(metadata.hungTimeout);
			logRequest();
		}
	}

	async startReactiveSocket() {
		return new ReactiveSocket(await this.startSocket());
	}

	async startSocket() {
		if (!WebEvent.current)
			throw new Error(`WebSocket.start() can only be called while handling an incoming HTTP request`);

		if (!(WebEvent.request as any)['__upgradeHead'])
			throw new Error(`Client is not requesting an upgrade`);

		return await new Promise<WebSocket>((resolve, reject) => {
			this
				._websockets
				.handleUpgrade(
					WebEvent.request,
					WebEvent.request.socket,
					(WebEvent.request as any)['__upgradeHead'],
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

	static async startReactiveSocket() {
		return WebServer.for(WebEvent.controller).startReactiveSocket();
	}

	/**
	 * Determine the request ID for a web event and apply it to the 
	 * requestId field.
	 * @param event 
	 */
	 private addRequestId(event: WebEvent) {
		let requestId: string | undefined;
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
	addRoute(definition: RouteDescription, method: string, path: string, handler: (event: WebEvent) => void, middleware: MiddlewareDefinition[] = []) {
		this.serviceDescription.routes.push(definition);

		this.engine.addRoute(method, path, ev => {
			this.addRequestId(ev);
			this.logger.run(() => {
				this.logger.withContext({ host: 'web-server', requestId: ev.requestId }, ev.requestId ?? '<no-request-id>', () => handler(ev));
			});
		}, middleware);
	}

	handleError(error: any, event: WebEvent, route: RouteInstance, source: string) {
		if (error.constructor === HttpError) {
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
				let stack = error.stack?.split(/\r?\n/).slice(1).map(line => line.replace(/ +at /, ''));
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

