import express from "express";
import * as http from "http";
import * as https from "https";
import * as net from "net";
import * as spdy from "spdy";

import { Logger } from '@alterior/logging';
import { Injectable } from '@alterior/di';

import { WebEvent } from "./metadata";
import { WebServerEngine } from "./web-server-engine";
import { WebServerOptions } from './web-server-options';
import { CertificateGenerator } from './certificate-generator';

@Injectable()
export class ExpressEngine implements WebServerEngine {
	constructor(
		private logger : Logger
	) {
		this.app = express();
	}

	app : express.Application;
	
	get providers() {
		return [];
	}

	sendJsonBody(routeEvent : WebEvent, body : any) {
		routeEvent.response
			.header('Content-Type', 'application/json')
			.send(JSON.stringify(body))
		;
	}

	private readonly supportedMethods = [ 
		"checkout", "copy", "delete", "get", "head", "lock", "merge", 
		"mkactivity", "mkcol", "move", "m-search", "notify", "options", 
		"patch", "post", "purge", "put", "report", "search", "subscribe", 
		"trace", "unlock", "unsubscribe",
	];
	
	private getRegistrarName(method : string) {
		let registrar = method.toLowerCase();
		if (!this.supportedMethods.includes(registrar))
			throw new Error(`The specified method '${method}' is not supported by Express.`);
			
		return registrar;
	}

	addConnectMiddleware(path : string, middleware : any) {
		this.app.use(path, middleware);
	}

	async listen(options : WebServerOptions) {
		let server : http.Server;

		type Protocol = 'h2'
		| 'spdy/3.1'
		| 'spdy/3'
		| 'spdy/2'
		| 'http/1.1'
		| 'http/1.0';

		let protocols : Protocol[];
		
		if (options.certificate)
			protocols = ['h2', 'spdy/3.1', 'spdy/3', 'spdy/2', 'http/1.1', 'http/1.0'];
		else
			protocols = ['http/1.1', 'http/1.0'];

		if (options.protocols)
			protocols = options.protocols;
			
		let spdyEnabled = protocols.some(x => x.startsWith('spdy/')) || protocols.includes('h2');
		if (spdyEnabled && !options.certificate) {
			this.logger.info(`WebServer: Configured for HTTP2 but no certificates are provided. Generating self-signed certificates for testing...`);
			let generator = new CertificateGenerator();
			let certs = await generator.generate([
				{
	                name: 'commonName',
	                value: 'example.org'
	            }, {
	                name: 'countryName',
	                value: 'US'
	            }, {
	                shortName: 'ST',
	                value: 'Virginia'
	            }, {
	                name: 'localityName',
	                value: 'Blacksburg'
	            }, {
	                name: 'organizationName',
	                value: 'Test'
	            }, {
	                shortName: 'OU',
	                value: 'Test'
	            }
			]);
			options.certificate = certs.cert;
			options.privateKey = certs.private;
		}

		if (options.certificate) {
			if (spdyEnabled) {
				server = spdy.createServer({
					cert: options.certificate,
					key: options.privateKey,
					spdy: {
						protocols: options.protocols
					}
				}, this.app);

			} else {
				server = https.createServer({
					cert: options.certificate,
					key: options.privateKey
				}, this.app);
			}
		} else {
			server = http.createServer(this.app);
		}
		
		this.logger.info(`WebServer: Listening on port ${options.port}`);
		server.listen(options.port);

		server.on('upgrade', (req : http.IncomingMessage, socket : net.Socket, head : Buffer) => {
			let res = new http.ServerResponse(req);
			req['__upgradeHead'] = head;
			res.assignSocket(req.socket);
			this.app(req, res);
		});

		return server;
	}
	
	addRoute(method : string, path : string, handler : (event : WebEvent) => void, middleware?) {
		if (!middleware)
			middleware = [];
			
		this.app[this.getRegistrarName(method)](
			path, 
			...middleware, 
			(req, res) => {
				return handler(new WebEvent(req, res));
			}
		);
	}
}
