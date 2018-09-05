import { CONTROLLER_CLASSES, Controller as _Controller } from './controller';
import { Get, RouteReflector } from './route';
import { suite } from 'razmin';
import * as assert from 'assert';

@_Controller('/foo')
class foo {
	@Get('bar')
	bar(req, res) {
		res.status(200).send("works");
	}
	
	@Get('/baz')
	baz(req, res) {
		res.status(200).send("works");
	}
}

suite(describe => {
	describe('Controller', it => {
		it("should register the controller globally", () => {
			@_Controller()
			class foo {
			} 

			assert(CONTROLLER_CLASSES.find(x => x === foo));
		});

		it("should cause routes within it to be modified by basePath", () => {	
			assert(CONTROLLER_CLASSES.find(x => x === foo));
			let reflector = new RouteReflector(foo);
			assert(reflector.routes.length === 2);
			assert(reflector.routes[0].path === '/foo/bar');
			assert(reflector.routes[1].path === '/foo/baz');
		});
	});
});