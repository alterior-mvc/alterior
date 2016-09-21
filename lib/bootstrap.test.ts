import * as assert from 'assert';
import { suite, test as it } from 'mocha-typescript';
import { ApplicationArgs } from '../lib/args';
import { bootstrap as _bootstrap } from '../lib/bootstrap';
import { AppOptions, OnInit, OnSanityCheck } from '../lib/application';

@suite class bootstrap {
	@it 'should not accept a number for application class'() {

		try {
			_bootstrap(<any>123);
		} catch (e) {
			return; // expected behavior
		}

		throw new Error("bootstrap should throw when presented with 'class' 123");
	}

	@it 'should not accept a string for application class'() {

		try {
			_bootstrap(<any>'fubar');
		} catch (e) {
			return; // expected behavior
		}

		throw new Error("bootstrap should throw when presented with 'class' 'fubar'");
	}

	@it 'should call altOnInit' (done) {

		@AppOptions({ port: 10001, silent: true }) 
		class FakeApp implements OnInit {
			altOnInit() {
				done();
			}
		}

		_bootstrap(FakeApp).then(app => app.stop());
	}

	@it 'should perform basic dependency injection' (done) {

		class SomeDependency {
			public bar = 123;
		}

		@AppOptions({ 
			port: 10001, 
			silent: true,
			providers: [SomeDependency] 
		}) 
		class FakeApp { 
			constructor(foo : SomeDependency) {
				assert.equal(foo.bar, 123);
				done();
			}
		}

		_bootstrap(FakeApp).then(app => app.stop());;
	}

	@it 'should let you override core components' (done) {

		class MockApplicationArgs extends ApplicationArgs {
			constructor(private args : string[]) { 
				super();
			}

			get() {
				return this.args; 
			}
		}

		@AppOptions({ 
			port: 10001, 
			silent: true,
			providers: [{ provide: ApplicationArgs, useValue: new MockApplicationArgs(['foo', 'bar'])}] 
		}) 
		class FakeApp { 
			constructor(argsService : ApplicationArgs) {
				let args = argsService.get();

				assert.equal(args[0], 'foo');
				assert.equal(args[1], 'bar');
				done();
			}
		}

		_bootstrap(FakeApp).then(app => app.stop());;
	}
}