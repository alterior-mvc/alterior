import { Annotation, MetadataName } from "@alterior/annotations";
import { BuiltinLifecycleEvents } from "@alterior/runtime";
import { MiddlewareProvider } from "../middleware";
import { Interceptor } from "../web-server-options";

export let CONTROLLER_CLASSES = [];
export type MiddlewareDefinition = MiddlewareProvider | [ string, MiddlewareProvider ];

export interface ControllerOptions {
	/**
	 * Group for methods which don't specify their API group.
	 */
	group? : string;

	/**
	 * A path segment to prepend to all routes in the controller
	 */
	basePath? : string;

	/**
	 * Middleware to be applied to the path prefix of this controller.
	 * 
	 * CAUTION: If you use prefix-less controllers (which is recommended), using this option may be unintuitive since 
	 * the middleware is applied *to all requests with the same prefix as the controller* regardless of what route 
	 * methods might be in the controller.
	 * 
	 * @deprecated Use globalMiddleware or preRouteMiddleware to avoid ambiguity.
	 */
	middleware? : MiddlewareDefinition[];
	
	/**
	 * Middleware to be applied to the path prefix of this controller. Such middleware will run regardless of whether 
	 * a specific route within this controller is actually matched.
	 * 
	 * CAUTION: If you use prefix-less controllers (which is recommended), using this option may be unintuitive since 
	 * the middleware is applied *to all requests with the same prefix as the controller* regardless of what route 
	 * methods might be in the controller.
	 */
	globalMiddleware?: MiddlewareDefinition[];

	/**
	 * Wrap execution of controller methods with these interceptors. Earlier interceptors run first.
	 */
	interceptors?: Interceptor[];

	/**
	 * Middleware that should be run before route-specific middleware has been run. Since the middleware is run as 
	 * part of route handling, it will only be run if a route matches. If you want middleware to run even if no 
	 * route matches, use `globalMiddleware` instead.
	 */
    preRouteMiddleware? : (MiddlewareProvider)[];

	/**
	 * Connect-style middleware that should be run after route-specific middleware 
	 * has been run.
	 */
    postRouteMiddleware? : (MiddlewareProvider)[];

}

@MetadataName('@alterior/web-server:Controller')
export class ControllerAnnotation extends Annotation {
	constructor(basePath? : string, readonly options? : ControllerOptions) {
		super();

		this.options = options || {};
		this.options.basePath = basePath || this.options.basePath;
	}
}

export const ALT_ON_LISTEN: unique symbol = Symbol.for('@alterior/web-server:onListen');

/**
 * Mark a class as representing an Alterior controller.
 * 
 * @param basePath The route path prefix that all routes within this 
 * 	controller will fall within.
 * @param options 
 * @group Decorators
 */
export const Controller = Object.assign(ControllerAnnotation.decorator(), {
	...BuiltinLifecycleEvents,

	/**
	 * Well-known name for a Controller method which is executed when the web server begins listening for
	 * requests.
	 */
	onListen: ALT_ON_LISTEN
} as const);
