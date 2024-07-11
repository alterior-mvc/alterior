import { Annotation, MetadataName } from '@alterior/annotations';
import { isClass } from '@alterior/common';
import { Injector, ReflectiveInjector } from '@alterior/di';
import { Constructor } from '@alterior/runtime';
import { MiddlewareDefinition, WebEvent } from './metadata';
import { ConnectMiddleware } from './web-server-engine';

import type * as http from 'http';

@MetadataName('@alterior/web-server:Middleware')
export class MiddlewareAnnotation extends Annotation { }

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

export function prepareMiddleware(injector: Injector, middlewareDefn: MiddlewareDefinition): Exclude<MiddlewareDefinition, Constructor<any>> {
	if (!middlewareDefn)
		throw new Error("Invalid middleware definition passed to prepareMiddleware()");

	let middleware: Exclude<MiddlewareDefinition, [ string, ConnectMiddleware ]>;
	let path: string | undefined;

	if (Array.isArray(middlewareDefn)) {
		path = middlewareDefn[0];
		middleware = middlewareDefn[1];
	} else {
		path = undefined;
		middleware = middlewareDefn;
	}

	if (!isClass(middleware))
		return rewrapMiddleware(path, middleware as ConnectMiddleware);

	return rewrapMiddleware(path, (req, res, next) => {
		let ownInjector = ReflectiveInjector.resolveAndCreate([ 
			middleware as Constructor<any>,
			{ provide: WebEvent, useValue: WebEvent.current } 
		], injector);
		let instance = ownInjector.get(middleware);
		instance.handle(req, res, next)
	});
}

function rewrapMiddleware(path: string | undefined, middleware: ConnectMiddleware): Exclude<MiddlewareDefinition, Constructor<any>> {
	if (path)
		return [path, middleware];
	return middleware;
}