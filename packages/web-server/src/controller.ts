
export let CONTROLLER_CLASSES = [];

export interface ControllerOptions {
	/**
	 * Whether this controller should participate in auto-loading, if that is enabled at the 
	 * application level. Defaults to true. Should be set to false for library controllers so
	 * that the application must explicitly enable them by including them in a module definition.
	 */
	autoRegister? : boolean;

	/**
	 * Group for methods which don't specify their API group.
	 */
	group? : string;
}

/**
 * Mark a class as representing an Alterior controller.
 * 
 * @param basePath The route path prefix that all routes within this controller will fall within.
 * @param options 
 */
export function Controller(basePath? : string, options? : ControllerOptions) {
	return function(target) {
		
		// Add our parameters in as keys of the main metadata 
		// item

		Reflect.defineMetadata("alterior:Controller", {
			basePath: basePath,
			options
		}, target);

		// Add the controller to the global registry
		
		let enableAutoload = options ? options.autoRegister !== false : true;

		if (enableAutoload)
			CONTROLLER_CLASSES.push(target);
	}
}