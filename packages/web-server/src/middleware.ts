import { Injector, ReflectiveInjector } from '@alterior/di';
import { Annotation, MetadataName } from '@alterior/annotations';
import { isClass } from '@alterior/common';
import type * as http from 'http';
import { ConnectMiddleware } from './web-server-engine';
import { Constructor } from '@alterior/runtime';
import { RequestBase, ResponseBase, WebEvent } from './metadata';

@MetadataName('@alterior/web-server:Middleware')
export class MiddlewareAnnotation extends Annotation {}

export interface AlteriorMiddlewareProvider {
	handle(req: RequestBase, res: ResponseBase, next: () => void): void;
}

export type AlteriorMiddlewareFunction = (req: RequestBase, res: ResponseBase, next: () => void) => void;
export type AlteriorMiddleware = Constructor<AlteriorMiddlewareProvider> | AlteriorMiddlewareFunction;
export type MiddlewareProvider =  AlteriorMiddleware | ConnectMiddleware;

/**
 * Mark a class as a Middleware provider. 
 * 
 * @deprecated No longer necessary, will be removed in 4.0.0. You should remove this decorator but note that you 
 * 		may need to add `@Injectable()` if you are using constructor parameter injection
 */
export const Middleware = MiddlewareAnnotation.decorator();

export function prepareMiddleware(injector : Injector, middleware: any) {
	if (!middleware)
		throw new Error(`Invalid middleware passed to prepareMiddleware()`);

	if (!isClass(middleware))
		return middleware;

	
	return (req: RequestBase, res: ResponseBase, next: () => void) => {
		let ownInjector = ReflectiveInjector.resolveAndCreate([ 
			middleware,
			{ provide: WebEvent, useValue: WebEvent.current } 
		], injector);
		let instance = ownInjector.get(middleware);
		instance.handle(req, res, next)
	};
}
