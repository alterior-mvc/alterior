import { suite } from "razmin";
import { teststrap } from "./teststrap";
import { WebService } from "./service";
import { Mount } from "./metadata";
import { OpenApiController } from "./openapi";
import { expect } from "chai";

suite(describe => {
    describe('OpenApiController', it => {
        it('produces a valid OpenAPI specification for an empty application.', async () => {
            @WebService()
            class TestApp {
                @Mount('/openapi')
                openapi : OpenApiController;
            }

            await teststrap(TestApp, async test => {
                let response = await test.get('/openapi').expect(200);
                //expect(response.body.openapi).to.eq('3.0.0');
            });
        });
    });
});