import { CONTROLLER_CLASSES, Controller } from './controller';
import { Get, Post, Put, Patch, Delete, Options, RouteEvent } from './route';
import { Response as _Response } from './response';
import * as assert from 'assert';
import * as express from 'express';
import * as http from 'http';
import * as bodyParser from 'body-parser';

import { HttpException } from './errors';

import { AppOptions } from './application';
import { bootstrap } from './bootstrap';
import * as supertest from 'supertest';
import { expect } from 'chai';

describe("response", () => {

	describe("Response", () => {
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
		
		it('should be accepted and used when given as return value of a controller route method', (done) => {
    
			@Controller()
			class TestController {
				@Get('/foo')
				getX(req : express.Request, res : express.Response) {
					return new _Response(201, [['Content-Type', 'text/plain; charset=utf-8']], "token string")
								.encodeAs('raw');
				}
			} 

			@AppOptions({ port: 10001, silent: true,
				autoRegisterControllers: false,
				controllers: [TestController]
			}) 
			class FakeApp {
			}

			bootstrap(FakeApp).then(app => {
				supertest(app.express)
					.get('/foo')
					.expect(201, <any>'token string')
					.expect('Content-Type', 'text/plain; charset=utf-8')
					.end((err, res) => {
						app.stop();
						if (err) 
							return done(err);

						done();	
					});
			});
		});

		it('should cause Content-Type: application/json when response is JSON', (done) => {
    
			@Controller()
			class TestController {
				@Get('/foo')
				getX(req : express.Request, res : express.Response) {
					return new _Response(201, [], { stuff: 'and things' });
				}
			} 

			@AppOptions({ port: 10001, silent: true,
				autoRegisterControllers: false,
				controllers: [TestController]
			}) 
			class FakeApp {
			}

			bootstrap(FakeApp).then(app => {
				supertest(app.express)
					.get('/foo')
					.expect(201, <any>'{"stuff":"and things"}')
					.expect('Content-Type', 'application/json; charset=utf-8')
					.end((err, res) => {
						app.stop();
						if (err) 
							return done(err);

						done();	
					});
			});
		});
	});
});