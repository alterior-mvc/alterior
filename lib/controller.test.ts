import { controllerClasses, Controller as _Controller } from './controller';
import { Get, Post, Put } from './route';
import { suite, test as it } from 'mocha-typescript';
import * as assert from 'assert';
import * as express from 'express';
import * as http from 'http';

import { AppOptions } from './application';
import { bootstrap } from './bootstrap';
import * as supertest from 'supertest';

@suite class Controller {
	@it "should register the controller globally" () {
		@_Controller()
		class foo {
		}

		assert(controllerClasses.find(x => x === foo));
	}
}