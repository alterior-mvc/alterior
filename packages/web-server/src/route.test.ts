import { Controller, Get, Post, Put, Patch, Delete, Options, RouteEvent, Mount } from './metadata';
import { suite } from 'razmin';
import { expect } from 'chai';
import * as assert from 'assert';
import * as bodyParser from 'body-parser';
import { Module } from '@alterior/di';
import { WebServerModule } from './web-server.module';
import { teststrap } from './teststrap';
import { QueryParam, Body, Session } from './input';
import { WebService } from './service';
import { HttpError } from '@alterior/common';

let nextFreePort = 10010;

function fakeAppVarietyOfMethods() {
	@Controller()
	class TestController {
		@Get('/foo')
		getX(ev : RouteEvent) {
			ev.response.status(200).send(JSON.stringify({foo:"get"}));
		}

		@Post('/foo')
		postX(ev : RouteEvent) {
			ev.response.status(200).send(JSON.stringify({foo:"post"}));
		}

		@Put('/foo')
		putX(ev : RouteEvent) {
			ev.response.status(200).send(JSON.stringify({foo:"put"}));
		}

		@Patch('/foo')
		patchX(ev : RouteEvent) {
			ev.response.status(200).send(JSON.stringify({foo:"patch"}));
		}

		@Delete('/foo')
		deleteX(ev : RouteEvent) {
			ev.response.status(200).send(JSON.stringify({foo:"delete"}));
		}

		@Options('/foo')
		optionsX(ev : RouteEvent) {
			ev.response.status(200).send(JSON.stringify({foo:"options"}));
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
			@Controller()
			class TestController {
				@Get('/foo')
				foo(ev : RouteEvent) {
					ev.response.status(200).send(JSON.stringify({foo:123}));
				}
			}

			@Module({ controllers: [TestController] })
			class TestModule {}

			await teststrap(
				TestModule, 
				async test => test.get('/foo').expect(200, <any>{ foo: 123 })
			);
		});

		it('should allow a method to return a promise', async () => {
			@Controller()
			class TestController {
				@Get('/foo')
				getX() {
					return Promise.resolve({foo:"we promised"});
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp {}

			await teststrap(FakeApp, async test => 
				await test.get('/foo')
					.expect(200, { foo: 'we promised' })
			);
		});
	
		it('should allow a method to return null as a JSON value', async () => {
			@Controller()
			class TestController {
				@Get('/foo')
				getX() {
					return null;
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			await teststrap(FakeApp, async test => 
				await test.get('/foo')
					.expect(200, <any>null)
			);
		});

		it('should bind @Session() parameter to `request.session`', async () => {
			@Controller()
			class TestController {
				@Get('/foo', { 
					middleware: [ 
						(req, res, next) => 
							(req.session = { test: 123 }, next()) 
					]
				})
				getX(@Session() session : any) {
					return Promise.resolve({foo: session.test});
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			let app = await teststrap(FakeApp, async test => 
				await test.get('/foo')
					.expect(200, { foo: 123 })
			);
		});
		
		it('should bind @Session(\'name\') property to `request.session[\'name\']`', async () => {
			@Controller()
			class TestController {
				@Get('/foo', { 
					middleware: [ 
						(req, res, next) => 
							(req.session = { test: 123 }, next()) 
					]
				})
				getX(@Session('test') test : number) {
					return Promise.resolve({foo: test});
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			let app = await teststrap(FakeApp, async test => 
				await test.get('/foo')
					.expect(200, { foo: 123 })
			);
		});

		it('should allow a method to return an explicit body value', async () => {
			@Controller()
			class TestController {
				@Get('/foo')
				getX(ev : RouteEvent) {
					return {foo:"we promised"};
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			let app = await teststrap(FakeApp, async test => 
				await test.get('/foo')
					.expect(200, <any>{ foo: "we promised" })
			);
		});

		it('should re-encode a string return value as JSON', async () => {
			@Controller()
			class TestController {
				@Get('/foo')
				getX() {
					return "token value";
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			let app = await teststrap(FakeApp, async test => 
				await test.get('/foo')
					.expect(200, <any>'"token value"')
			);
		});

		it('should 500 when a method returns a promise that rejects', async () => {
			@Controller()
			class TestController {
				@Get('/foo')
				getX() {
					return Promise.reject(new Error("All the things went wrong"));
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			await teststrap(FakeApp, async test =>
				await test.get('/foo')
					.expect(500)
			);
		});

		it('should act accordingly when a method returns a promise that rejects with an HttpError', async () => {
			@Controller()
			class TestController {
				@Get('/foo')
				getX() {
					return Promise.reject(
						new HttpError(300, [['X-Test', 'pass']], {bar:777})
					);
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			let app = await teststrap(FakeApp, async test =>
				await test.get('/foo')
					.expect(300, <any>{
						bar: 777
					})
					.expect('X-Test', 'pass')
			);
		});

		it('should include the stack trace of a caught Error in a 500 response', async () => {
			let error = new Error('testytest');
			let stackText = error.stack;

			@Controller()
			class TestController {
				@Get('/foo')
				getX() {
					throw error;
				}
			}

			@Module({
				controllers: [TestController]
			})
			class FakeApp { }

			await teststrap(FakeApp, async test =>
				await test.get('/foo')
					.expect(500, {
						message: 'An exception occurred while handling this request.',
						error: stackText
					})
			);
		});

		it('should include a caught throwable in a 500 response', async () => {
			@Controller()
			class TestController {
				@Get('/foo')
				getX() {
					throw { foo: "bar" }
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			let app = await teststrap(FakeApp, async test => 
				await test.get('/foo')
					.expect(500, {
						message: 'An exception occurred while handling this request.',
						error: { foo: "bar" }
					})
			);
		});

		it('should exclude exception information when `hideExceptions` is true', async () => {
			@Controller()
			class TestController {
				@Get('/foo')
				getX() {
					throw { toString: () => "testytest" }
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			await teststrap(FakeApp, async test => {
				await test.get('/foo')
					.expect(500, { 
						message: 'An exception occurred while handling this request.' 
					})
			}, { hideExceptions: true });
		});

		it('should apply route-specific middleware', async () => {
			@Controller()
			class TestController {
				@Get('/foo', {
					middleware: [
						(req, res, next) => {
							req.fun = 'funfun';
							next();
						}
					]
				})
				getX(ev : RouteEvent) {
					return ev.request['fun'];
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			await teststrap(FakeApp, async test =>
				await test.get('/foo')
					.expect(200, '"funfun"')
			);
		});

		it('should be injecting express URL parameters when appropriate', async () => {
			@Controller()
			class TestController {
				@Get('/foo/:bar/:baz')
				getX(bar : string, baz : string) {
					assert(bar == '123');
					assert(baz == '321');
					return Promise.resolve({ok: true});
				}
			}

			@Module({ controllers: [TestController] }) 
			class FakeApp { }

			await teststrap(FakeApp, async test =>
				await test.get('/foo/123/321')
					.expect(200, { ok: true })
			);
		});

		it('should be reading parameter type metadata to discover how to provide parameters', async () => {
			@Controller()
			class TestController {
				@Get('/foo')
				getX(@QueryParam('q') q : string, ev : RouteEvent) { // note they are swapped
					assert(ev.response);
					assert(ev.request);
					assert.equal(q, 'baz');

					return Promise.resolve({ok: true});
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			await teststrap(FakeApp, async test =>
				await test.get('/foo?q=baz')
					.expect(200, { ok: true })
			);
		});

		it('should support binding query parameters', async () => {
			@Controller()
			class TestController {
				@Get('/foo')
				getX(@QueryParam('q') q : string) {
					assert.equal(q, 'baz');

					return Promise.resolve({ok: true});
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			await teststrap(FakeApp, async test =>
				await test.get('/foo?q=baz')
					.expect(200, { ok: true })
			);
		});

		it('should be able to inject body when the body parsing middleware is used', async () => {
			interface MyRequestType {
				zoom : number;
			}

			@Controller()
			class TestController {
				@Post('/foo', { middleware: [ bodyParser.json() ] })
				getX(@Body() body : MyRequestType) { 
					assert(body.zoom === 123);
					return Promise.resolve({ok: true});
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			await teststrap(FakeApp, async test =>
				await test.post('/foo')
					.send({ zoom: 123 })
					.expect(200, { ok: true })
			);
		});

		it('should follow parent controller\'s path prefix while dealing with mounted controllers', async () => {
			interface MyRequestType {
				zoom : number;
			}
			@Controller('/ghi')
			class SubController {
				@Post('/jkl', { middleware: [ bodyParser.json() ] })
				getX(@Body() body : MyRequestType) { 
					assert(body.zoom === 123);
					return Promise.resolve({ok: true});
				}
			}

			@Controller('/abc')
			class TestController {
				@Get('wat')
				wat() {}

				@Mount('def')
				subcontroller : SubController;
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			await teststrap(FakeApp, async test =>
				await test.post('/abc/def/ghi/jkl')
					.send({ zoom: 123 })
					.expect(200, { ok: true })
			);
		});

		it('mounted controllers should inherit middleware from parent controller', async () => {
			interface MyRequestType {
				zoom : number;
			}
			@Controller('/ghi')
			class SubController {
				@Post('/jkl', { middleware: [ bodyParser.json() ] })
				getX(@Body() body : MyRequestType) { 
					assert(body.zoom === 123);
					return Promise.resolve({ok: true});
				}
			}

			let counter = 0;
			function counterMiddleware(req, res, next) {
				++counter;
				next();
			}

			@Controller('/abc', { middleware: [counterMiddleware] })
			class TestController {
				@Get('wat')
				wat() {}

				@Mount('def')
				subcontroller : SubController;
			}

			@Module({ controllers: [TestController] })
			class FakeApp { }

			await teststrap(FakeApp, async test =>
				await test.post('/abc/def/ghi/jkl')
					.send({ zoom: 123 })
					.expect(200, { ok: true })
			);

			expect(counter).to.equal(1);
		});

		it('should be able to inject RouteEvent instead of request/response', async () => {
			interface MyRequestType {
				zoom : number;
			}

			@Controller()
			class TestController {
				@Post('/foo')
				getX(ev : RouteEvent) { 
					assert(ev.request.path);
					assert(ev.response.send);
					return Promise.resolve({ok: true});
				}
			}

			@Module({ controllers: [TestController] })
			class FakeApp { } 

			await teststrap(FakeApp, async test =>
				await test.post('/foo')
					.send({ zoom: 123 })
					.expect(200, { ok: true })
			);
		});

		it('should support POST', async () => {
			await teststrap(fakeAppVarietyOfMethods(), async test =>
				await test.post('/foo')
					.expect(200, { foo: "post" })
			);
		});

		it('should support PUT', async () => {
			await teststrap(fakeAppVarietyOfMethods(), async test =>
				await test.put('/foo')
					.expect(200, { foo: "put" })
			);
		});

		it('should support PATCH', async () => {
			await teststrap(fakeAppVarietyOfMethods(), async test => 
				await test.patch('/foo')
					.expect(200, <any>{ foo: "patch" })
			);
		});

		it('should support DELETE', async () => {
			await teststrap(fakeAppVarietyOfMethods(), async test => 
				await test.delete('/foo')
					.expect(200, { foo: "delete" })
			);
		});

		it('should support OPTIONS', async () => {
			await teststrap(fakeAppVarietyOfMethods(), async test => 
				await test.options('/foo')
					.expect(200, { foo: "options" })
			);
		});
	});
})