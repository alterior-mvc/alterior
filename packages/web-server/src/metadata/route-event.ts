import * as express from 'express';

/**
 * Represents 
 */
export class WebEvent {
	constructor(request : express.Request, response : express.Response) {
		this.request = request;
		this.response = response;
	}

	request : express.Request;
	response : express.Response;
	controller : any;

	static get current(): WebEvent {
		return Zone.current.get('@alterior/web-server:RouteEvent.current');
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

	static with<T>(routeEvent : WebEvent, callback : () => T): T {
		let zone = Zone.current.fork({
			name: `RouteEventZone`,
			properties: {
				'@alterior/web-server:RouteEvent.current': routeEvent
			}
		});

		return zone.run(callback);
	}
}
