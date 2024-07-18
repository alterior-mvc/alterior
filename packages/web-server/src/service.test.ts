import { InjectionToken, ValueProvider } from "@alterior/di";
import { AppOptionsAnnotation, Application, ModuleAnnotation } from "@alterior/runtime";
import { expect } from "chai";
import { describe, it } from "razmin";
import { Get } from "./metadata";
import { WebService, WebServiceAnnotation } from "./service";
import { teststrap } from "./teststrap";
import { provideWebServerOptions } from "./web-server-options";

describe("WebServiceDecorator", () => {
	it('should work for a simple use case', async () => {
		@WebService()
		class TestService {
			@Get('/foo')
			getX() {
				return Promise.resolve({ok: true});
			}
        }
        
        await teststrap(TestService)
            .get('/foo')
            .expect(200, {ok: true});
            
	});

    it('should attach the correct metadata', async () => {
        const FOO = new InjectionToken<number>('FOO');

        @WebService({
            version: '1.2.3',
            providers: [ { provide: FOO, useValue: 123 } ],
            server: {
                port: 12321
            }
        })
        class TestApp {
        }

        let webServiceAnnotation = WebServiceAnnotation.getForClass(TestApp);
        let appOptionsAnnotation = AppOptionsAnnotation.getForClass(TestApp);
        let moduleAnnotation = ModuleAnnotation.getForClass(TestApp);

        expect(webServiceAnnotation).to.not.eq(null);
        expect(appOptionsAnnotation).to.not.eq(null);
        expect(moduleAnnotation).to.not.eq(null);

        expect(appOptionsAnnotation?.options?.version).to.eq('1.2.3');
        expect(moduleAnnotation?.providers.length).to.eq(1);

        let provider = <ValueProvider<number>>moduleAnnotation?.providers?.[0];
        expect(provider.provide).to.eq(FOO);
        expect(provider.useValue).to.eq(123);

        let webServerModule = moduleAnnotation?.imports.find(x => typeof x === 'function' && x.name === 'WebServerModule');
        expect(webServerModule).to.exist;
    });

    it('should produce a single instance of a module/controller', async () => {
        let instances = [];
        
		@WebService()
		class TestService {
            constructor() {
                instances.push(this);
            }
			@Get('/foo')
			getX() {
				return Promise.resolve({ok: true});
			}
        }
        
        await teststrap(TestService)
            .get('/foo')
            .expect(200, {ok: true});
           
        expect(instances.length).to.equal(1, 'Only one instance of TestService should have been created');
    });
    
    it('should execute onInit once', async () => {
        let initialized = 0;

        @WebService()
        class FakeModule {
            [WebService.onInit]() {
                initialized += 1;
            }
            @Get('/foo')
            getX() {
                return Promise.resolve({ ok: true });
            }
        }

        await teststrap(FakeModule)
            .get('/foo')
            .expect(200, { ok: true })
            ;

        expect(initialized, `Controller's onInit event should have run exactly once`)
            .to.equal(1);
    });
    it('should execute onStart once', async () => {
        let started = 0;

        @WebService({
            providers: [
                provideWebServerOptions({ port: 32552 })
            ]
        })
        class FakeModule {
            [WebService.onInit]() {
                started += 1;
            }

            @Get('/foo')
            getX() {
                return Promise.resolve({ ok: true });
            }
        }

        let app = await Application.bootstrap(FakeModule, { silent: true });
        let response = await fetch('http://localhost:32552/foo');
        expect(response.status).to.equal(200);

        expect(started, `Controller's onStart should have run exactly once`)
            .to.equal(1);

        app.stop();
    });
    it('should execute both onInit and onStart once each', async () => {
        let started = 0;
        let initialized = 0;

        @WebService({
            providers: [
                provideWebServerOptions({ port: 32553 })
            ]
        })
        class FakeModule {
            [WebService.onInit]() {
                initialized += 1;
            }

            [WebService.onStart]() {
                started += 1;
            }

            @Get('/foo')
            getX() {
                return Promise.resolve({ ok: true });
            }
        }

        let app = await Application.bootstrap(FakeModule, { silent: true });
        let response = await fetch('http://localhost:32553/foo');
        expect(response.status).to.equal(200);

        expect(initialized, `Controller's onInit should have run exactly once`)
            .to.equal(1);
        expect(started, `Controller's onStart should have run exactly once`)
            .to.equal(1);

        app.stop();
    });
});