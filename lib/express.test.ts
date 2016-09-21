import { suite, test as it } from 'mocha-typescript';
import { ExpressRef as _ExpressRef } from './express';
import { bootstrap } from './bootstrap';
import { AppOptions } from './application';
import * as assert from 'assert';

describe('express', () => {
	@suite class ExpressRef {
		@it 'should provide ExpressRef with a valid Express application in it' (done) {

			@AppOptions({ 
				port: 10001, 
				silent: true
			}) 
			class FakeApp { 
				constructor(argsService : _ExpressRef) {
					let app = argsService.application;

					assert(app, 'ExpressRef provided invalid app value');
					assert(app.patch, 'ExpressRef provided app without patch() method');
					done();
				}
			}

			bootstrap(FakeApp).then(app => app.stop());;
		}
	}
});