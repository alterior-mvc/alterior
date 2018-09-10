import { suite } from "razmin";
import { teststrap } from "./teststrap";
import { WebService } from "./service";
import { Mount, Get } from "./metadata";
import { OpenApiController } from "./openapi";
import { expect } from "chai";
import { AppOptionsAnnotation } from "@alterior/runtime";

suite(describe => {
    describe('OpenApiController', it => {
        it('produces a valid OpenAPI specification for an empty application.', async () => {

            @WebService({
                version: '1.2.3'
            })
            class TestApp {
                @Mount('/openapi')
                openapi : OpenApiController;
            }

            let appOptionsAnnotation = AppOptionsAnnotation.getForClass(TestApp);
            expect(appOptionsAnnotation.options.version).to.eq('1.2.3');

            await teststrap(TestApp, async test => {
                let response = await test.get('/openapi').expect(200);
                expect(response.body.openapi).to.eq('3.0.0');
                expect(response.body.info.version).to.eq('1.2.3');
            });
        });
    });
});