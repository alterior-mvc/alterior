import { ModuleAnnotation, ValueProvider } from "@alterior/di";
import { AppOptionsAnnotation } from "@alterior/runtime";
import { expect } from "chai";
import { describe, it } from "razmin";
import { Get } from "./metadata";
import { WebService, WebServiceAnnotation } from "./service";
import { teststrap } from "./teststrap";

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
        @WebService({
            version: '1.2.3',
            providers: [ { provide: 'foo', useValue: 123 } ],
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

        let provider = <ValueProvider>moduleAnnotation?.providers?.[0];
        expect(provider.provide).to.eq('foo');
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
});