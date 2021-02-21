import { suite } from 'razmin';
import { expect } from 'chai';
import { WebService } from './service';
import { Get, Controller, Mount } from './metadata';
import { teststrap } from './teststrap';
import { Module } from '@alterior/di';
import { Application } from '@alterior/runtime';
import * as fetch from 'node-fetch';

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
            let response = await fetch('http://localhost:32552/foo');
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
            let response = await fetch('http://localhost:32553/foo');
            expect(response.status).to.equal(200);
            
            expect(initialized, `Controller's altOnInit should have run exactly once`)
                .to.equal(1);
            expect(started, `Controller's altOnStart should have run exactly once`)
                .to.equal(1);

            app.stop();
        });
    })
});