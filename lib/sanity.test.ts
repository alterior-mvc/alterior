import * as assert from 'assert';
import { suite, test as it } from 'mocha-typescript';

import { bootstrap as _bootstrap } from '../lib/bootstrap';
import { AppOptions, OnInit, OnSanityCheck } from '../lib/application';
import { SanityCheckReporter } from './sanity';
import { ApplicationArgs } from './args';

class MockApplicationArgs extends ApplicationArgs {
	constructor(private args : string[]) { 
		super();
	}

	get() {
		return this.args; 
	}
}

class MockSanityCheckReporter extends SanityCheckReporter {
	public onSuccess : any;
	public onFailure : any;

	reportSuccess() {
		this.onSuccess();
	}

	reportFailure(error : any) {
		this.onFailure(error);
	}

	static noop(done? : any) {
		let reporter = new MockSanityCheckReporter();
		reporter.onSuccess = reporter.onFailure = () => { if (done) done(); };
		return reporter;
	}

	static shouldSucceed(done? : any) {
		let reporter = new MockSanityCheckReporter();
		reporter.onSuccess = () => { if (done) done(); };
		reporter.onFailure = () => { throw new Error("Should not fail"); };
		return reporter;
	}
	static shouldFail(done? : any) {
		let reporter = new MockSanityCheckReporter();
		reporter.onSuccess = () => { throw new Error("Should not succeed"); };
		reporter.onFailure = () => { if (done) done(); };
		return reporter;
	}
}

describe("sanity", () => {
	
	@suite class Application {		

		@it 'should call altOnSanityCheck' (done) {
			@AppOptions({ 
				port: 10002, 
				silent: true,
				providers: [
					{ provide: SanityCheckReporter, useValue: MockSanityCheckReporter.noop() },
					{ provide: ApplicationArgs, useValue: new MockApplicationArgs(['test']) }
				],
				autoRegisterControllers: false
			}) 
			class FakeApp implements OnSanityCheck {
				altOnSanityCheck() {
					done();
					return Promise.resolve(true); 
				}
			}

			_bootstrap(FakeApp);
		}
		
		@it 'should signal successful sanity check when app does' (done) {
		
			@AppOptions({ port: 10002, silent: true,
				providers: [
					{ provide: SanityCheckReporter, useValue: MockSanityCheckReporter.shouldSucceed(done) },
					{ provide: ApplicationArgs, useValue: new MockApplicationArgs(['test']) }
				],
				autoRegisterControllers: false
			}) 
			class FakeApp implements OnSanityCheck {
				altOnSanityCheck() {
					return Promise.resolve(true); 
				}
			}

			_bootstrap(FakeApp);
		}

		@it 'should signal failed sanity check when app throws' (done) {
			
			@AppOptions({ port: 10002, silent: true,
				providers: [
					{ provide: SanityCheckReporter, useValue: MockSanityCheckReporter.shouldFail(done) },
					{ provide: ApplicationArgs, useValue: new MockApplicationArgs(['test']) }
				],
				autoRegisterControllers: false
			}) 
			class FakeApp implements OnSanityCheck {
				altOnSanityCheck() {
					let v = true;
					if (v)
						throw new Error("crap");
					
					return Promise.resolve(true); 
				}
			}

			_bootstrap(FakeApp);
		}

		@it 'should signal failed sanity check when app promise throws' (done) {
			
			@AppOptions({ port: 10002, silent: true,
				providers: [
					{ provide: SanityCheckReporter, useValue: MockSanityCheckReporter.shouldFail(done) },
					{ provide: ApplicationArgs, useValue: new MockApplicationArgs(['test']) }
				],
				autoRegisterControllers: false
			}) 
			class FakeApp implements OnSanityCheck {
				altOnSanityCheck() {
					return <any>Promise.reject("whatever"); 
				}
			}

			_bootstrap(FakeApp);
		}

		@it 'should signal failed sanity check when app does' (done) {
			
			@AppOptions({ port: 10002, silent: true,
				providers: [
					{ provide: SanityCheckReporter, useValue: MockSanityCheckReporter.shouldFail(done) },
					{ provide: ApplicationArgs, useValue: new MockApplicationArgs(['test']) }
				],
				autoRegisterControllers: false
			}) 
			class FakeApp implements OnSanityCheck {
				altOnSanityCheck() {
					return Promise.resolve(false); 
				}
			}

			_bootstrap(FakeApp);
		}
	}
});