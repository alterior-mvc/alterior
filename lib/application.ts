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
	 * Port to serve HTTP on. Defaults to 3000.
	 */
	port? : number;

	/**
	 * Dependency injection providers. If a promise is passed into this,
	 * it will be resolved into a provider before the application is booted.
	 */
	providers? : Provider[];

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
		Reflect.defineMetadata("slvr:Application", appOptions, target);
	}
}

export class ApplicationInstance {
	constructor(
		public app : any, 
		public express : express.Application,
		public http : http.Server
	) {

	}

	public stop() {
		// TODO: maybe https://www.npmjs.com/package/express-graceful-exit ?
		this.http.close();
		//process.exit();
	}

	public shutdown() {
		// TODO: maybe https://www.npmjs.com/package/express-graceful-exit ?
		process.exit();
	}
}
