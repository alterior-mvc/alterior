import { Get } from './route';
import { AppOptions } from './application';
import { bootstrap } from './bootstrap';
import * as supertest from 'supertest';

describe("application", () => {
	
	describe("Application", async () => {

		it('should register routes defined on itself and respond to them', (done) => {

			@AppOptions({ 
				port: 10001, 
				silent: true,
				autoRegisterControllers: false
			}) 
			class FakeApp {
				@Get('/version')
				version() {
					return '1.2.3';
				}
			}

			let app = bootstrap(FakeApp).then(app => {
				supertest(app.express).get('/version')
					.expect(200, <any>`"1.2.3"`)
					.end((err) => {
						app.stop();
						if (err) 
							return done(err);
						done();	
					});
			});
		});
	});
});