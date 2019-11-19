import { MetadataName, Annotation } from "@alterior/annotations";

export class InputOptions {
	type : string;
	name : string;
}

/**
 * Should be attached to a parameter to indicate how it should be fulfilled given the current
 * HTTP request.
 */
@MetadataName('@alterior/web-server:Input')
export class InputAnnotation extends Annotation {
	constructor(options : InputOptions) {
		super(options);
	}

	type : string;
	name : string;
}

/**
 * Apply to a parameter to indicate that it represents a query parameter (ie foo in /bar?foo=1)
 * @param name 
 */
export function QueryParam(name : string) {
	return InputAnnotation.decorator({
		validTargets: [ 'parameter' ],
		allowMultiple: false
	})({ 
		type: 'query', 
		name 
	});
}

/**
 * Apply to a parameter to indicate that it represents a session parameter (ie foo in /bar?foo=1)
 * @param name 
 */
export function Session(name? : string) {
	return InputAnnotation.decorator({
		validTargets: [ 'parameter' ],
		allowMultiple: false
	})({ 
		type: 'session', 
		name 
	});
}

/**
 * Apply to a parameter to indicate that it represents a path parameter (ie 'thing' in /hello/:thing)
 * @param name 
 */
export function PathParam(name : string) {
	return InputAnnotation.decorator({
		validTargets: [ 'parameter' ],
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
		validTargets: [ 'parameter' ],
		allowMultiple: false
	})({ 
		type: 'body', 
		name: '' 
	});
}
