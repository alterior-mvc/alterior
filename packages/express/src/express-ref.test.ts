import { suite } from 'razmin';
import { Application } from '@alterior/runtime';
import { expect } from 'chai';
import { WebService } from '@alterior/web-server';
import { WebServer } from '@alterior/web-server';

suite(describe => {
	describe('ExpressRef', it => {
		it('should provide ExpressRef with a valid Express application in it', async () => {
			return new Promise(async (resolve, reject) => {
				@WebService({
					server: { 
						port: 10007, 
						silent: true
					}
				})
				class FakeApp { 
				}

				let app = await Application.bootstrap(FakeApp, { silent: true, autostart: false });
				let server = WebServer.for(app.inject(FakeApp));
				expect(server, 'server should be retrievable via WebServer.for()').to.exist;

				let expressApp = WebServer.for(app.inject(FakeApp)).engine.app;

				expect(expressApp, 'WebServer provided invalid app value').to.exist;
				expect(expressApp['patch'], 'WebServer provided app without patch() method').to.exist;
				resolve();
				app.stop();
			});
		});
	});
});