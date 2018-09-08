require('wtfnode').init();

import { Controller } from './controller';
import { Get, RouteEvent } from './route';
import { Response as _Response } from './response';
import * as express from 'express';
import { HttpException } from '@alterior/common';
import { AppOptions, Application } from '@alterior/runtime';
import * as supertest from 'supertest';
import { expect } from 'chai';
import { suite } from 'razmin';
import { ExpressRef } from './express-ref';
import { Module } from '@alterior/di';
import { WebServerModule } from './web-server.module';
import { runTest } from './teststrap';

suite(describe => {
	describe("Response", it => {
		it('.created() should produce a 201 Created with response URL', () => {
			let body = {name: 'Foo'};
			let response = _Response.created('http://example.com/', body);

			expect(response.status).to.equal(201);
			expect(response.headers[0][0]).to.equal('Location');
			expect(response.headers[0][1]).to.equal('http://example.com/');
			expect(response.body).to.equal(JSON.stringify(body));
		});

		it('string body should be JSON encoded', () => {
			let body = {name: 'Foo'};
			let response = new _Response(200, [], "hello");
			expect(response.body).to.equal(`"hello"`);
		});

		it('.encodeAs(\'raw\') should cause body to be pass-through encoded', () => {
			let body = {name: 'Foo'};
			let response = new _Response(200, [], "hello").encodeAs('raw');
			expect(response.body).to.equal("hello");
		});

		it('.throw() should throw an equivalent HttpException', () => {
			let body = {name: 'Foo'};
			try {
				new _Response(123, [['X-Test', 'pass']], "hello").throw();
			} catch (e) {
				expect(e).to.be.an.instanceof(HttpException);
				let httpe = <HttpException>e;
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
    
			@Controller()
			class TestController {
				@Get('/foo')
				getX() {
					return new _Response(201, [['Content-Type', 'text/plain; charset=utf-8']], "token string")
								.encodeAs('raw');
				}
			} 

			@Module({
				controllers: [TestController],
				imports: [ WebServerModule.configure({ silent: true }) ]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await runTest(app, async (test, done) => {
				await test.get('/foo')
					.expect(201, <any>'token string')
					.expect('Content-Type', 'text/plain; charset=utf-8');
				done();
			});
		});

		it('should cause Content-Type: application/json when response is JSON', async () => {
    
			@Controller()
			class TestController {
				@Get('/foo')
				getX() {
					return new _Response(201, [], { stuff: 'and things' });
				}
			} 

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({ 
						port: 10009, 
						silent: true
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await runTest(app, async (test, done) => {
				await test.get('/foo')
					.expect(201, <any>'{"stuff":"and things"}')
					.expect('Content-Type', 'application/json; charset=utf-8');
				done();
			});
		});
	});
});