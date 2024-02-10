import { suite } from 'razmin';
import { prepareMiddleware, Middleware } from './middleware';
import { InjectionToken, Injector, inject } from '@alterior/di';
import { expect } from 'chai';
import { MiddlewareDefinition, MiddlewareFunction, WebRequest } from './metadata';
import { ServerResponse } from 'http';

suite(describe => {
	describe('prepareMiddleware', it => {
		it('should detect and prepare DI middleware', async () => {
            let observedReq, observedRes, observedNext;

            @Middleware()
            class SampleMiddleware {
                handle(req: WebRequest, res: ServerResponse, next: () => void) {
                    observedReq = req;
                    observedRes = res;
                    observedNext = next;
                }
            }

            let injector = Injector.resolveAndCreate([ SampleMiddleware ]);
            let preparedMiddleware = <MiddlewareFunction>prepareMiddleware(injector, SampleMiddleware);

            let passedReq = <WebRequest>{};
            let passedRes = <ServerResponse>{};
            let passedNext = () => {};

            preparedMiddleware(passedReq, passedRes, passedNext);

            expect(observedReq).to.be.equal(passedReq);
            expect(observedRes).to.be.equal(passedRes);
            expect(observedNext).to.be.equal(passedNext);

        });

		it('should support injection into DI middleware', async () => {
            let SAMPLE_INJECTABLE_TOKEN = new InjectionToken('FOO_TOKEN');
            let observedSampleInjectable: unknown;
            let sampleInjectableValue = {};

            @Middleware()
            class SampleMiddleware {
                constructor() {
                    observedSampleInjectable = inject(SAMPLE_INJECTABLE_TOKEN);
                }

                handle(req: WebRequest, res: ServerResponse, next: () => void) {
                }
            }

            let injector = Injector.resolveAndCreate([
                SampleMiddleware,
                { provide: SAMPLE_INJECTABLE_TOKEN, useValue: sampleInjectableValue }
            ]);
            prepareMiddleware(injector, SampleMiddleware);
            expect(observedSampleInjectable).to.be.equal(sampleInjectableValue)
        });
        
		it('should pass connect middleware through unchanged', async () => {
            let injector = Injector.resolveAndCreate([]);
            let observedReq, observedRes, observedNext;

            let connectMiddleware: MiddlewareDefinition = (req, res, next) => {
                observedReq = req;
                observedRes = res;
                observedNext = next;
            }

            let preparedMiddleware = <MiddlewareFunction>prepareMiddleware(injector, connectMiddleware);
            expect(preparedMiddleware).to.be.equal(connectMiddleware);

            let passedReq = <WebRequest>{};
            let passedRes = <ServerResponse>{};
            let passedNext = () => {};

            preparedMiddleware(passedReq, passedRes, passedNext);

            expect(observedReq).to.be.equal(passedReq);
            expect(observedRes).to.be.equal(passedRes);
            expect(observedNext).to.be.equal(passedNext);
		});
	});
});