import { Provider } from '@angular/core';

import * as express from 'express';
import * as http from 'http';

export interface OnSanityCheck {
	/**
	 * Perform a sanity check to see that this service would be healthy, if started.
	 */
	altOnSanityCheck() : Promise<boolean>;
}

export interface OnInit {
	altOnInit(); 
}

export interface ApplicationOptions {
	/**
	 * Enable verbose console logging for Alterior
	 */
	verbose? : boolean;

	/**
	 * Turn off all console output
	 */
	silent? : boolean;

	/**
	 * Hide exception information from 500 responses (should be set for production).
	 * Defaults to off (ie, exception information is included)
	 */
	hideExceptions? : boolean;

	/**
	 * Port to serve HTTP on. Defaults to 3000.
	 */
	port? : number;

	/**
	 * Start listening automatically.
	 */
	autostart?: boolean,

	/**
	 * Dependency injection providers. If a promise is passed into this,
	 * it will be resolved into a provider before the application is booted.
	 */
	providers? : (Provider | Promise<Provider>)[];

	/**
	 * Global and mounted middleware. Middleware included here will be
	 * applied to all routes unless you specify it as an array which contains
	 * a mountpoint string and the middleware function itself (ie ['/files', fileUpload])
	 */
	middleware? : (Function | [string, Function])[];

	/**
	 * Explicitly-defined controllers. Not needed unless autoregisterControllers is turned off.
	 */
	controllers? : Function[];

	/**
	 * If true, all classes with @Controller() annotation are included automatically.
	 */
	autoRegisterControllers? : boolean;
}

export function AppOptions(appOptions? : ApplicationOptions) {
	if (!appOptions) 
		appOptions = {};
	
	return function(target) {
		Reflect.defineMetadata("alterior:Application", appOptions, target);
	}
}

/**
 * Represents a complete application instance, aggregating the application class instance,
 * the Express application, and the node HTTP server object.
 * This class can be extended and provided via dependency injection.
 */
export class ApplicationInstance {
	constructor() {

	}

	
	public app : any;
	public express : express.Application;
	public http : http.Server;
	public configuredPort : number;

	/**
	 * Bind the application class instance, the express application, and the http server
	 * objects onto this ApplicationInstance.
	 */
	public bind(app, express : express.Application, port : number)
	{
		this.app = app;
		this.express = express;
		this.configuredPort = port;
	}

	public start() : http.Server {
		this.http = this.express.listen(this.configuredPort);
		return this.http;
	}

	/**
	 * Whether we are stopped (true) or not (false)
	 */
	public get stopped() {
		return this._stopped;		
	}

	private _stopped : boolean = false;

	/**
	 * Stop listening for new connections on HTTP
	 */
	public stop() {
		if (this.stopped)
			return;
		
		if (this.http == null)
			throw new Error("Application has not yet been started, or HTTP server is not managed by ApplicationInstance.");

		// TODO: maybe https://www.npmjs.com/package/express-graceful-exit ?

		this._stopped = true;
		this.http.close();
	}

	/**
	 * Shut down 
	 */
	public shutdown() {
		this.stop();
		process.exit();
	}
}
