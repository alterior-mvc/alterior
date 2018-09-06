import { Controller as _Controller } from './controller';
import { Get, Post, Put, Patch, Delete, Options, RouteEvent } from './route';
import { suite } from 'razmin';
import * as assert from 'assert';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import { HttpException } from '@alterior/common';
import * as supertest from 'supertest';
import { Application } from '@alterior/runtime';
import { ExpressRef } from './express-ref';
import { Module } from '@alterior/di';
import { WebServerModule } from './web-server.module';
import { teststrap } from './teststrap';

let nextFreePort = 10010;

function fakeAppVarietyOfMethods() {
	@_Controller()
	class TestController {
		@Get('/foo')
		getX(req : express.Request, res : express.Response) {
			res.status(200).send(JSON.stringify({foo:"get"}));
		}

		@Post('/foo')
		postX(req : express.Request, res : express.Response) {
			res.status(200).send(JSON.stringify({foo:"post"}));
		}

		@Put('/foo')
		putX(req : express.Request, res : express.Response) {
			res.status(200).send(JSON.stringify({foo:"put"}));
		}

		@Patch('/foo')
		patchX(req : express.Request, res : express.Response) {
			res.status(200).send(JSON.stringify({foo:"patch"}));
		}

		@Delete('/foo')
		deleteX(req : express.Request, res : express.Response) {
			res.status(200).send(JSON.stringify({foo:"delete"}));
		}

		@Options('/foo')
		optionsX(req : express.Request, res : express.Response) {
			res.status(200).send(JSON.stringify({foo:"options"}));
		}
	}

	@Module({ 
		controllers: [TestController],
		imports: [
			WebServerModule.configure({
				port: nextFreePort++, 
				silent: true,
				middleware: [
					(req, res, next) => { 
						res.header('Content-Type', 'application/json'); 
						next(); 
					}
				]
			})
		]
		
	}) 
	class FakeApp {
	}

	return FakeApp;
}

suite(describe => {
	describe("RouteDecorator", it => {
		it('should register routes defined on controllers and respond to them', async () => {
			@_Controller()
			class TestController {
				@Get('/foo')
				foo(req : express.Request, res : express.Response) {
					res.status(200).send(JSON.stringify({foo:123}));
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({
						silent: true,
						middleware: [
							(req, res, next) => { res.header('Content-Type', 'application/json'); next(); }
						]
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				await test.get('/foo').expect(200, <any>{ foo: 123 });
				app.stop();
				done();
			});
		});

		it('should allow a method to return a promise', async () => {
			@_Controller()
			class TestController {
				@Get('/foo')
				getX(req : express.Request, res : express.Response) {
					return Promise.resolve({foo:"we promised"});
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({ 
						silent: true,
						middleware: [
							(req, res, next) => { 
								res.header('Content-Type', 'application/json'); 
								next(); 
							}
						]
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			
		});
	
		it('should allow a method to return null as a JSON value', async () => {
			@_Controller()
			class TestController {
				@Get('/foo')
				getX(req : express.Request, res : express.Response) {
					return null;
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({ silent: true,
						middleware: [
							(req, res, next) => { 
								res.header('Content-Type', 'application/json'); 
								next(); 
							}
						]
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				await test.get('/foo').expect(200, <any>null);
				app.stop();
				done();
			});
		});

		it('should bind parameter `session` to `request.session`', async () => {
			@_Controller()
			class TestController {
				@Get('/foo')
				getX(session : any) {
					return Promise.resolve({foo:session.test});
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({ port: nextFreePort++, silent: true,
						middleware: [
							(req, res, next) => {
								req.session = { test: 123 }; 
								res.header('Content-Type', 'application/json'); 
								next(); 
							}
						]
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				await test.get('/foo').expect(200, <any>{ foo: 123 });
				app.stop();
				done();
			});
		});

		it('should allow a method to return an explicit body value', async () => {
			@_Controller()
			class TestController {
				@Get('/foo')
				getX(req : express.Request, res : express.Response) {
					return {foo:"we promised"};
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({ port: nextFreePort++, silent: true,
						middleware: [
							(req, res, next) => { 
								res.header('Content-Type', 'application/json'); 
								next(); 
							}
						]
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				await test.get('/foo').expect(200, <any>{ foo: "we promised" });
				app.stop();
				done();
			});
		});

		it('should re-encode a string return value as JSON', async () => {
			@_Controller()
			class TestController {
				@Get('/foo')
				getX(req : express.Request, res : express.Response) {
					return "token value";
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({ port: nextFreePort++, silent: true,
						middleware: [
							(req, res, next) => { 
								res.header('Content-Type', 'application/json'); 
								next(); 
							}
						] 
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				await test.get('/foo').expect(200, <any>'"token value"');
				app.stop();
				done();
			});
		});

		it('should 500 when a method returns a promise that rejects', async () => {
			@_Controller()
			class TestController {
				@Get('/foo')
				getX(req : express.Request, res : express.Response) {
					return Promise.reject(new Error("All the things went wrong"));
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({ 
						silent: true,
						middleware: [
							(req, res, next) => { res.header('Content-Type', 'application/json'); next(); }
						]
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				await test.get('/foo').expect(500);
				app.stop();
				done();
			});
		});

		it('should act accordingly when a method returns a promise that rejects with an HttpException', async () => {
			@_Controller()
			class TestController {
				@Get('/foo')
				getX(req : express.Request, res : express.Response) {
					return Promise.reject(new HttpException(300, [['X-Test', 'pass']], {bar:777}));
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({
						silent: true,
						middleware: [
							(req, res, next) => { 
								res.header('Content-Type', 'application/json'); 
								next(); 
							}
						]
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				await test
					.get('/foo')
					.expect(300, <any>{
						bar: 777
					})
					.expect('X-Test', 'pass');

				app.stop();
				done();
			});
		});

		it('should include the stack trace of a caught Error in a 500 response', async () => {
			let error = new Error('testytest');
			let stackText = error.stack;

			@_Controller()
			class TestController {
				@Get('/foo')
				getX(req : express.Request, res : express.Response) {
					throw error;
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({
						silent: true,
						middleware: [
							(req, res, next) => { 
								res.header('Content-Type', 'application/json'); 
								next(); 
							}
						]
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				let result = await test.get('/foo')
					.expect(500, <any>{
						message: 'An exception occurred while handling this request.',
						error: stackText
					});

				app.stop();
				done();
			});
		});

		it('should include a caught throwable in a 500 response', async () => {
			@_Controller()
			class TestController {
				@Get('/foo')
				getX(req : express.Request, res : express.Response) {
					throw { foo: "bar" }
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({ 
						port: nextFreePort++, 
						silent: true,
						middleware: [
							(req, res, next) => { 
								res.header('Content-Type', 'application/json'); 
								next(); 
							}
						]
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				let result = await test
					.get('/foo')
					.expect(500, <any>{
						message: 'An exception occurred while handling this request.',
						error: {foo: "bar"}
					});

				app.stop();
				done();
			});
		});

		it('should exclude exception information when `hideExceptions` is true', async () => {
			@_Controller()
			class TestController {
				@Get('/foo')
				getX(req : express.Request, res : express.Response) {
					throw { toString: () => "testytest" }
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({ 
						silent: true,
						hideExceptions: true,
						middleware: [
							(req, res, next) => { 
								res.header('Content-Type', 'application/json'); 
								next(); 
							}
						]
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				let result = await test.get('/foo')
					.expect(500, <any>{ message: 'An exception occurred while handling this request.' });
				
				app.stop();
				done();
			});
		});

		it('should apply route-specific middleware', async () => {
			@_Controller()
			class TestController {
				@Get('/foo', {
					middleware: [
						(req, res, next) => {
							req.fun = 'funfun';
							next();
						}
					]
				})
				getX(req : express.Request, res : express.Response) {
					return req['fun'];
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({
						silent: true,
						middleware: [
							(req, res, next) => { 
								res.header('Content-Type', 'application/json'); 
								next(); 
							}
						]
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				let result = await test.get('/foo')
					.expect(200, <any>'"funfun"');
					
				app.stop();
				done();
			});
		});

		it('should be injecting express URL parameters when appropriate', async () => {
			@_Controller()
			class TestController {
				@Get('/foo/:bar/:baz')
				getX(bar : string, baz : string) {
					assert(bar == '123');
					assert(baz == '321');
					return Promise.resolve({ok: true});
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({
						silent: true,
						middleware: [
							(req, res, next) => { 
								res.header('Content-Type', 'application/json'); 
								next(); 
							}
						]
					})
				]
			}) 
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				let result = await test.get('/foo/123/321')
					.expect(200, <any>{ ok: true });

				app.stop();
				done();
			});
		});

		it('should be reading parameter type metadata to discover how to provide parameters', async () => {
			@_Controller()
			class TestController {
				@Get('/foo')
				getX(res : express.Response, req : express.Request) { // note they are swapped
					assert(res.send);
					assert(req.path);

					return Promise.resolve({ok: true});
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({
						silent: true,
						middleware: [
							(req, res, next) => { 
								res.header('Content-Type', 'application/json'); 
								next(); 
							}
						]
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				let result = await test.get('/foo')
					.expect(200, <any>{
						ok: true 
					});
					
				app.stop();
				done();
			});
		});

		it('should be able to inject body when the body parsing middleware is used', async () => {
			interface MyRequestType {
				zoom : number;
			}

			@_Controller()
			class TestController {
				@Post('/foo')
				getX(body : MyRequestType) { 
					assert(body.zoom === 123);
					return Promise.resolve({ok: true});
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({
						silent: true,
						middleware: [
							bodyParser.json(),
							(req, res, next) => { res.header('Content-Type', 'application/json'); next(); }
						]
					})
				]
			})
			class FakeApp {
			}

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				let result = await test.post('/foo')
					.send({ zoom: 123 })
					.expect(200, <any>{ ok: true });
					
				app.stop();
				done();
			});
		});

		it('should be able to inject RouteEvent instead of request/response', async () => {
			interface MyRequestType {
				zoom : number;
			}

			@_Controller()
			class TestController {
				@Post('/foo')
				getX(ev : RouteEvent) { 
					assert(ev.request.path);
					assert(ev.response.send);
					return Promise.resolve({ok: true});
				}
			}

			@Module({
				controllers: [TestController],
				imports: [
					WebServerModule.configure({ 
						silent: true,
						middleware: [
							bodyParser.json(),
							(req, res, next) => { 
								res.header('Content-Type', 'application/json'); 
								next(); 
							}
						]
					})
				]
			})
			class FakeApp {
			} 

			let app = await Application.bootstrap(FakeApp, { autostart: false });
			await teststrap(app, async (test, done) => {
				let result = await test.post('/foo')
					.send({ zoom: 123 })
					.expect(200, <any>{ ok: true });

				app.stop();
				done();
			});
		});

		it('should support POST', async () => {
			let app = await Application.bootstrap(fakeAppVarietyOfMethods(), { autostart: false });
			await teststrap(app, async (test, done) => {
				let result = await test.post('/foo')
					.expect(200, <any>{ foo: "post" });
					
				app.stop();
				done();
			});
		});

		it('should support PUT', async () => {
			let app = await Application.bootstrap(fakeAppVarietyOfMethods(), { autostart: false });
			await teststrap(app, async (test, done) => {
				let result = await test.put('/foo')
					.expect(200, <any>{ foo: "put" });

				app.stop();
				done();
			});
		});

		it('should support PATCH', async () => {
			let app = await Application.bootstrap(fakeAppVarietyOfMethods(), { autostart: false });
			await teststrap(app, async (test, done) => {
				let result = await test.patch('/foo')
					.expect(200, <any>{ foo: "patch" })
					
				app.stop();
				done();
			});
		});

		it('should support DELETE', async () => {
			let app = await Application.bootstrap(fakeAppVarietyOfMethods(), { autostart: false });
			await teststrap(app, async (test, done) => {
				let result = await test.delete('/foo')
					.expect(200, <any>{ foo: "delete" });

				app.stop();
				done();
			});
		});

		it('should support OPTIONS', async () => {
			let app = await Application.bootstrap(fakeAppVarietyOfMethods(), { autostart: false });
			await teststrap(app, async (test, done) => {
				let result = await test
					.options('/foo')
					.expect(200, <any>{ foo: "options" })
				;
				
				app.stop();
				done();
			});
		});
	});
})