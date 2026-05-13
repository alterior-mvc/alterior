import { suite } from 'razmin';
import { expect } from 'chai';
import { WebService } from './service';
import { Get } from './metadata';
import { teststrap } from './teststrap';
import { Application } from '@alterior/runtime';
import { Response } from './response';
import { HttpError } from '@alterior/common';
import { altFetch } from './utils';

suite(describe => {
    describe('@Controller', it => {
        it('should execute altOnInit once', async () => {
            let initialized = 0;

            @WebService()
            class FakeModule {
                altOnInit() {
                    initialized += 1;
                }
				@Get('/foo')
				getX() {
					return Promise.resolve({ok: true});
				}
            }

			await teststrap(FakeModule)
				.get('/foo')
				.expect(200, { ok: true })
			;
            
            expect(initialized, `Controller's altOnInit should have run exactly once`)
                .to.equal(1);
        });
        it('should execute altOnStart once', async () => {
            let started = 0;

            @WebService({
                server: { port: 32552 }
            })
            class FakeModule {
                altOnStart() {
                    started += 1;
                }

				@Get('/foo')
				getX() {
					return Promise.resolve({ok: true});
				}
            }

            let app = await Application.bootstrap(FakeModule, { silent: true });
            let response = await altFetch('http://localhost:32552/foo');
            expect(response.status).to.equal(200);
            
            expect(started, `Controller's altOnStart should have run exactly once`)
                .to.equal(1);

            app.stop();
        });
        it('should execute both altOnInit and altOnStart once each', async () => {
            let started = 0;
            let initialized = 0;

            @WebService({
                server: { port: 32553 }
            })
            class FakeModule {

                altOnInit() {
                    initialized += 1;
                }
                altOnStart() {
                    started += 1;
                }
				@Get('/foo')
				getX() {
					return Promise.resolve({ok: true});
				}
            }

            let app = await Application.bootstrap(FakeModule, { silent: true });
            let response = await altFetch('http://localhost:32553/foo');
            expect(response.status).to.equal(200);
            
            expect(initialized, `Controller's altOnInit should have run exactly once`)
                .to.equal(1);
            expect(started, `Controller's altOnStart should have run exactly once`)
                .to.equal(1);

            app.stop();
        });
        it('should translate Response values to responses', async () => {
            @WebService({
                server: { port: 32554 }
            })
            class FakeModule {
				@Get('/foo')
				getX() {
					return Response.conflict();
				}
            }

            let app = await Application.bootstrap(FakeModule, { silent: true });
            let response = await altFetch('http://localhost:32554/foo');
            expect(response.status).to.equal(409);
            app.stop();
        });
        it('should catch HttpExceptions and convert them to responses', async () => {
            @WebService({
                server: { port: 32555 }
            })
            class FakeModule {
				@Get('/foo')
				getX() {
					throw new HttpError(409, {});
				}
            }

            let app = await Application.bootstrap(FakeModule, { silent: true });
            let response = await altFetch('http://localhost:32555/foo');
            expect(response.status).to.equal(409);
            app.stop();
        });
        it('should catch Response.throw() and convert them to responses', async () => {
            @WebService({
                server: { port: 32556 }
            })
            class FakeModule {
				@Get('/foo')
				getX() {
					Response.conflict().throw();
				}
            }

            let app = await Application.bootstrap(FakeModule, { silent: true });
            let response = await altFetch('http://localhost:32556/foo');
            expect(response.status).to.equal(409);
            app.stop();
        });
    })
});