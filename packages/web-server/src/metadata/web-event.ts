import type { WebServer } from '../web-server';

import * as http from 'http';
import * as net from 'net';
import { RouteInstance } from '../route-instance';

export interface ServerSentEvent {
	event?: string;
	data?: any;
	id?: string;
	retry?: number;
}

export interface QueryParamMap {
	[key: string]: string | string[] | QueryParamMap | QueryParamMap[];
}

export interface WebRequest extends http.IncomingMessage {
	params?: Record<string, string>;
	query?: QueryParamMap;
	socket: net.Socket;
	session?: Record<string, any>;
	body?: any;
	path?: string;
}

/**
 * Represents 
 */
export class WebEvent<
	RequestT extends WebRequest = WebRequest, 
	ResponseT extends http.ServerResponse = http.ServerResponse
> {
	constructor(request: RequestT, response: ResponseT) {		
		this.request = request;
		this.response = response;
        if (this.request.socket) {
			this.request.socket.setMaxListeners(0);
			let handler = () => this.connected = false;
		    this.request.socket.on('close', handler);
			response.addListener('finish', () => {
				this.connected = false;
				this.request.socket.off('close', handler);
			})
		}

	}

	request: RequestT;
	response: ResponseT;
	controller: any;
	server?: WebServer;
	route?: RouteInstance;

	requestId?: string;

	/**
	 * An arbitrary place to store metadata regarding this request. 
	 * Preferable to use this as opposed to directly attaching 
	 * properties for performance reasons.
	 */
	metadata: Record<string | symbol, any> = {};
	
	/**
	 * Is the client still connected?
	 */
	connected = true;

	static get current(): WebEvent {
		return Zone.current.get('@alterior/web-server:WebEvent.current');
	}

	context<T>(callback: () => T): T {
		return WebEvent.with(this, callback);
	}

	static get request() {
		return this.current?.request;
	}

	static get response() {
		return this.current?.response;
	}

	static get controller() {
		return this.current?.controller;
	}

	/**
	 * Send a server-sent-event to the client as part of a "text/event-stream" response
	 * @param event 
	 */
	async sendEvent(event: ServerSentEvent) {
        if (!WebEvent.current)
            throw new Error(`WebSocket.start() can only be called while handling an incoming HTTP request`);
        
		let contentType = WebEvent.response.getHeader('content-type');

		if (contentType !== 'text/event-stream' && WebEvent.response.headersSent)
			throw new Error(`Cannot send server-sent-event, headers are already sent and content type is not text/event-stream (it is '${contentType}')`);

		if (!WebEvent.response.headersSent) {
			WebEvent.response.statusCode = 200;
			WebEvent.response.setHeader('Content-Type', 'text/event-stream');
			WebEvent.response.setHeader('Cache-Control', 'no-cache');
			WebEvent.response.removeHeader('Transfer-Encoding');
			WebEvent.response.flushHeaders();
		}
		
		let lines: string[] = [];

		if (event.event)
			lines.push(`event: ${event.event}`);
		if (event.id)
			lines.push(`id: ${event.id}`);
		if (event.retry)
			lines.push(`retry: ${event.retry}`);

		if (event.data) {
			lines.push(`data: ${JSON.stringify(event.data)}`);
		}

		WebEvent.request.socket.write(`${lines.join("\n")}\n\n`);
	}

	static async sendEvent(event: ServerSentEvent) {
		WebEvent.current.sendEvent(event);
	}

	/**
	 * Is the client still connected?
	 */
	static get connected() {
		return this.current.connected;
	}

	static with<T, RequestT extends WebRequest, ResponseT extends http.ServerResponse>(routeEvent: WebEvent<RequestT, ResponseT>, callback: () => T): T {
		let zone = Zone.current.fork({
			name: `WebEventZone`,
			properties: {
				'@alterior/web-server:WebEvent.current': routeEvent
			}
		});

		return zone.run(callback);
	}
}
