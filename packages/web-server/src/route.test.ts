import { Controller, Get, Post, Put, Patch, Delete, Options, RouteEvent, Mount } from './metadata';
import { suite } from 'razmin';
import { expect } from 'chai';
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
			@WebService()
			class TestModule {
				@Get('/foo')
				foo(ev : RouteEvent) {
					ev.response.status(200).send({foo:123});
				}
			}

			await teststrap(TestModule)
				.get('/foo')
				.expect(200, { foo: 123 })
			;
		});

		it('should allow a method to return a promise', async () => {
			@WebService()
			class FakeApp {
				@Get('/foo')
				getX() {
					return Promise.resolve({foo:"we promised"});
				}
			}

			await teststrap(FakeApp)
				.get('/foo')
				.expect(200, { foo: 'we promised' })
			;
		});
	
		it('should allow a method to return null as a JSON value', async () => {
			@WebService()
			class FakeApp {
				@Get('/foo')
				getX() {
					return null;
				}
			}

			await teststrap(FakeApp)
				.get('/foo')
				.expect(200, null)
			;
		});

		it('should bind @Session() parameter to `request.session`', async () => {
			@WebService()
			class FakeApp {
				@Get('/foo', { 
					middleware: [ 
						(req, res, next) => 
							(req.session = { test: 'session-value' }, next()) 
					]
				})
				getX(@Session() session : any) {
					return Promise.resolve({foo: session.test});
				}
			}

			await teststrap(FakeApp)
				.get('/foo')
				.expect(200, { foo: 'session-value' })
			;
		});
		
		it('should bind @Session(\'name\') property to `request.session[\'name\']`', async () => {
			@WebService()
			class FakeApp {
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

			await teststrap(FakeApp)
				.get('/foo')
				.expect(200, { foo: 123 })
			;
		});

		it('should allow a method to return an explicit body value', async () => {
			@WebService()
			class FakeApp {
				@Get('/foo')
				getX(ev : RouteEvent) {
					return {foo:"we promised"};
				}
			}

			await teststrap(FakeApp)
				.get('/foo')
				.expect(200, <any>{ foo: "we promised" })
			;
		});

		it('should re-encode a string return value as JSON', async () => {
			@WebService()
			class FakeApp {
				@Get('/foo')
				getX() {
					return "token value";
				}
			}

			await teststrap(FakeApp)
				.get('/foo')
				.expect(200, <any>'"token value"')
			;
		});

		it('should 500 when a method returns a promise that rejects', async () => {
			@WebService({ server: { silentErrors: true } })
			class FakeApp {
				@Get('/foo')
				getX() {
					return Promise.reject(new Error("All the things went wrong"));
				}
			}

			await teststrap(FakeApp)
				.get('/foo')
				.expect(500)
			;
		});

		it('should act accordingly when a method returns a promise that rejects with an HttpError', async () => {
			@WebService()
			class FakeApp {
				@Get('/foo')
				getX() {
					return Promise.reject(
						new HttpError(300, [['X-Test', 'pass']], {bar:777})
					);
				}
			}

			await teststrap(FakeApp)
				.get('/foo')
				.expect(300, { bar: 777 })
				.expect('X-Test', 'pass')
			;
		});

		it('should include the stack trace of a caught Error in a 500 response', async () => {
			let error = new Error('testytest');
			let stackText = error.stack;

			@WebService({ server: { silentErrors: true }})
			class FakeApp {
				@Get('/foo')
				getX() {
					throw error;
				}
			}

			await teststrap(FakeApp, { silentErrors: true })
				.get('/foo')
				.expect(500, {
					message: 'An exception occurred while handling this request.',
					error: stackText
				})
			;
		});

		it('should include a caught throwable in a 500 response', async () => {
			@WebService({ server: { silentErrors: true }})
			class FakeApp {
				@Get('/foo')
				getX() {
					throw { foo: "bar" }
				}
			}

			await teststrap(FakeApp, { silentErrors: true })
				.get('/foo')
				.expect(500, {
					message: 'An exception occurred while handling this request.',
					error: { foo: "bar" }
				})
			;
		});

		it('should exclude exception information when `hideExceptions` is true', async () => {
			@WebService({
				server: {
					hideExceptions: true,
					silentErrors: true
				}
			})
			class FakeApp {
				@Get('/foo')
				getX() {
					throw { toString: () => "testytest" }
				}
			}

			await teststrap(FakeApp, { silentErrors: true })
				.get('/foo')
				.expect(500, { 
					message: 'An exception occurred while handling this request.' 
				})
			;
		});

		it('should apply route-specific middleware', async () => {
			@WebService()
			class FakeApp {
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

			await teststrap(FakeApp)
				.get('/foo')
				.expect(200, '"funfun"')
			;
		});

		it('should be injecting express URL parameters when appropriate', async () => {

			let observedBar;
			let observedBaz;

			@WebService()
			class FakeApp {
				@Get('/foo/:bar/:baz')
				getX(bar : string, baz : string) {
					observedBar = bar;
					observedBaz = baz;
					return Promise.resolve({ok: true});
				}
			}

			await teststrap(FakeApp)
				.get('/foo/123/321')
				.expect(200, { ok: true })
			;
			
			expect(observedBar).to.equal('123');
			expect(observedBaz).to.equal('321');
		});

		it('should be reading parameter type metadata to discover how to provide parameters', async () => {

			let observedEvent;
			let observedQ;

			@WebService()
			class FakeApp {
				@Get('/foo')
				getX(@QueryParam('q') q : string, ev : RouteEvent) { // note they are swapped
					observedEvent = ev;
					observedQ = q;

					return Promise.resolve({ok: true});
				}
			}

			await teststrap(FakeApp)
				.get('/foo?q=baz')
				.expect(200, { ok: true })
			;
			
			expect(observedEvent.response).to.not.be.undefined;
			expect(observedEvent.request).to.not.be.undefined;

			expect(observedQ).to.equal('baz');
		});

		it('should automatically parse numbers', async () => {

			let observedEvent;
			let observedQ;

			@WebService()
			class FakeApp {
				@Get('/foo')
				getX(@QueryParam('q') q : number, ev : RouteEvent) { // note they are swapped
					observedEvent = ev;
					observedQ = q;

					return Promise.resolve({ok: true});
				}
			}

			await teststrap(FakeApp)
				.get('/foo?q=123')
				.expect(200, { ok: true })
			;
			
			expect(observedEvent.response).to.not.be.undefined;
			expect(observedEvent.request).to.not.be.undefined;

			expect(observedQ).to.equal(123);
		});

		it('should return 400 when string is passed for number', async () => {

			let observedEvent;
			let observedQ;

			@WebService()
			class FakeApp {
				@Get('/foo')
				getX(@QueryParam('q') q : number, ev : RouteEvent) { // note they are swapped
					observedEvent = ev;
					observedQ = q;

					return Promise.resolve({ok: true});
				}
			}

			await teststrap(FakeApp)
				.get('/foo?q=baz')
				.expect(400)
			;
			
			expect(observedEvent).to.be.undefined;
			expect(observedQ).to.be.undefined;
		});

		it('should support binding query parameters', async () => {
			let observedQ;
			@WebService()
			class FakeApp {
				@Get('/foo')
				getX(@QueryParam('q') q : string) {
					observedQ = q;

					return Promise.resolve({ok: true});
				}
			}

			await teststrap(FakeApp)
				.get('/foo?q=baz')
				.expect(200, { ok: true })
			;
			
			expect(observedQ).to.equal('baz');
		});

		it('should be able to inject body when the body parsing middleware is used', async () => {
			interface MyRequestType {
				zoom : number;
			}

			let observedZoom = null;

			@WebService()
			class FakeApp {
				@Post('/foo', { middleware: [ bodyParser.json() ] })
				getX(@Body() body : MyRequestType) { 
					observedZoom = body.zoom;
					return Promise.resolve({ok: true});
				}
			}

			await teststrap(FakeApp)
				.post('/foo')
				.send({ zoom: 123 })
				.expect(200, { ok: true })
			;

			expect(observedZoom).to.equal(123);
		});

		it('should follow parent controller\'s path prefix while dealing with mounted controllers', async () => {
			let observedZoom;

			interface MyRequestType {
				zoom : number;
			}
			@Controller('/ghi')
			class SubController {
				@Post('/jkl', { middleware: [ bodyParser.json() ] })
				getX(@Body() body : MyRequestType) { 
					observedZoom = body.zoom;
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

			@WebService({ controllers: [TestController] })
			class FakeApp { }

			await teststrap(FakeApp)
				.post('/abc/def/ghi/jkl')
				.send({ zoom: 123 })
				.expect(200, { ok: true })
			;

			expect(observedZoom).to.equal(123);
		});

		it('mounted controllers should inherit middleware from parent controller', async () => {
			let observedZoom;

			interface MyRequestType {
				zoom : number;
			}
			@Controller('/ghi')
			class SubController {
				@Post('/jkl', { middleware: [ bodyParser.json() ] })
				getX(@Body() body : MyRequestType) { 
					observedZoom = body.zoom;
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

			@WebService({ controllers: [TestController] })
			class FakeApp { }

			await teststrap(FakeApp)
				.post('/abc/def/ghi/jkl')
				.send({ zoom: 123 })
				.expect(200, { ok: true })
			;

			expect(counter).to.equal(1);
			expect(observedZoom).to.equal(123);
		});

		it('all paths under a controller should execute middleware', async () => {
			interface MyRequestType {
				zoom : number;
			}

			let counter = 0;
			function counterMiddleware(req, res, next) {
				++counter;
				next();
			}

			@Controller('/abc', { middleware: [counterMiddleware] })
			class TestController {
				@Get('wat')
				wat() {
					return { ok: true };
				}
			}

			@WebService({ controllers: [TestController] })
			class FakeApp { }

			await teststrap(FakeApp)
				.get('/abc/other')
				.send({ zoom: 123 })
				.expect(404)
			;

			expect(counter).to.equal(1);
		});

		it('paths outside of a controller should not execute middleware from that controller', async () => {
			interface MyRequestType {
				zoom : number;
			}

			let counter = 0;
			function counterMiddleware(req, res, next) {
				++counter;
				next();
			}
			@Controller('', { middleware: [counterMiddleware] })
			class FeatureController {
				@Get('wat')
				get() {
					return { ok: '123' }
				}
			}

			@Controller('/abc')
			class TestController {
				@Get('wat')
				wat() {
					return { ok: '321' };
				}

				@Mount('/feature')
				feature : FeatureController;
			}

			@WebService({ controllers: [TestController] })
			class FakeApp { }

			let test = teststrap(FakeApp)
			
			await test
				.get('/abc/feature/wat')
				.expect(200, { ok: '123' })
			;

			await test
				.get('/abc/wat')
				.expect(200, { ok: '321' })
			;
					
			await test
				.get('/abc/feature/wat')
				.expect(200, { ok: '123' })
			;

			expect(counter).to.equal(2);
		});

		it('mounted controllers should properly construct paths when some lead with slash', async () => {
			let observedZoom;

			interface MyRequestType {
				zoom : number;
			}
			@Controller('')
			class SubController {
				@Post('/ghi', { middleware: [ bodyParser.json() ] })
				getX(@Body() body : MyRequestType) { 
					observedZoom = 123;
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
				@Get('/wat')
				wat() {}

				@Mount('/def')
				subcontroller : SubController;
			}

			@WebService({ controllers: [TestController] })
			class FakeApp { }

			await teststrap(FakeApp)
				.post('/abc/def/ghi')
				.send({ zoom: 123 })
				.expect(200, { ok: true })
			;

			expect(counter).to.equal(1);
			expect(observedZoom).to.equal(123);
		});

		it('mounted controllers should properly construct paths on multiple levels', async () => {
			let observedZoom;

			interface MyRequestType {
				zoom : number;
			}
			
			@Controller('', { middleware: [ counterMiddleware ]})
			class ApiController {
				@Post('/info', { middleware: [ bodyParser.json() ] })
				getX(@Body() body : MyRequestType) { 
					observedZoom = body.zoom;
					return Promise.resolve({ok: true});
				}
			}

			@Controller()
			class FeatureController {
				@Mount('/api')
				api : ApiController
			}

			let counter = 0;
			function counterMiddleware(req, res, next) {
				++counter;
				next();
			}

			@Controller()
			class TestController {
				@Get('') 
				get() {
					return { stuff: 123 };
				}

				@Mount('feature')
				subcontroller : FeatureController;
			}

			@WebService({ controllers: [TestController] })
			class FakeApp { }

			let test = teststrap(FakeApp);

			await test
				.get('/')
				.expect(200)
			;

			await test
				.post('/feature/api/info')
				.send({ zoom: 123 })
				.expect(200, { ok: true })
			;

			expect(observedZoom).to.equal(123);
			expect(counter).to.equal(1);
		});

		it('should be able to inject RouteEvent instead of request/response', async () => {
			let observedEvent;

			@WebService()
			class FakeApp { 
				@Post('/foo')
				getX(ev : RouteEvent) { 
					observedEvent = ev;
					return Promise.resolve({ok: true});
				}
			}

			await teststrap(FakeApp)
				.post('/foo')
				.send({ zoom: 123 })
				.expect(200, { ok: true })
			;

			expect(observedEvent.request.path).to.not.be.undefined;
			expect(observedEvent.response.send).to.not.be.undefined;
		});

		it('should support POST', async () => {
			await teststrap(fakeAppVarietyOfMethods())
				.post('/foo')
				.expect(200, { foo: "post" })
			;
		});

		it('should support PUT', async () => {
			await teststrap(fakeAppVarietyOfMethods())
				.put('/foo')
				.expect(200, { foo: "put" })
			;
		});

		it('should support PATCH', async () => {
			await teststrap(fakeAppVarietyOfMethods())
				.patch('/foo')
				.expect(200, <any>{ foo: "patch" })
			;
		});

		it('should support DELETE', async () => {
			await teststrap(fakeAppVarietyOfMethods())
				.delete('/foo')
				.expect(200, { foo: "delete" })
			;
		});

		it('should support OPTIONS', async () => {
			await teststrap(fakeAppVarietyOfMethods())
				.options('/foo')
				.expect(200, { foo: "options" })
			;
		});
	});
})