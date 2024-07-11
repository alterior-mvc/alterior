import { InjectionToken, provide } from "@alterior/di";
import { Logger } from "@alterior/logging";
import { Constructor } from "@alterior/runtime";
import * as tls from 'tls';
import { MiddlewareDefinition, WebEvent } from "./metadata";
import { RouteInstance } from "./route-instance";
import { WebServerEngine } from "./web-server-engine";
import { MiddlewareProvider } from "./middleware";

type Protocol = 'h2'
	| 'spdy/3.1'
	| 'spdy/3'
	| 'spdy/2'
	| 'http/1.1'
	| 'http/1.0';

/**
 * Defines the shape of a request reporting function. A function of this shape can be provided via the `requestReporter`
 * option when setting up a `@WebService`.
 */
export type RequestReporter = (reportingEvent: 'starting' | 'finished', event: WebEvent, source: string, logger: Logger) => void;

/**
 * Defines the shape of a request reporting filter function. This can be used to reduce the noise when a large amount of 
 * trivial requests are logged. These can be provided via the `requestReporterFilters` option when setting up a 
 * `@WebService`.
 */
export type RequestReporterFilter = (event: WebEvent, source: string) => boolean;

/**
 * Defines the shape of a function which formats parameters for display while reporting requests via the web server's
 * `Logger`. Can be specified via the `parameterDisplayFormatter` option when setting up a `@WebService`.
 */
export type ParameterDisplayFormatter = (event: WebEvent, value: any, forKey: string) => string;

export const WEB_SERVER_OPTIONS = new InjectionToken<WebServerOptions>("WEB_SERVER_OPTIONS");

export function provideWebServerOptions(options: WebServerOptions = {}) {
	return provide(WEB_SERVER_OPTIONS).usingValue(options);
}

export type InterceptedAction = (...args: any[]) => any;
export type Interceptor = (action: InterceptedAction, ...args: any[]) => any;

/**
 * Specifies options when setting up a `@WebService` class.
 */
export interface WebServerOptions {
	/**
	 * The primary port this service is available on. When TLS is specified via certificate/privateKey
	 * or sniHandler, this is HTTPS. Otherwise it is HTTP. To listen on both HTTPS and 
	 * HTTP, set this field to the secure port and set 
	 */
	port? : number;

	/**
	 * Override the default web server engine
	 */
	engine?: Constructor<WebServerEngine>;

	/**
	 * When using TLS via certificate/privateKey or sniHandler (and thus HTTPS is served), 
	 * this field lets you listen via HTTP on an additional port. If TLS is not configured,
	 * this does nothing.
	 */
	insecurePort?: number;
	
	/**
	 * Specify a certificate to use. To use SNI, do not specify this field,
	 * instead specify sniHandler. 
	 */
	certificate? : string | Buffer;

	/**
	 * Private key for the certificate provided in the `certificate` field. No meaning
	 * if the `certificate` field is not provided.
	 */
	privateKey? : string | Buffer;

	/**
	 * If you need to support SNI, provide an SNI handler here. This is mutually exclusive
	 * with `certificate`
	 * @param hostname 
	 * @returns 
	 */
	sniHandler?: (hostname: string) => Promise<tls.SecureContext>;

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
	 * 
	 * When listening on both HTTPS and HTTP (via the insecurePort option), you can specify the non-secure protocols
	 * to be supported via the insecureProtocols option.
	 */
	protocols? : Protocol[];

	/**
	 * When listening on both HTTPS and HTTP (via the insecurePort option), this specifies the protocols 
	 * supported by the HTTP port specified by insecurePort. If not specified, only HTTP/1.1 will be supported.
	 */
	insecureProtocols? : Protocol[];

	/**
	 * Connect-style middleware that should be run before the final request handler
	 */
    middleware? : MiddlewareDefinition[];

	/**
	 * Connect-style middleware that should be run before route-specific middleware 
	 * has been run.
	 */
    preRouteMiddleware? : (MiddlewareProvider)[];

	/**
	 * Connect-style middleware that should be run after route-specific middleware 
	 * has been run.
	 */
    postRouteMiddleware? : (MiddlewareProvider)[];

	/**
	 * Wrap the execution of all controller methods. Earlier interceptors run first.
	 */
	interceptors?: Interceptor[];

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

	/**
	 * A function responsible for reporting incoming requests to logging. See also
	 * WebServer.setRequestReporter().
	 */
	requestReporter?: RequestReporter;

	/**
	 * A set of filters which determine whether an incoming request should be reported via requestReporter.
	 * See also WebServer.addRequestReporterFilter() and WebServer.removeRequestReporterFilter()
	 */
	requestReporterFilters?: RequestReporterFilter[];

	/**
	 * How long before a request is considered to be running long and should be reported as such
	 * in the logs (in milliseconds). Defaults to 1000.
	 */
	longRequestThreshold?: number;

	/**
	 * How long before a request is considered to be hung and should be reported as such
	 * in the logs (in milliseconds). Defaults to 3000. The request will not be automatically resolved,
	 * this only affects logging.
	 */
	hungRequestThreshold?: number;

	/**
	 * Formatter function used when displaying parameters within logs
	 */
	parameterDisplayFormatter?: ParameterDisplayFormatter;

	/**
	 * A set of parameter names which should be considered sensitive. The values for such parameters will be 
	 * replaced with asterisks in logs.
	 */
	sensitiveParameters?: (string | RegExp)[];

	/**
	 * Placeholder to use when eliding a sensitive parameter value from logs. Defaults to '***'.
	 */
	sensitiveMask?: string;

	/**
	 * Any content within parameter values which matches the given regular expressions will be replaced with asterisks.
	 * Useful for filtering out API keys or other sensitive values with known formats.
	 */
	sensitivePatterns?: RegExp[];

	/**
	 * How many characters does a parameter have to be before it is ellipsized in the log entry for an
	 * incoming request. Applies to query parameters as well as method parameters. Defaults to 100 characters.
	 */
	longParameterThreshold?: number;
}