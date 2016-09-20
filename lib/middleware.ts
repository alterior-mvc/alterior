import { Injector } from '@angular/core';

export function Middleware() {
	return (target) => {
		Reflect.defineMetadata("slvr:middleware", {

		}, target);
	};
}

export function prepareMiddleware(injector : Injector, middleware: any) {

	if (!middleware) {
		throw "Invalid middleware passed to prepareMiddleware()";
	}

	let slvrMiddleware;
	
	try {
		slvrMiddleware = Reflect.getMetadata('slvr:middleware', middleware);
	} catch (e) {
		return middleware;
	}

	if (slvrMiddleware) {
		let instance = injector.get(slvrMiddleware);
		return (req, res, next) => instance.handle(req, res, next);
	} else {
		return middleware;
	}

}
