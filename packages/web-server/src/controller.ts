import { Annotation, MetadataName } from "@alterior/annotations";

export let CONTROLLER_CLASSES = [];

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
	middleware? : Function[];
}

@MetadataName('@alterior/web-server:Controller')
export class ControllerAnnotation extends Annotation {
	constructor(readonly options : ControllerOptions) {
		super();
	}
}

const _decorateController = ControllerAnnotation.decorator();

/**
 * Mark a class as representing an Alterior controller.
 * 
 * @param basePath The route path prefix that all routes within this 
 * 	controller will fall within.
 * @param options 
 */
export const Controller = (basePath? : string, options? : ControllerOptions) => 
	_decorateController(Object.assign({}, options || {}, { basePath }));