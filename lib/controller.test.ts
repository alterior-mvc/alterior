import { controllerClasses, Controller as _Controller } from './controller';
import { suite, test as it } from 'mocha-typescript';
import * as assert from 'assert';

@suite class Controller {
	@it "should register the controller globally" () {
		@_Controller()
		class foo {
		}

		assert(controllerClasses.find(x => x === foo));
	}
}