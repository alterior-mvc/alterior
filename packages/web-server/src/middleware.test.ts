import { suite } from 'razmin';
import { prepareMiddleware } from './middleware';
import { InjectionToken, Injector, inject } from '@alterior/di';
import { expect } from 'chai';
import { MiddlewareDefinition, WebRequest } from './metadata';
import { ServerResponse } from 'http';
import { ConnectMiddleware } from './web-server-engine';

suite(describe => {
	describe('prepareMiddleware', it => {
		it('should detect and prepare DI middleware', async () => {
            let observedReq, observedRes, observedNext;

            class SampleMiddleware {
                handle(req: WebRequest, res: ServerResponse, next: () => void) {
                    observedReq = req;
                    observedRes = res;
                    observedNext = next;
                }
            }

            let injector = Injector.resolveAndCreate([ SampleMiddleware ]);
            let preparedMiddleware = <ConnectMiddleware>prepareMiddleware(injector, SampleMiddleware);

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

            class SampleMiddleware {
                constructor() {
                    observedSampleInjectable = inject(SAMPLE_INJECTABLE_TOKEN);
                }

                handle(req: WebRequest, res: ServerResponse, next: () => void) {
                }
            }
            
            // MERGE TODO: Injector
            let injector = Injector.resolveAndCreate([
                SampleMiddleware,
                { provide: SAMPLE_INJECTABLE_TOKEN, useValue: sampleInjectableValue }
            ]);

            let connectMiddleware = <Function>prepareMiddleware(injector, SampleMiddleware);
            connectMiddleware();
            
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

            let preparedMiddleware = <ConnectMiddleware>prepareMiddleware(injector, connectMiddleware);
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