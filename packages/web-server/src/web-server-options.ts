import { WebEvent } from "./metadata";
import { RouteInstance } from "./route";

type Protocol = 'h2'
	| 'spdy/3.1'
	| 'spdy/3'
	| 'spdy/2'
	| 'http/1.1'
	| 'http/1.0';

export interface WebServerOptions {
	port? : number;
	certificate? : string | Buffer;
	privateKey? : string | Buffer;

	/**
	 * What protocols should be supported on incoming client connections
	 * If not specified, HTTP/2, SPDY and HTTP/1.1 will all be supported
	 * if an SSL certificate is provided. If not, then only HTTP/1.1 will
	 * be supported.
	 */
	protocols? : Protocol[];
	engine? : any;
    middleware? : Function[];
    hideExceptions? : boolean;
    verbose? : boolean;
	silent? : boolean;
	silentErrors? : boolean;
	onError? : (error : any, event : WebEvent, route : RouteInstance, source : string) => void;
	handleError? : (error : any, event : WebEvent, route : RouteInstance, source : string) => void;
}