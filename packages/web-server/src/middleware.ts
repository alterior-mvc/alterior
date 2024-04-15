import { Injector, ReflectiveInjector } from '@alterior/di';
import { Annotation, MetadataName } from '@alterior/annotations';
import { isConstructor } from '@alterior/common';
import type * as http from 'http';
import { ConnectMiddleware } from './web-server-engine';
import { Constructor } from '@alterior/runtime';
import { WebEvent } from './metadata';

@MetadataName('@alterior/web-server:Middleware')
export class MiddlewareAnnotation extends Annotation {}

export interface AlteriorMiddleware {
	handle(req: http.IncomingMessage, res: http.ServerResponse, next?: () => void): void;
}

export type MiddlewareProvider = Constructor<AlteriorMiddleware> | ConnectMiddleware;

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

	if (!isConstructor(middleware))
		return middleware;

	
	return (req, res, next) => {
		let ownInjector = ReflectiveInjector.resolveAndCreate([ 
			middleware,
			{ provide: WebEvent, useValue: WebEvent.current } 
		], injector);
		let instance = ownInjector.get(middleware);
		instance.handle(req, res, next)
	};
}
