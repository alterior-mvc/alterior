import { Annotation, MetadataName } from "@alterior/annotations";

export interface InputOptions {
	type: string;
	name?: string;
	default?: any;
}

/**
 * Should be attached to a parameter to indicate how it should be fulfilled given the current
 * HTTP request.
 */
@MetadataName('@alterior/web-server:Input')
export class InputAnnotation extends Annotation {
	constructor(options: InputOptions) {
		super(options);
	}

	type!: string;
	name?: string;
	default?: any;
}

export interface QueryParamOptions {
	/**
	 * Specify a default value for this parameter when it is not present 
	 * in the request.
	 */
	default: any;
}

/**
 * Apply to a parameter to indicate that it represents a query parameter (ie foo in /bar?foo=1)
 * @param name 
 */
export function QueryParam(name?: string, options?: QueryParamOptions) {
	return InputAnnotation.decorator({
		validTargets: ['parameter'],
		allowMultiple: false
	})({
		type: 'queryParam',
		name,
		default: options?.default
	});
}

/**
 * Apply to a parameter to indicate that it represents a query parameter (ie foo in /bar?foo=1)
 * @param name 
 */
export function QueryParams() {
	return InputAnnotation.decorator({
		validTargets: ['parameter'],
		allowMultiple: false
	})({
		type: 'queryParams',
		default: {}
	});
}

/**
 * Apply to a parameter to indicate that it represents a path parameter (ie 'thing' in /hello/:thing)
 * @param name 
 */
export function PathParam(name?: string) {
	return InputAnnotation.decorator({
		validTargets: ['parameter'],
		allowMultiple: false
	})({
		type: 'path',
		name
	});
}

/**
 * Apply to a parameter to indicate that it represents the body of the request. 
 */
export function Body() {
	return InputAnnotation.decorator({
		validTargets: ['parameter'],
		allowMultiple: false
	})({
		type: 'body',
		name: ''
	});
}
