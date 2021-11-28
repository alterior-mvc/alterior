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
	 * Specify a header (or a set of headers) which will be checked for a request ID when servicing a request. The 
	 * header must be all lowercase when specified here to match (regardless of the case of the incoming header).
	 * 
	 * If found, the value of the header will be used when showing logs that originated within the route handler. 
	 * You can also obtain the request ID using WebEvent.requestId. If unspecified (the default), no request ID header 
	 * is checked and a new UUID is generated for each request instead (which is also what happens when no request ID 
	 * is set).
	 * 
	 * This feature helps to enable distributed tracing when used in a microservices environment. The recommended 
	 * header name to use is 'x-trace'.
	 */
	requestIdHeader? : string | string[];

	/**
	 * The regular expression used to validate request IDs passed in from the outside world via the requestIdHeader. 
	 * If unspecified, the request ID is only accepted if it is a valid UUID.
	 */
	requestIdValidator? : RegExp;

	/**
	 * What protocols should be supported on incoming client connections If not specified, HTTP/2, SPDY and HTTP/1.1 
	 * will all be supported if an SSL certificate is provided. If not, then only HTTP/1.1 will be supported.
	 */
	protocols? : Protocol[];

	/**
	 * Connect-style middleware that should be run before the final request handler
	 */
    middleware? : Function[];

	/**
	 * Whether or not to hide exception details from the web response output
	 */
    hideExceptions? : boolean;

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
	 * Specify the default handler for a request when no other 
	 * route matches (aka 404). When explicitly set to `null`, 
	 * no default handler will be used (useful when chaining the
	 * Alterior application into a larger application)
	 */
	defaultHandler? : (ev : WebEvent) => void;

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