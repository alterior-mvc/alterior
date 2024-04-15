import { suite } from 'razmin';
import { prepareMiddleware, Middleware } from './middleware';
import { ReflectiveInjector, Inject, InjectionToken } from '@alterior/di';
import { expect } from 'chai';

suite(describe => {
	describe('prepareMiddleware', it => {
		it('should detect and prepare DI middleware', async () => {
            let injector = ReflectiveInjector.resolveAndCreate([]);

            let observedReq, observedRes, observedNext;

            @Middleware()
            class SampleMiddleware {
                handle(req, res, next) {
                    observedReq = req;
                    observedRes = res;
                    observedNext = next;        
                }
            }

            let preparedMiddleware = prepareMiddleware(injector, SampleMiddleware);

            let passedReq = {};
            let passedRes = {};
            let passedNext = () => {};

            preparedMiddleware(passedReq, passedRes, passedNext);

            expect(observedReq).to.be.equal(passedReq);
            expect(observedRes).to.be.equal(passedRes);
            expect(observedNext).to.be.equal(passedNext);

        });

		it('should support injection into DI middleware', async () => {
            let SAMPLE_INJECTABLE_TOKEN = new InjectionToken('FOO_TOKEN');
            let observedSampleInjectable;
            let sampleInjectableValue = {};
            let injector = ReflectiveInjector.resolveAndCreate([
                { provide: SAMPLE_INJECTABLE_TOKEN, useValue: sampleInjectableValue }
            ]);

            @Middleware()
            class SampleMiddleware {
                constructor(
                    @Inject(SAMPLE_INJECTABLE_TOKEN)
                    sampleInjectable : string
                ) {
                    observedSampleInjectable = sampleInjectable;
                }

                handle(req, res, next) {
                }
            }

            let connectMiddleware = prepareMiddleware(injector, SampleMiddleware);

            connectMiddleware();

            expect(observedSampleInjectable).to.be.equal(sampleInjectableValue)
        });
        
		it('should pass connect middleware through unchanged', async () => {
            let injector = ReflectiveInjector.resolveAndCreate([]);
            let observedReq, observedRes, observedNext;

            function connectMiddleware(req, res, next) {
                observedReq = req;
                observedRes = res;
                observedNext = next;
            }

            let preparedMiddleware = prepareMiddleware(injector, connectMiddleware);
            expect(preparedMiddleware).to.be.equal(connectMiddleware);

            let passedReq = {};
            let passedRes = {};
            let passedNext = () => {};

            preparedMiddleware(passedReq, passedRes, passedNext);

            expect(observedReq).to.be.equal(passedReq);
            expect(observedRes).to.be.equal(passedRes);
            expect(observedNext).to.be.equal(passedNext);
		});
	});
});