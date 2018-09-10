import { suite } from "razmin";
import { teststrap } from "./teststrap";
import { WebService, WebServiceAnnotation } from "./service";
import { Mount, Get } from "./metadata";
import { OpenApiController } from "./openapi";
import { expect } from "chai";
import { AppOptionsAnnotation } from "@alterior/runtime";
import { ModuleAnnotation } from "@alterior/di";
import { WebServerModule, WebServerOptionsRef } from "./web-server.module";

suite(describe => {
	describe("WebServiceDecorator", it => {
		it('should work for a simple use case', async () => {
			@WebService()
			class TestService {
				@Get('/foo')
				getX() {
					return Promise.resolve({ok: true});
				}
			}

			await teststrap(TestService, async test =>
				await test.get('/foo').expect(200, {ok: true})
			);
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

            expect(appOptionsAnnotation.options.version).to.eq('1.2.3');
            expect(moduleAnnotation.providers.length).to.eq(1);
            expect(moduleAnnotation.providers[0]['provide']).to.eq('foo');
            expect(moduleAnnotation.providers[0]['useValue']).to.eq(123);

            let webServerModule = moduleAnnotation.imports.find(x => x['$module'] === WebServerModule);
            expect(webServerModule).to.not.eq(null);
            expect(webServerModule['providers'].length).to.be.gte(1);

            let optionsProvider = webServerModule['providers'].find(x => x.provide == WebServerOptionsRef);
            expect(optionsProvider).to.not.eq(null);

            let optionsRef : WebServerOptionsRef = optionsProvider.useValue;

            expect(optionsRef.options.port).to.eq(12321);
        });
    });
});