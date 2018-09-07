import { ExpressRef } from "./express-ref";
import { Application } from "@alterior/runtime";
import * as supertest from 'supertest';

/**
 * Create a test setup for the given @alterior/web-server application. You must 
 * depend on `supertest` to use this.
 * 
 * @param app 
 * @param handler 
 */
export async function teststrap(app : Application, handler : (test : supertest.SuperTest<supertest.Test>, done : Function) => void) {
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
