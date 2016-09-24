import { controllerClasses, Controller as _Controller } from './controller';
import { Get, Post, Put, RouteReflector } from './route';
import { suite, test as it } from 'mocha-typescript';
import * as assert from 'assert';
import * as express from 'express';
import * as http from 'http';

import { AppOptions } from './application';
import { bootstrap } from './bootstrap';
import * as supertest from 'supertest';

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

@suite class Controller {
	@it "should register the controller globally" () {
		@_Controller()
		class foo {
		} 

		assert(controllerClasses.find(x => x === foo));
	}

	@it "should cause routes within it to be modified by basePath" () {
		
		assert(controllerClasses.find(x => x === foo));
		let reflector = new RouteReflector(foo);
		assert(reflector.routes.length === 2);
		assert(reflector.routes[0].path === '/foo/bar');
		assert(reflector.routes[1].path === '/foo/baz');
	}
}