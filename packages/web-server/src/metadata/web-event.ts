import * as http from 'http';
import * as http2 from 'http2';

import type { WebServer } from '../web-server';
import { RouteInstance } from '../route';
import { InjectionToken } from '@alterior/di';
import { AnyConstructor } from '@alterior/runtime';

export interface ServerSentEvent {
	event?: string;
	data?: any;
	id?: string;
	retry?: number;
}

export type RequestBase = (http.IncomingMessage | http2.Http2ServerRequest) & {
    path: string;
    __upgradeHead?: Buffer;
}

export type ResponseBase = (http.ServerResponse | http2.Http2ServerResponse) & {
    write(chunk: string | Uint8Array<ArrayBufferLike>, callback?: (err: Error | null | undefined) => void): boolean;
    write(chunk: string | Uint8Array, encoding: BufferEncoding, callback?: (err: Error | null | undefined) => void): boolean;
};

/**
 * Represents 
 */
export class WebEvent<
	RequestT extends RequestBase = RequestBase, 
	ResponseT extends ResponseBase = ResponseBase
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
	server: WebServer | undefined;
	route: RouteInstance | undefined;
	requestId: string | undefined;

	inject<T>(token: InjectionToken<T> | AnyConstructor<T>): T {
        if (!this.server)
            throw new Error(`Dependency injection is not available on a WebEvent without an associated WebServer`);
		return this.server.injector.get(token);
	}

	static inject<T>(token: InjectionToken<T> | AnyConstructor<T>): T {
		return this.current.inject(token);
	}

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
		return WebEvent.with<T, RequestT, ResponseT>(this, callback);
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
        
        const request = WebEvent.request;
        const response = WebEvent.response;

		let contentType = response.getHeader('content-type');

		if (contentType !== 'text/event-stream' && response.headersSent)
			throw new Error(`Cannot send server-sent-event, headers are already sent and content type is not text/event-stream (it is '${contentType}')`);

		if (!response.headersSent) {
			response.statusCode = 200;
			response.setHeader('Content-Type', 'text/event-stream');
			response.setHeader('Cache-Control', 'no-cache');
			response.removeHeader('Transfer-Encoding');
            if ('flushHeaders' in response)
			    response.flushHeaders();
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

		request.socket.write(`${lines.join("\n")}\n\n`);
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

	static with<T, RequestT extends RequestBase = RequestBase, ResponseT extends ResponseBase = ResponseBase>(routeEvent: WebEvent<RequestT, ResponseT>, callback: () => T): T {
		let zone = Zone.current.fork({
			name: `WebEventZone`,
			properties: {
				'@alterior/web-server:WebEvent.current': routeEvent
			}
		});

		return zone.run(callback);
	}
}
