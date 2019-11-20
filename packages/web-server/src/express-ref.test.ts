import { suite } from 'razmin';
import { ExpressRef as _ExpressRef } from './express-ref';
import { AppOptions, Application } from '@alterior/runtime';
import * as assert from 'assert';
import { expect } from 'chai';
import { Module } from '@alterior/di';
import { WebServerModule } from './web-server.module';

suite(describe => {
	describe('ExpressRef', it => {
		it('should provide ExpressRef with a valid Express application in it', async () => {

			return new Promise(async (resolve, reject) => {
				@Module({
					imports: [
						WebServerModule.configure({ 
							port: 10007, 
							silent: true
						})
					]
				})
				class FakeApp { 
					constructor(public expressRef : _ExpressRef) {}
				}

				let app = await Application.bootstrap(FakeApp, { autostart: false });
				let module = app.runtime.instances.find(x => x.instance.constructor === FakeApp).instance;

				let expressRef = module.expressRef;

				expect(expressRef, 'ExpressRef is invalid').to.exist;

				let expressApp = expressRef.application;

				expect(expressApp, 'ExpressRef provided invalid app value').to.exist;
				expect(expressApp.patch, 'ExpressRef provided app without patch() method').to.exist;

				resolve();

				app.stop();
			});
		});
	});
});