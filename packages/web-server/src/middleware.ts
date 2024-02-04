import { Annotation, MetadataName } from '@alterior/annotations';
import { Injector, Type } from '@alterior/di';
import { Constructor } from '@alterior/runtime';
import { MiddlewareDefinition, MiddlewareFunction } from './metadata';

@MetadataName('@alterior/web-server:Middleware')
export class MiddlewareAnnotation extends Annotation { }
export const Middleware = MiddlewareAnnotation.decorator();

export function prepareMiddleware(injector: Injector, middleware: MiddlewareDefinition): Exclude<MiddlewareDefinition, Constructor<any>> {
	if (!middleware) {
		throw "Invalid middleware passed to prepareMiddleware()";
	}

	let middlewareMetadata = MiddlewareAnnotation.getForClass(middleware);
	if (middlewareMetadata) {
		let instance = injector.get(<Type<{ handle: MiddlewareFunction }>>middleware);
		return (req, res, next) => instance.handle(req, res, next);
	}

	return <Exclude<MiddlewareDefinition, Constructor<any>>>middleware;
}
