import 'reflect-metadata';
import * as express from "express";
import * as http from "http";

// require('reflect-metadata');

import { accessControl } from './accesscontrol';
import { controllerClasses } from './controllers';
import { ReflectiveInjector, Provider } from '@angular/core';
import { mongoSession } from './sessions';
import * as mongodb from 'mongodb';
import { RouteReflector } from './controllers';
import { MongoClientFactory } from './mongo';
import { ExpressRef } from './express';
import { prepareMiddleware } from './middleware';

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
	providers? : Provider[];
	middleware? : (Function | [string, Function])[];
	controllers? : Function[];
	autoregisterControllers? : boolean;
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

	public shutdown() {
		// TODO: maybe https://www.npmjs.com/package/express-graceful-exit ?
		process.exit();
	}
}

export class ApplicationBase { 

	protected openAccessControl : boolean = true;

	constructor(config : any) {
		this.config = config;
		this.express = express();

		if (this.openAccessControl)
			this.express.use(accessControl);
		
		this.express.use('/static', express.static(config.uploadsPath));
	}

	public run() {
		this.initMongo().then(() => {
			this.initExpress();
			this.listen();
		}).catch(err => {
			console.error("error connecting to mongo");
			console.log(err);
			process.exit(1);
		})

	}

	private initExpress() {
		
		console.log("express init'ed");
		this.express.use(mongoSession(null));
		this.express.get('/', (req, res) => this.homeAction(req, res));

		console.log("controllers:");
		console.log(controllerClasses);

		this.controllers = controllerClasses.map(x => new x(this));
	}

	private controllers : any[];

	private initMongo(): Promise<void> {

		const mongoURL = "mongodb://localhost:27017/db";
		return <any>mongodb.MongoClient.connect(mongoURL)
			.then(db => this.db = db);
	}

	private listen() {
		console.log("listen");
		const apiPort = 3000;
		this.express.listen(apiPort, () => {
			console.log('Sliptap API listening on port 3000!');
		}); 
	}

	public homeAction(req : express.Request, res : express.Response) {
		res.send('@sliptap/backend.user-service');
	}

	public express : express.Application;
	public db : mongodb.Db;
	public config : any;


	public isAdmin(req): boolean {
		console.log('## admin check : starting ##');

		if (!req.session)
			return false;

		console.log('admin check : has session');

		console.log(req.session);
		if (!req.session.user)
			return false;

		console.log('admin check : has user');

		if (!req.session.user.isAdmin)
			return false;

		console.log('admin check : is admin');

		return true;
	}

	public init()
	{

	}
}