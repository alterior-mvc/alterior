import { Injector } from '@angular/core';

export function Middleware() {
	return (target) => {
		Reflect.defineMetadata("alterior:middleware", {

		}, target);
	};
}

export function prepareMiddleware(injector : Injector, middleware: any) {

	if (!middleware) {
		throw "Invalid middleware passed to prepareMiddleware()";
	}

	let alteriorMiddleware;
	
	try {
		alteriorMiddleware = Reflect.getMetadata('alterior:middleware', middleware);
	} catch (e) {
		return middleware;
	}

	if (alteriorMiddleware) {
		let instance = injector.get(alteriorMiddleware);
		return (req, res, next) => instance.handle(req, res, next);
	} else {
		return middleware;
	}

}
