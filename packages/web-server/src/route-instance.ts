import { Annotations } from "@alterior/annotations";
import { ArgumentError, ArgumentNullError, getParameterNames } from "@alterior/common";
import { Injector } from '@alterior/di';
import { BodyOptions, InputAnnotation } from "./input";
import { MiddlewareDefinition, RouteDefinition, RouteOptions, WebEvent } from "./metadata";
import { MiddlewareProvider, prepareMiddleware } from "./middleware";
import { Response } from './response';
import { ellipsize } from './utils';
import { WebServer } from "./web-server";
import { WebServerSetupError } from "./web-server-setup-error";

import * as bodyParser from 'body-parser';
import { RouteParamDescription } from "./route-param-description";
import { RouteMethodMetadata } from "./route-method-metadata";
import { RouteDescription } from "./route-description";
import { RouteMethodParameter } from "./route-method-parameter";
import { Interceptor } from "./web-server-options";
import { ConnectMiddleware } from "./web-server-engine";

/**
 * Represents a Route instance
 */
export class RouteInstance {
	constructor(
		readonly server: WebServer,
		readonly controllerInstance: any,
		readonly injector: Injector,
        readonly preMiddleware: any[],
		readonly postMiddleware: any[],
		readonly interceptors: Interceptor[],
		readonly parentGroup: string,
		readonly controllerType: Function,
		readonly routeTable: any[],
		readonly definition: RouteDefinition
	) {
		this.options = this.definition.options ?? {};
		this.group = this.options.group || this.parentGroup;
		this.middleware = this.gatherMiddleware();
		this.resolvedMiddleware = this.prepareMiddleware(this.middleware);

		this.routeTable.push({
			controller: this.controllerType,
			route: this.definition
		});

		let routeParams = (this.definition.path || "").match(/:([A-Za-z][A-Za-z0-9]*)/g) || [];
		this.params = routeParams.map(x => x.substr(1));

		// Construct a set of easily addressable path parameter descriptions (pathParameterMap)
		// that can be decorated with insights from reflection later.

		this.methodMetadata = {
			returnType: this.getMethodReflectedMetadata("design:returntype"),
			paramTypes: this.getMethodReflectedMetadata("design:paramtypes"),
			paramNames: getParameterNames(this.controllerType.prototype[this.definition.method]),
			pathParamNames: this.getPathParams(this.definition.path),
			paramAnnotations: Annotations.getParameterAnnotations(this.controllerType, this.definition.method, false)
		}

		this.prepareParameters();

		// Validate Middleware

		let invalidIndex = this.middleware.findIndex(x => !x);
		if (invalidIndex >= 0)
			throw new Error(`Route '${this.definition.path}' provided null middleware at position ${invalidIndex}`);

		// Prepare metadata

		this.description = {
			definition: this.definition,
			httpMethod: this.definition.httpMethod,
			group: this.group,
			method: this.definition.method,
			path: this.definition.path,
			parameters: this.methodMetadata.pathParamNames
				.map(id => <RouteParamDescription>{
					name: id.replace(/^:/, ''),
					type: 'path'
				})
				.map(desc => this.pathParameterMap[desc.name] = desc)
		};
	}

	readonly params: string[];
	readonly options: RouteOptions;
	readonly group: string;
	readonly methodMetadata: RouteMethodMetadata;

	private _pathParameterMap: Record<string, RouteParamDescription> = {};

	get pathParameterMap() {
		return this._pathParameterMap;
	}

	readonly description: RouteDescription;

	private gatherMiddleware() {
		// Load up the defined middleware for this route
		let route = this.definition;
		let middleware = [
			...(this.server.options?.preRouteMiddleware ?? []),
			...this.preMiddleware,
			...(route.options.middleware ?? []),
			...this.postMiddleware,
			...(this.server.options?.postRouteMiddleware ?? [])
		];
		
		// Ensure indexes are valid.

		let invalidIndex = middleware.findIndex(x => !x);
		if (invalidIndex >= 0)
			throw new Error(`Route '${route.path}' provided null middleware at position ${invalidIndex}`);

		// Prepare the middlewares (if they are DI middlewares, they get injected)

		return middleware;
	}

	private prepareMiddleware(middleware: MiddlewareDefinition[]) {
		let resolvedMiddleware = middleware.map(x => prepareMiddleware(this.injector, x)) as ConnectMiddleware[];

		// Automatically handle body parsing 

		let { paramTypes, paramAnnotations } = this.methodMetadata;

		let bodyAnnotation = paramAnnotations
			.map(annots => annots.find(x => x instanceof InputAnnotation && x.type === 'body') as InputAnnotation)
			.filter(x => x)
		[0]
			;
		let bodyIndex = paramAnnotations.findIndex(annots => annots.some(x => x === bodyAnnotation));
		if (bodyAnnotation) {
			// need to add bodyParser
			const options = (bodyAnnotation ?? {}) as BodyOptions;
			const paramType = paramTypes[bodyIndex];
			let format = options.format;
			if (!format) {
				if (paramType === String)
					format = 'text';
				else if (paramType === Buffer)
					format = 'raw';
				else
					format = 'json';
			}

			let bodyMiddleware: any;
			if (format === 'text')
				bodyMiddleware = bodyParser.text({ type: () => true });
			else if (format === 'raw')
				bodyMiddleware = bodyParser.raw({ type: () => true });
			else if (format === 'json')
				bodyMiddleware = bodyParser.json({ type: () => true, strict: false });

			if (bodyMiddleware) {
				resolvedMiddleware.push(bodyMiddleware);
			}
		}

		return resolvedMiddleware;
	}

	middleware : MiddlewareProvider[];
	resolvedMiddleware : ConnectMiddleware[];

	private getMethodReflectedMetadata<T = unknown>(name: string): T {
		return Reflect.getMetadata(name, this.controllerType.prototype, this.definition.method);
	}

	private getPathParams(path: string) {
		return Object.keys(
			Array.from(path.match(/:([A-Za-z0-9]+)/g) ?? [])
				.reduce((pv, cv) => (pv[cv] = 1, pv), <Record<string, number>>{})
		);
	}

	private prepareParameters() {
		let controller = this.controllerType;
		let route = this.definition;
		let sourceName = `${controller.name || controller}.${route.method}()`;
		let { paramTypes, paramNames, paramAnnotations } = this.methodMetadata;
		
		for (let i = 0, max = paramNames.length; i < max; ++i) {
			this._parameters.push(new RouteMethodParameter(
				this,
				this.controllerType,
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

	_parameters: RouteMethodParameter[] = [];

	get parameters() {
		return this._parameters.slice();
	}

	private async execute(instance: any, event: WebEvent) {
		if (!instance)
			throw new ArgumentNullError('instance');

		event.controller = instance;
		event.server = this.server;
		event.route = this;

		if (!instance[this.definition.method]) {
			throw new ArgumentError(
				'instance',
				`Provided instance does not have an implementation `
				+ `for method ${this.definition.method}()`
			);
		}

		let route = this.definition;
		let controllerType = this.controllerType;
		let reportSource = `${controllerType.name}.${route.method}()`;

		this.server.reportRequest('middleware', event, reportSource);

		// Middleware

		await event.context(async () => {
			for (let item of this.resolvedMiddleware) {
				try {
					await new Promise<void>((resolve, reject) => item(event.request, event.response, (err?: any) => err ? reject(err) : resolve()));
				} catch (e) {
					event.metadata['uncaughtError'] = e;
					this.server.handleError(
						e,
						event, 
						this, 
						`Middleware ${item.name || 'anonymous'}()`
					);
					this.server.reportRequest('finished', event, reportSource);
					return;
				}
			}
		});	

		// Execute our function by resolving the parameter factories into a set of parameters to provide to the 
		// function.

		let resolvedParams: any[];

		try {
			resolvedParams = await Promise.all(this.parameters.map(x => x.resolve(event)));
		} catch (e) {
			event.metadata['uncaughtError'] = e;
			this.server.handleError(e, event, this, reportSource);
			this.server.reportRequest('finished', event, reportSource);
			return;
		}

		let displayableParams = resolvedParams
			.map(param => {
				if (typeof param === 'undefined')
					return 'undefined';

				try {
					return JSON.stringify(param);
				} catch (e) {
					return String(param);
				}
			})
			.map(param => ellipsize(this.server.options.longParameterThreshold ?? 100, param))
			;
		reportSource = `${controllerType.name}.${route.method}(${displayableParams.join(', ')})`;

		this.server.reportRequest('starting', event, reportSource);

		
		try { // To finally report request completion.

			let result;

			let interceptors = [
				...this.server.options.interceptors ?? [],
				...this.interceptors ?? [],
				...this.definition.options.interceptors ?? [],
			].reverse();

			try {
				result = await event.context(async () => {
					let action = (...params: any[]) => instance[route.method](...params);
					for (let interceptor of interceptors) {
						let inner = action;
						action = (...params) => interceptor(inner, ...params);
					}

					return await action(...resolvedParams);

				});
			} catch (e) {
				event.metadata['uncaughtError'] = e;
				this.server.handleError(e, event, this, reportSource);
				return;
			}

			// Return value handling

			if (result === undefined) {
				if (!event.response.headersSent && event.response.statusCode === 200)
					event.response.statusCode = 204;
				event.response.end();
				return;
			}

			if (result === null) {
				this.server.engine.sendJsonBody(event, result);
				return;
			}

			try {
				if (result.constructor === Response) {
					let response = <Response>result;

					event.response.statusCode = response.status;
					response.headers.forEach(x => event.response.setHeader(x[0], x[1]));

					if (response.encoding === 'raw') {
						if (response.body instanceof Buffer) {
							event.response.write(response.body);
						} else if (typeof response.body === 'string') {
							event.response.write(Buffer.from(response.body));
						} else if (response.body === undefined || response.body === null) {
							if (!event.response.headersSent && event.response.statusCode === 200)
								event.response.statusCode = 204;
						} else {
							throw new Error(`Unknown response body type ${response.body}`);
						}

						event.response.end();
					} else if (response.encoding === 'json') {
						if (response.unencodedBody)
							this.server.engine.sendJsonBody(event, response.unencodedBody);
						else
							event.response.end();
					} else {
						throw new Error(`Unknown encoding type ${response.encoding}`);
					}

				} else {
					// event.response
					// 	.status(200)
					// 	.send(result)
					// ;

					event.response.statusCode = 200;
					this.server.engine.sendJsonBody(event, result);
				}
			} catch (e) {
				console.error(`Caught exception:`);
				console.error(e);

				throw e;
			}
		} finally {
			this.server.reportRequest('finished', event, reportSource);
		}
	}

	/**
	 * Installs this route into the given web server application. 
	 * @param app 
	 */
	mount(pathPrefix: string) {
		this.description.pathPrefix = pathPrefix;

		this.server.addRoute(
			this.description,
			this.definition.httpMethod,
			`${pathPrefix || ''}${this.definition.path}`,
			async ev => {
				// SECURITY-SENSITIVE: Prevent denial-of-service by exploiting a fault within Alterior's request handling.
				// Return a 500 error to the client and log.

				try {
					return await this.execute(this.controllerInstance, ev);
				} catch (e: any) {
					this.server.logger.fatal(`Alterior failed to process request ${ev.request.method} ${ev.request.url}: ${e.stack || e.message || e}`);
					this.server.logger.fatal(`The above error was caught using Alterior's last-chance error handler. This is always a bug. Please report this issue.`);
					
					ev.metadata['uncaughtError'] = e;
					this.server.handleError(
						e,
						ev, 
						this,
						`Last-chance error handler (Alterior bug)`
					);
					this.server.reportRequest('finished', ev, `Last-chance error handler (Alterior bug)`);
				}
			},
			[]
		);
	}
}