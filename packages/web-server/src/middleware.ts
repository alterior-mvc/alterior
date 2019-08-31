import { Injector, ReflectiveInjector } from '@alterior/di';
import { Annotation, AnnotationDecorator, MetadataName } from '@alterior/annotations';

@MetadataName('@alterior/web-server:Middleware')
export class MiddlewareAnnotation extends Annotation {}
export const Middleware = MiddlewareAnnotation.decorator();

export function prepareMiddleware(injector : Injector, middleware: any) {

	if (!middleware) {
		throw "Invalid middleware passed to prepareMiddleware()";
	}

	let middlewareMetadata : MiddlewareAnnotation;
	
	try {
		middlewareMetadata = MiddlewareAnnotation.getForClass(middleware);
	} catch (e) {
		return middleware;
	}

	if (middlewareMetadata) {
		let ownInjector = ReflectiveInjector.resolveAndCreate([ middleware ], injector);
		let instance = ownInjector.get(middleware);
		return (req, res, next) => instance.handle(req, res, next);
	} else {
		return middleware;
	}
}
