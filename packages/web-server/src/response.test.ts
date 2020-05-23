import { Controller, Get } from './metadata';
import { Response } from './response';
import { HttpError } from '@alterior/common';
import { Application } from '@alterior/runtime';
import { expect } from 'chai';
import { suite } from 'razmin';
import { Module } from '@alterior/di';
import { WebServerModule } from './web-server.module';
import { ExpressRef } from './express-ref';

import supertest from 'supertest';
import { WebService } from './service';
import { teststrap } from './teststrap';

/**
 * Create a test setup for the given @alterior/web-server application. You must 
 * depend on `supertest` to use this.
 * 
 * @param app 
 * @param handler 
 */
async function runTest(app : Application, handler : (test : supertest.SuperTest<supertest.Test>, done : Function) => any) {
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

suite(describe => {
	describe("Response", it => {
		it('.created() should produce a 201 Created with response URL', () => {
			let body = {name: 'Foo'};
			let response = Response.created('http://example.com/', body);

			expect(response.status).to.equal(201);
			expect(response.headers[0][0]).to.equal('Location');
			expect(response.headers[0][1]).to.equal('http://example.com/');
			expect(response.body).to.equal(JSON.stringify(body));
		});

		it('string body should be JSON encoded', () => {
			let body = {name: 'Foo'};
			let response = new Response(200, [], "hello");
			expect(response.body).to.equal(`"hello"`);
		});

		it('.encodeAs(\'raw\') should cause body to be pass-through encoded', () => {
			let body = {name: 'Foo'};
			let response = new Response(200, [], "hello").encodeAs('raw');
			expect(response.body).to.equal("hello");
		});

		it('.throw() should throw an equivalent HttpError', () => {
			let body = {name: 'Foo'};
			try {
				new Response(123, [['X-Test', 'pass']], "hello").throw();
			} catch (e) {
				expect(e).to.be.an.instanceof(HttpError);
				let httpe = <HttpError>e;
				expect(httpe.body).to.equal(`"hello"`);
				expect(httpe.statusCode).to.equal(123);
				expect(httpe.headers.length).to.equal(2);
				expect(httpe.headers[0][0]).to.equal('X-Test');
				expect(httpe.headers[0][1]).to.equal('pass');
				expect(httpe.headers[1][0]).to.equal('Content-Type');
				expect(httpe.headers[1][1]).to.equal('application/json; charset=utf-8');
			}
		});
		
		it('should be accepted and used when given as return value of a controller route method', async () => {
    
			@WebService({
				server: { silent: true }
			})
			class FakeApp {
				@Get('/foo')
				getX() {
					return new Response(
						201, 
						{
							'Content-Type': 'text/plain; charset=utf-8'
						},
						"token string"
					).encodeAs('raw');
				}
			}

			await teststrap(FakeApp)
				.get('/foo')
				.expect(201, <any>'token string')
				.expect('Content-Type', 'text/plain; charset=utf-8')
			;
		});

		it('should cause Content-Type: application/json when response is JSON', async () => {
    
			@WebService({
				server: { silent: true }
			})
			class FakeApp {
				@Get('/foo')
				getX() {
					return new Response(201, [], { stuff: 'and things' });
				}
			}

			teststrap(FakeApp)
				.get('/foo')
				.expect(201, <any>'{"stuff":"and things"}')
				.expect('Content-Type', 'application/json; charset=utf-8')
			;
		});
	});
});