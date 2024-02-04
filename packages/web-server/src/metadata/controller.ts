import { Annotation, AnnotationDecorator, MetadataName } from "@alterior/annotations";
import { Constructor } from "@alterior/runtime";
import { IncomingMessage, ServerResponse } from "http";

export let CONTROLLER_CLASSES = [];

export type MiddlewareFunction = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
export type MiddlewareDefinition = Constructor<any> | MiddlewareFunction | [ string, MiddlewareFunction ];

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