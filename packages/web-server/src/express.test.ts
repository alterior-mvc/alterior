import { suite } from 'razmin';
import { ExpressRef as _ExpressRef } from './express-ref';
import { AppOptions, Application } from '@alterior/runtime';
import * as assert from 'assert';
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
				let module = app.runtime.instances[0].instance;
				let expressRef = module.expressRef;
				let expressApp = expressRef.application;

				assert(expressApp, 'ExpressRef provided invalid app value');
				assert(expressApp.patch, 'ExpressRef provided app without patch() method');
				resolve();

				app.stop();
			});
		});
	});
});