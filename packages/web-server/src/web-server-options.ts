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

	/**
	 * A class which implements WebServerEngine. Can be one of
	 * the builtin engines (ExpressEngine, FastifyEngine) or 
	 * a custom engine
	 */
	engine? : any;

	/**
	 * Connect-style middleware that should be run before the final request handler
	 */
    middleware? : Function[];

	/**
	 * Whether or not to hide exception details from the web response output
	 */
    hideExceptions? : boolean;

	/**
	 * Has no effect
	 * @deprecated
	 */
    verbose? : boolean;

	/**
	 * By default the requests being processed are reported via the logger.
	 * When silent is true, this is suppressed.
	 */
	silent? : boolean;

	/**
	 * By default when an error occurs while processing
	 * a request, it is reported to the console for inspection.
	 * When silentErrors is true, this is suppressed.
	 */
	silentErrors? : boolean;

	/**
	 * A handler which is run when an error occurs while processing
	 * a request. After the handler is completed, the default error handling
	 * will proceed.
	 */
	onError? : (error : any, event : WebEvent, route : RouteInstance, source : string) => void;

	/**
	 * A handler which is run when an error occurs while processing
	 * a request. When this handler is defined, all default error handling 
	 * is skipped. If you want to observe errors without suppressing the default
	 * error handling, use onError instead.
	 */
	handleError? : (error : any, event : WebEvent, route : RouteInstance, source : string) => void;
}