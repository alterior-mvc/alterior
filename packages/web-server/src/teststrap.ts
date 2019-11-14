import { ExpressRef } from "./express-ref";
import { Application, RolesService } from "@alterior/runtime";
import * as supertest from 'supertest';
import { Module } from "@alterior/di";
import { WebServerModule, WebServerOptionsRef } from "./web-server.module";
import { WebServerOptions } from "./web-server";
import { RouteEvent } from "./metadata";
import { RouteInstance } from "./route";
import { Annotations } from "@alterior/annotations";
import { WebServerRef } from "./web-server-ref";

export function teststrap(module : Function, options? : WebServerOptions) {
    return supertest(async (req, res, next) => {
        let app = await Application.bootstrap(module, { autostart: false });
        app.inject(WebServerRef).server.options.silent = true;

        app.inject(ExpressRef)
            .application(req, res, next);
    });
}

/**
 * Create a test setup for the given @alterior/web-server application. You must 
 * depend on `supertest` to use this.
 * 
 * @param app 
 * @param handler 
 */
export async function runTest(app : Application, handler : (test : supertest.SuperTest<supertest.Test>, done : Function) => any) {
    let expressRef = app.inject(ExpressRef);
    
    if (!expressRef) {
        throw new Error(`Could not get Express reference`);
    }
	let test = supertest(expressRef.application);

	return await new Promise(async (resolve, reject) => {
        let resolved = false;
		try {
			await handler(test, () => {
                resolve();
                app.stop();
            });
		} catch (e) {
            reject(e);
            app.stop();
            throw e;
		}
	})
}
