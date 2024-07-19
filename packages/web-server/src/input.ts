import { Annotation, MetadataName } from "@alterior/annotations";

type InputType = 'queryParam' | 'queryParams' | 'path' | 'body';

export interface InputOptions {
	type: InputType;
	name?: string;
	default?: any;
	format?: any;
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

	type!: InputType;
	/**
	 * The name of the input to bind to this parameter.
	 */
	name?: string;
	default?: any;
	format?: any;
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
 * @group Decorators
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
 * @group Decorators
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
 * @group Decorators
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

export interface BodyOptions {
	/**
	 * Override the default format selection based on type.
	 * This can be useful if the default selection doesn't match your use case.
	 * For instance, using the type `string` causes plain text body parsing. If you want to receive JSON strings
	 * instead, you can use `format: 'json'`.
	 */
	format?: 'json' | 'text' | 'raw';
}

/**
 * Apply to a parameter to indicate that it represents the body of the request. 
 * @group Decorators
 */
export function Body(options?: BodyOptions) {
	return InputAnnotation.decorator({
		validTargets: ['parameter'],
		allowMultiple: false
	})({
		type: 'body',
		name: '',
		...(options ?? {})
	});
}
