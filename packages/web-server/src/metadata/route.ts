
import * as express from 'express';
import { shallowClone } from '@alterior/common';
import { Provider } from '@alterior/di';

export class RouteReflector {
	constructor(type : Function, mountPath? : string) {

		let controllerMetadata = Reflect.getMetadata("alterior:Controller", type);
		let basePath = '/' + (mountPath || '').replace(/^\/+|\/+$/g, '');

		if (basePath === '/')
			basePath = '';
		
		if (controllerMetadata && controllerMetadata.basePath) {
			let controllerBasePath = controllerMetadata.basePath.replace(/^\/+|\/+$/g, '');
			if (controllerBasePath !== '') {
				basePath += `/${controllerBasePath}`;
			}
		}

		if (basePath === '/')
			basePath = '';
		
		this.routes = (type.prototype['alterior:routes'] || []).map(x => shallowClone(x));
		this.routes.forEach(route => {
			route.path = `${basePath}/${route.path.replace(/^\/*/, '')}`.replace(/\/+$/g, '');
			if (route.path === '')
				route.path = '/';
		});

		this.mounts = (type.prototype['alterior:mounts'] || []).map(x => shallowClone(x));
		this.mounts.forEach(mount => {
			let definedMountPath = mount.path || '';
			mount.path = `${basePath}/${definedMountPath.replace(/^\/*/, '')}`
			
			if (!mount.controllers)
				mount.controllers = [];

			if (mount.options && mount.options.controllers)
				mount.controllers.push(...mount.options.controllers);
		});
	}

	public routes : RouteDefinition[];
	public mounts : MountDefinition[];
}

export interface MountDefinition {
	path : string;
	controllers : Function[];
	options : MountOptions;
	
	propertyKey? : string;
}

export interface MountOptions {
	providers? : Provider[];
	controllers? : Function[];
}

export interface ServerSentEvent {
	event?: string;
	data?: any;
	id?: string;
	retry?: number;
}

export interface RouteDefinition {
	method : string;
	httpMethod : string;
	options : RouteOptions;
	path : string;
}

export class RouteEvent {
	constructor(request : express.Request, response : express.Response) {
		this.request = request;
		this.response = response;
		this.request.socket.on('close', () => this.connected = false);
	}

	request : express.Request;
	response : express.Response;
	controller : any;

	/**
	 * Is the client still connected?
	 */
	connected = true;

	static get current(): RouteEvent {
		return Zone.current.get('@alterior/web-server:RouteEvent.current');
	}

	context<T>(callback : () => T): T {
		return RouteEvent.with(this, callback);
	}

	static get request() {
		return this.current.request;
	}

	static get response() {
		return this.current.response;
	}

	static get controller() {
		return this.current.controller;
	}

	/**
	 * Send a server-sent-event to the client as part of a "text/event-stream" response
	 * @param event 
	 */
	async sendEvent(event : ServerSentEvent) {
        if (!RouteEvent.current)
            throw new Error(`WebSocket.start() can only be called while handling an incoming HTTP request`);
        
		let contentType = RouteEvent.response.getHeader('content-type');

		if (contentType !== 'text/event-stream' && RouteEvent.response.headersSent)
			throw new Error(`Cannot send server-sent-event, headers are already sent and content type is not text/event-stream (it is '${contentType}')`);

		if (!RouteEvent.response.headersSent) {
			RouteEvent.response.status(200);
			RouteEvent.response.setHeader('Content-Type', 'text/event-stream');
			RouteEvent.response.setHeader('Cache-Control', 'no-cache');
			RouteEvent.response.removeHeader('Transfer-Encoding');
			RouteEvent.response.flushHeaders();
		}
		
		let lines : string[] = [];

		if (event.event)
			lines.push(`event: ${event.event}`);
		if (event.id)
			lines.push(`id: ${event.id}`);
		if (event.retry)
			lines.push(`retry: ${event.retry}`);

		if (event.data) {
			lines.push(`data: ${JSON.stringify(event.data)}`);
		}

		RouteEvent.request.socket.write(`${lines.join("\n")}\n\n`);
	}

	static async sendEvent(event : ServerSentEvent) {
		RouteEvent.current.sendEvent(event);
	}

	/**
	 * Is the client still connected?
	 */
	static get connected() {
		return this.current.connected;
	}

	static with<T>(routeEvent : RouteEvent, callback : () => T): T {
		let zone = Zone.current.fork({
			name: `RouteEventZone`,
			properties: {
				'@alterior/web-server:RouteEvent.current': routeEvent
			}
		});

		return zone.run(callback);
	}
}

export interface RouteOptions {
	middleware?: Function[];
	description?: string;
	summary?: string;
	group?: string;
}

export function Get(path? : string, options? : RouteOptions) { return Route('GET', path, options); }
export function Put(path? : string, options? : RouteOptions) { return Route('PUT', path, options); }
export function Post(path? : string, options? : RouteOptions) { return Route('POST', path, options); }
export function Delete(path? : string, options? : RouteOptions) { return Route('DELETE', path, options); }
export function Options(path? : string, options? : RouteOptions) { return Route('OPTIONS', path, options); }
export function Patch(path? : string, options? : RouteOptions) { return Route('PATCH', path, options); }

export function Route(method : string, path? : string, options? : RouteOptions) {
    return function (target: Object, propertyKey: string, descriptor: PropertyDescriptor) {


		if (!target.hasOwnProperty('alterior:routes')) {
			Object.defineProperty(target, 'alterior:routes', {
				enumerable: false,
				value: []
			});
		}

		target['alterior:routes'].push(<RouteDefinition>{
			method: propertyKey,
			httpMethod: method || "GET", 
			options: options || {},
			path: path || ''
		});
	};
}

export function Mount(path? : string, options? : MountOptions) {
    return function (target: any, propertyKey: string) {
		let mounts = target['alterior:mounts'] || [];

		mounts.push(<MountDefinition>{
			path: path,
			options: options,
			propertyKey
		});

		target['alterior:mounts'] = mounts;
	};
}