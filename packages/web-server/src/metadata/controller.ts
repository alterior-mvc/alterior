import { Annotation, MetadataName } from "@alterior/annotations";
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
	 * Middleware to be applied to all route methods for this controller.
	 */
	middleware? : MiddlewareDefinition[];
	
	/**
	 * Wrap execution of controller methods with these interceptors. Earlier interceptors run first.
	 */
	interceptors?: Interceptor[];

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

}

@MetadataName('@alterior/web-server:Controller')
export class ControllerAnnotation extends Annotation {
	constructor(basePath? : string, readonly options? : ControllerOptions) {
		super();

		this.options = options || {};
		this.options.basePath = basePath || this.options.basePath;
	}
}

/**
 * Mark a class as representing an Alterior controller.
 * 
 * @param basePath The route path prefix that all routes within this 
 * 	controller will fall within.
 * @param options 
 */
export const Controller = ControllerAnnotation.decorator();