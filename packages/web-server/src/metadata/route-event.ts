import * as express from 'express';

export interface ServerSentEvent {
	event?: string;
	data?: any;
	id?: string;
	retry?: number;
}

export class WebEvent {
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

	static get current(): WebEvent {
		return Zone.current.get('@alterior/web-server:WebEvent.current');
	}

	context<T>(callback : () => T): T {
		return WebEvent.with(this, callback);
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
        if (!WebEvent.current)
            throw new Error(`WebSocket.start() can only be called while handling an incoming HTTP request`);
        
		let contentType = WebEvent.response.getHeader('content-type');

		if (contentType !== 'text/event-stream' && WebEvent.response.headersSent)
			throw new Error(`Cannot send server-sent-event, headers are already sent and content type is not text/event-stream (it is '${contentType}')`);

		if (!WebEvent.response.headersSent) {
			WebEvent.response.status(200);
			WebEvent.response.setHeader('Content-Type', 'text/event-stream');
			WebEvent.response.setHeader('Cache-Control', 'no-cache');
			WebEvent.response.removeHeader('Transfer-Encoding');
			WebEvent.response.flushHeaders();
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

		WebEvent.request.socket.write(`${lines.join("\n")}\n\n`);
	}

	static async sendEvent(event : ServerSentEvent) {
		WebEvent.current.sendEvent(event);
	}

	/**
	 * Is the client still connected?
	 */
	static get connected() {
		return this.current.connected;
	}

	static with<T>(routeEvent : WebEvent, callback : () => T): T {
		let zone = Zone.current.fork({
			name: `WebEventZone`,
			properties: {
				'@alterior/web-server:WebEvent.current': routeEvent
			}
		});

		return zone.run(callback);
	}
}
