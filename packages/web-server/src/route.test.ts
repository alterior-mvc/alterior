import { Controller, Get, Post, Put, Patch, Delete, Options, WebEvent, Mount, QueryParamMap, MiddlewareDefinition } from './metadata';
import { suite } from 'razmin';
import { expect } from 'chai';
import * as bodyParser from 'body-parser';
import { teststrap } from './teststrap';
import { QueryParam, Body, PathParam, QueryParams } from './input';
import { WebService } from './service';
import { HttpError } from '@alterior/common';
import { Application } from '@alterior/runtime';
import { Response } from './response';
import { IncomingMessage, ServerResponse } from 'http';
import { InterceptedAction } from './web-server-options';
import { inject } from '@alterior/di';

let nextFreePort = 10010;

function fakeAppVarietyOfMethods() {
	@WebService({
		server: {
			port: nextFreePort++,
			silent: true,
			middleware: [
				(req: IncomingMessage, res: ServerResponse, next: () => void) => {
					res.setHeader('Content-Type', 'application/json');
					next();
				}
			]
		}
	})
	class FakeApp {
		@Get('/foo')
		getX(ev: WebEvent) {
			ev.response.statusCode = 200;
			ev.response.write(JSON.stringify({ foo: "get" }));
			ev.response.end();
		}

		@Post('/foo')
		postX(ev: WebEvent) {
			ev.response.statusCode = 200;
			ev.response.write(JSON.stringify({ foo: "post" }));
			ev.response.end();
		}

		@Put('/foo')
		putX(ev: WebEvent) {
			ev.response.statusCode = 200;
			ev.response.setHeader('Content-Type', 'application/json');
			ev.response.write(JSON.stringify({ foo: "put" }));
			ev.response.end();
		}

		@Patch('/foo')
		patchX(ev: WebEvent) {
			ev.response.statusCode = 200;
			ev.response.setHeader('Content-Type', 'application/json');
			ev.response.write(JSON.stringify({ foo: "patch" }));
			ev.response.end();
		}

		@Delete('/foo')
		deleteX(ev: WebEvent) {
			ev.response.statusCode = 200;
			ev.response.setHeader('Content-Type', 'application/json');
			ev.response.write(JSON.stringify({ foo: "delete" }));
			ev.response.end();
		}

		@Options('/foo')
		optionsX(ev: WebEvent) {
			ev.response.statusCode = 200;
			ev.response.setHeader('Content-Type', 'application/json');
			ev.response.write(JSON.stringify({ foo: "options" }));
			ev.response.end();
		}

		@Get('/json/bare')
		jsonBare() {
			return { foo: 123 };
		}

		@Get('/json/response')
		jsonResponse() {
			return Response.ok({ foo: 123 });
		}
	}

	return FakeApp;
}

suite(describe => {
	describe("RouteDecorator", it => {
		it('should register routes defined on controllers and respond to them', async () => {
			@WebService()
			class TestModule {
				@Get('/foo')
				foo(ev: WebEvent) {
					ev.response.statusCode = 200;
					ev.response.setHeader('Content-Type', 'application/json');
					ev.response.write(JSON.stringify({ foo: 123 }));
					ev.response.end();
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
					return Promise.resolve({ foo: "we promised" });
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
	
		it('should return 500 (not crash) with invalid json', async () => {
			@WebService()
			class FakeApp {
				@Post('/foo')
				getX(@Body() foo: { bar: number }) {
					return foo.bar;
				}
			}

			await teststrap(FakeApp)
				.post('/foo')
				.send("invalid json")
				.expect(500)
			;
		});

		it('should allow a method to return an explicit body value', async () => {
			@WebService()
			class FakeApp {
				@Get('/foo')
				getX(ev: WebEvent) {
					return { foo: "we promised" };
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
						new HttpError(300, { bar: 777 }, [['X-Test', 'pass']])
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

			@WebService({ server: { silentErrors: true } })
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
					error: {
						message: error.message,
						constructor: error.constructor.name,
						stack: stackText?.split(/\r?\n/).slice(1).map(line => line.replace(/ +at /, ''))
					}
				})
				;
		});

		it('should include a caught throwable in a 500 response', async () => {
			@WebService({ server: { silentErrors: true } })
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
							(req as any).fun = 'funfun';
							next();
						}
					]
				})
				getX(ev: WebEvent) {
					return (ev.request as any).fun;
				}
			}

			await teststrap(FakeApp)
				.get('/foo')
				.expect(200, '"funfun"')
				;
		});

		it('should apply path-limited middleware', async () => {
			@WebService({
				server: {
					middleware: [
						['/foo', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
							(req as any).fun = 'funfun';
							next();
						}]
					]
				}
			})
			class FakeApp {
				@Get('/foo')
				getX(ev: WebEvent) {
					return (ev.request as any).fun;
				}
			}

			await teststrap(FakeApp)
				.get('/foo')
				.expect(200, '"funfun"')
				;
		});

		it('should be injecting route URL parameters when appropriate', async () => {

			let observedBar;
			let observedBaz;

			@WebService()
			class FakeApp {
				@Get('/foo/:bar/:baz')
				getX(bar: string, baz: string) {
					observedBar = bar;
					observedBaz = baz;
					return Promise.resolve({ ok: true });
				}
			}

			await teststrap(FakeApp)
				.get('/foo/123/321')
				.expect(200, { ok: true })
				;

			expect(observedBar).to.equal('123');
			expect(observedBaz).to.equal('321');
		});

		it('should not allow path parameter binding without a type', async () => {
			@WebService()
			class FakeApp {
				@Get('/foo/:bar')
				getX(bar: any) {
					return Promise.resolve({ ok: true });
				}
			}

			try {
				await Application.bootstrap(FakeApp, { silent: true, autostart: false });
			} catch (e) {
				return;
			}

			expect(false, 'Bootstrapping the app should have failed');
		});

		it('should be reading parameter type metadata to discover how to provide parameters', async () => {

			let observedEvent: WebEvent | undefined;
			let observedQ;

			@WebService()
			class FakeApp {
				@Get('/foo')
				getX(@QueryParam('q') q: string, ev: WebEvent) {
					observedEvent = ev;
					observedQ = q;

					return Promise.resolve({ ok: true });
				}
			}

			await teststrap(FakeApp)
				.get('/foo?q=baz')
				.expect(200, { ok: true })
				;

			expect(observedEvent?.response).to.not.be.undefined;
			expect(observedEvent?.request).to.not.be.undefined;

			expect(observedQ).to.equal('baz');
		});

		it('should automatically parse numbers in QueryParam', async () => {

			let observedEvent: WebEvent | undefined;
			let observedQ;

			@WebService()
			class FakeApp {
				@Get('/foo')
				getX(@QueryParam('q') q: number, ev: WebEvent) {
					observedEvent = ev;
					observedQ = q;

					return Promise.resolve({ ok: true });
				}
			}

			await teststrap(FakeApp)
				.get('/foo?q=123')
				.expect(200, { ok: true })
				;

			expect(observedEvent?.response).to.not.be.undefined;
			expect(observedEvent?.request).to.not.be.undefined;

			expect(observedQ).to.equal(123);
		});

		it('should automatically parse numbers in PathParam', async () => {

			let observedEvent: WebEvent | undefined;
			let observedNum;

			@WebService()
			class FakeApp {
				@Get('/foo/:num')
				getX(num: number, ev: WebEvent) { // note they are swapped
					observedEvent = ev;
					observedNum = num;

					return Promise.resolve({ ok: true });
				}
			}

			await teststrap(FakeApp)
				.get('/foo/123')
				.expect(200, { ok: true })
				;

			expect(observedEvent?.response).to.not.be.undefined;
			expect(observedEvent?.request).to.not.be.undefined;

			expect(typeof observedNum === 'number', 'observedNum should be a number')
			expect(observedNum).to.equal(123);
		});

		it('should respond with 400 when expecting a number PathParam but a string is provided', async () => {

			let observedEvent: WebEvent | undefined;
			let observedNum: number | undefined = undefined;
			let executed = false;
			@WebService()
			class FakeApp {
				@Get('/foo/:num')
				getX(num: number, ev: WebEvent) { // note they are swapped
					executed = true;
					observedEvent = ev;
					observedNum = num;

					return Promise.resolve({ ok: true });
				}
			}

			await teststrap(FakeApp)
				.get('/foo/abc')
				.expect(400, { error: 'invalid-request', message: 'The parameter num must be a valid number' })
				;

			expect(observedEvent).not.to.exist;
			expect(observedNum).not.to.exist;
			expect(executed).to.be.false;
		});

		it('should return 400 when string is passed for number for QueryParam', async () => {

			let observedEvent;
			let observedQ;

			@WebService()
			class FakeApp {
				@Get('/foo')
				getX(@QueryParam('q') q: number, ev: WebEvent) { // note they are swapped
					observedEvent = ev;
					observedQ = q;

					return Promise.resolve({ ok: true });
				}
			}

			await teststrap(FakeApp)
				.get('/foo?q=baz')
				.expect(400)
				;

			expect(observedEvent).to.be.undefined;
			expect(observedQ).to.be.undefined;
		});

		it('should return 200 when number QueryParam is not present', async () => {

			let observedEvent;
			let observedQ;

			@WebService()
			class FakeApp {
				@Get('/foo')
				getX(@QueryParam('q') q: number, ev: WebEvent) { // note they are swapped
					observedEvent = ev;
					observedQ = q;

					return Promise.resolve({ ok: true });
				}
			}

			await teststrap(FakeApp)
				.get('/foo')
				.expect(200)
				;

			expect(observedEvent).to.exist;
			expect(observedQ).to.be.undefined;
		});

		it('QueryParam should allow for default values', async () => {

			let observedEvent;
			let observedQ;

			@WebService()
			class FakeApp {
				@Get('/foo')
				getX(@QueryParam('q', { default: 123 }) q: number, ev: WebEvent) { // note they are swapped
					observedEvent = ev;
					observedQ = q;

					return Promise.resolve({ ok: true });
				}
			}

			await teststrap(FakeApp)
				.get('/foo')
				.expect(200)
				;

			expect(observedEvent).to.exist;
			expect(observedQ).to.equal(123);
		});

		it('should provide parameters that are inherited via controller mounting', async () => {
			let observedTopicID;
			let observedMessageID;

			@Controller()
			class SubController {
				@Get('/messages/:messageID')
				getX(@PathParam() topicID: string, @PathParam() messageID: string) {
					observedTopicID = topicID;
					observedMessageID = messageID;

					return Promise.resolve({ ok: true });
				}
			}

			@WebService()
			class FakeApp {
				@Mount('/topics/:topicID')
				sub!: SubController;
			}

			await teststrap(FakeApp)
				.get('/topics/futopic/messages/barmessage')
				.expect(200, { ok: true })
				;

			expect(observedTopicID).to.equal('futopic');
			expect(observedMessageID).to.equal('barmessage');
		});

		it.skip('should provide parameters that are inherited via controller mounting (no decorator hints)', async () => {
			let observedTopicID;
			let observedMessageID;

			@Controller()
			class SubController {
				@Get('/messages/:messageID')
				getX(topicID: string, messageID: string) {
					observedTopicID = topicID;
					observedMessageID = messageID;

					return Promise.resolve({ ok: true });
				}
			}

			@WebService()
			class FakeApp {
				@Mount('/topics/:topicID')
				sub!: SubController;
			}

			await teststrap(FakeApp)
				.get('/topics/futopic/messages/barmessage')
				.expect(200, { ok: true })
				;

			expect(observedTopicID).to.equal('futopic');
			expect(observedMessageID).to.equal('barmessage');
		});

		it('should provide parameters that are inherited via controller prefix', async () => {
			let observedTopicID;
			let observedMessageID;

			@Controller('/:topicID')
			class SubController {
				@Get('/messages/:messageID')
				getX(@PathParam() topicID: string, @PathParam() messageID: string) {
					observedTopicID = topicID;
					observedMessageID = messageID;

					return Promise.resolve({ ok: true });
				}
			}

			@WebService()
			class FakeApp {
				@Mount('/topics')
				sub!: SubController;
			}

			await teststrap(FakeApp)
				.get('/topics/futopic/messages/barmessage')
				.expect(200, { ok: true })
				;

			expect(observedTopicID).to.equal('futopic');
			expect(observedMessageID).to.equal('barmessage');
		});

		it.skip('should provide parameters that are inherited via controller prefix (no decorator hints)', async () => {
			let observedTopicID;
			let observedMessageID;

			@Controller('/:topicID')
			class SubController {
				@Get('/messages/:messageID')
				getX(topicID: string, messageID: string) {
					observedTopicID = topicID;
					observedMessageID = messageID;

					return Promise.resolve({ ok: true });
				}
			}

			@WebService()
			class FakeApp {
				@Mount('/topics')
				sub!: SubController;
			}

			await teststrap(FakeApp)
				.get('/topics/futopic/messages/barmessage')
				.expect(200, { ok: true })
				;

			expect(observedTopicID).to.equal('futopic');
			expect(observedMessageID).to.equal('barmessage');
		});

		it('should support binding @QueryParam', async () => {
			let observedQ;
			@WebService()
			class FakeApp {
				@Get('/foo')
				getX(@QueryParam('q') q: string) {
					observedQ = q;

					return Promise.resolve({ ok: true });
				}
			}

			await teststrap(FakeApp)
				.get('/foo?q=baz')
				.expect(200, { ok: true })
				;

			expect(observedQ).to.equal('baz');
		});

		it('should support binding @QueryParams', async () => {
			let observedQ, observedR;
			@WebService()
			class FakeApp {
				@Get('/foo')
				getX(@QueryParams() q: QueryParamMap) {
					observedQ = q.q;
					observedR = q.r;

					return Promise.resolve({ ok: true });
				}
			}

			await teststrap(FakeApp)
				.get('/foo?q=baz&r=bar')
				.expect(200, { ok: true })
				;

			expect(observedQ).to.equal('baz');
			expect(observedR).to.equal('bar');
		});

		it('should be able to inject @Body()', async () => {
			interface MyRequestType {
				zoom: number;
			}

			let observedZoom = null;

			@WebService()
			class FakeApp {
				@Post('/foo')
				getX(@Body() body: MyRequestType) {
					observedZoom = body.zoom;
					return Promise.resolve({ ok: true });
				}
			}

			await teststrap(FakeApp)
				.post('/foo')
				.send({ zoom: 123 })
				.expect(200, { ok: true })
				;

			expect(observedZoom).to.equal(123);
		});

		it('should be able to inject @Body() on non-first parameters', async () => {
			interface MyRequestType {
				zoom: number;
			}

			let observedZoom = null;

			@WebService()
			class FakeApp {
				@Post('/foo/:id')
				getX(id: string, @Body() body: MyRequestType) {
					observedZoom = body.zoom;
					return Promise.resolve({ ok: true });
				}
			}

			await teststrap(FakeApp)
				.post('/foo/abc')
				.send({ zoom: 123 })
				.expect(200, { ok: true })
				;

			expect(observedZoom).to.equal(123);
		});

		it('should follow parent controller\'s path prefix while dealing with mounted controllers', async () => {
			let observedZoom;

			interface MyRequestType {
				zoom: number;
			}
			@Controller('/ghi')
			class SubController {
				@Post('/jkl', { middleware: [bodyParser.json()] })
				getX(@Body() body: MyRequestType) {
					observedZoom = body.zoom;
					return Promise.resolve({ ok: true });
				}
			}

			@Controller('/abc')
			class TestController {
				@Get('wat')
				wat() { }

				@Mount('def')
				subcontroller!: SubController;
			}

			@WebService()
			class FakeApp {
				@Mount() test!: TestController;
			}

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
				zoom: number;
			}
			@Controller('/ghi')
			class SubController {
				@Post('/jkl', { middleware: [bodyParser.json()] })
				getX(@Body() body: MyRequestType) {
					observedZoom = body.zoom;
					return Promise.resolve({ ok: true });
				}
			}

			let counter = 0;
			let counterMiddleware: MiddlewareDefinition = (req, res, next) => {
				++counter;
				next();
			}

			@Controller('/abc', { globalMiddleware: [counterMiddleware] })
			class TestController {
				@Get('wat')
				wat() { }

				@Mount('def')
				subcontroller!: SubController;
			}

			@WebService()
			class FakeApp {
				@Mount() test!: TestController;
			}

			await teststrap(FakeApp)
				.post('/abc/def/ghi/jkl')
				.send({ zoom: 123 })
				.expect(200, { ok: true })
				;

			expect(counter).to.equal(1);
			expect(observedZoom).to.equal(123);
		});

		it('instance of mounted controller should be placed into the parent controller field slot', async () => {
			let wasPresent = false;

			@Controller()
			class TestController { present = true; }

			@WebService()
			class FakeApp {
				@Mount() test!: TestController;
				[WebService.onInit]() { wasPresent = this.test.present; }
			}

			await teststrap(FakeApp).get('/');
			expect(wasPresent).to.be.true;
		});

		it('globally provided instance of mounted controller should be reused', async () => {
			let matched = false;

			@Controller()
			class TestController { present = true; }

			@WebService({ providers: [TestController] })
			class FakeApp {
				private injectedController = inject(TestController);
				
				@Mount() test!: TestController;
				[WebService.onInit]() { matched = this.test === this.injectedController; }
			}

			await teststrap(FakeApp).get('/');
			expect(matched).to.be.true;
		});

		it('globally provided instance of mounted controller should obey mount prefixes', async () => {
			let matched = false;

			@Controller()
			class TestController { @Get() get() { return 123; } }

			@WebService({ providers: [TestController] })
			class FakeApp {
				private injectedController = inject(TestController);
				
				@Mount('/test1') test2!: TestController;
				@Mount('/test2') test1!: TestController;
				[WebService.onInit]() { matched = this.test1 === this.injectedController && this.test2 === this.injectedController; }
			}

			await teststrap(FakeApp).get('/test1').expect(200, '123');
			await teststrap(FakeApp).get('/test2').expect(200, '123');
			expect(matched).to.be.true;
		});

		it('all paths under a controller should execute middleware', async () => {
			let counter = 0;
			let counterMiddleware: MiddlewareDefinition = (req, res, next) => {
				++counter;
				next();
			}

			@Controller('/abc', { globalMiddleware: [counterMiddleware] })
			class TestController {
				@Get('wat')
				wat() {
					return { ok: true };
				}
			}

			@WebService()
			class FakeApp {
				@Mount() test!: TestController;
			}

			await teststrap(FakeApp)
				.get('/abc/other')
				.send({ zoom: 123 })
				.expect(404)
				;

			expect(counter).to.equal(1);
		});

		it('paths outside of a controller should not execute middleware from that controller', async () => {
			
			let counter = 0;
			let counterMiddleware: MiddlewareDefinition = (req, res, next) => {
				++counter;
				next();
			}
			@Controller('', { globalMiddleware: [counterMiddleware] })
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
				feature!: FeatureController;
			}

			@WebService()
			class FakeApp {
				@Mount() test!: TestController;
			}

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
				zoom: number;
			}
			@Controller('')
			class SubController {
				@Post('/ghi', { middleware: [bodyParser.json()] })
				getX(@Body() body: MyRequestType) {
					observedZoom = 123;
					return Promise.resolve({ ok: true });
				}
			}

			let counter = 0;
			let counterMiddleware: MiddlewareDefinition = (req, res, next) => {
				++counter;
				next();
			}

			@Controller('/abc', { globalMiddleware: [counterMiddleware] })
			class TestController {
				@Get('/wat')
				wat() { }

				@Mount('/def')
				subcontroller!: SubController;
			}

			@WebService()
			class FakeApp {
				@Mount() test!: TestController;
			}

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
			let counter = 0;
			let counterMiddleware: MiddlewareDefinition = (req, res, next) => {
				++counter;
				next();
			}

			interface MyRequestType {
				zoom: number;
			}
			
			@Controller('', { globalMiddleware: [ counterMiddleware ]})
			class ApiController {
				@Post('/info', { middleware: [bodyParser.json()] })
				getX(@Body() body: MyRequestType) {
					observedZoom = body.zoom;
					return Promise.resolve({ ok: true });
				}
			}

			@Controller()
			class FeatureController {
				@Mount('/api')
				api!: ApiController
			}

			@Controller()
			class TestController {
				@Get('')
				get() {
					return { stuff: 123 };
				}

				@Mount('feature')
				subcontroller!: FeatureController;
			}

			@WebService()
			class FakeApp {
				@Mount() test!: TestController;
			}

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

		it('should be able to inject WebEvent instead of request/response', async () => {
			let observedEvent: WebEvent | undefined;

			@WebService()
			class FakeApp {
				@Post('/foo')
				getX(ev: WebEvent) {
					observedEvent = ev;
					return Promise.resolve({ ok: true });
				}
			}

			await teststrap(FakeApp)
				.post('/foo')
				.send({ zoom: 123 })
				.expect(200, { ok: true })
				;

			expect(observedEvent).to.exist;
			expect(observedEvent).to.be.instanceOf(WebEvent);
			expect(observedEvent!.request).to.not.be.undefined;
			expect(observedEvent!.response).to.not.be.undefined;
		});

		it('should support interceptors', async () => {
			@WebService({
				server: {
					interceptors: [ async (action: InterceptedAction, ...args: any[]) => ({ ...await action(...args), intercepted: true }) ]
				}
			})
			class FakeApp { 
				@Get('/projects/:id')
				getX(id: number) {
					return { id, name: 'Foo' };
				}
			}

			await teststrap(FakeApp)
				.get('/projects/123')
				.expect(200, { id: 123, name: 'Foo', intercepted: true })
			;
		});

		it('should nest multiple interceptors', async () => {
			let observed = '';

			@WebService({
				server: {
					interceptors: [ 
						async (action: InterceptedAction, ...args: any[]) => {
							observed += '1';
							return await action(...args)
						},
						async (action: InterceptedAction, ...args: any[]) => {
							observed += '2';
							return await action(...args)
						},
						async (action: InterceptedAction, ...args: any[]) => {
							observed += '3';
							return await action(...args)
						}
					]
				}
			})
			class FakeApp { 
				@Get('/projects/:id')
				getX(id: number) {
					observed += '4';
					return { id, name: 'Foo' };
				}
			}

			await teststrap(FakeApp)
				.get('/projects/123')
				.expect(200, { id: 123, name: 'Foo' })
			;

			expect(observed).to.equal('1234');
		});

		it('interceptor can skip call', async () => {
			@WebService({
				server: {
					interceptors: [ 
						async () => {
							throw new HttpError(401, { error: 'unauthorized' });
						}
					]
				}
			})
			class FakeApp { 
				@Get('/projects/:id')
				getX(id: number) {
					return { id, name: 'Foo' };
				}
			}

			await teststrap(FakeApp)
				.get('/projects/123')
				.expect(401, { error: 'unauthorized' })
			;
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

		it('should pass bare returned data to engine.sendJsonBody', async () => {
			await teststrap(fakeAppVarietyOfMethods())
				.get('/json/bare')
				.expect('Content-Type', /^application\/json/)
				.expect(200, { foo: 123 })
				;
		});

		it('should pass raw Response data to engine.sendJsonBody', async () => {
			await teststrap(fakeAppVarietyOfMethods())
				.get('/json/response')
				.expect('Content-Type', /^application\/json/)
				.expect(200, { foo: 123 })
				;
		});
	});
})