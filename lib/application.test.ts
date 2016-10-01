import { controllerClasses, Controller as _Controller } from './controller';
import { Get, Post, Put, Patch, Delete, Options, RouteEvent } from './route';
import * as assert from 'assert';
import * as express from 'express';
import * as http from 'http';
import * as bodyParser from 'body-parser';

import { HttpException } from './errors';

import { AppOptions } from './application';
import { bootstrap } from './bootstrap';
import * as supertest from 'supertest';

describe("application", () => {
	
	describe("Application", () => {

		it('should register routes defined on itself and respond to them', (done) => {

			@AppOptions({ port: 10001, silent: true,
				autoRegisterControllers: false,
				middleware: [
					(req, res, next) => { res.header('Content-Type', 'application/json'); next(); }
				]
			}) 
			class FakeApp {
				@Get('/version')
				version() {
					return '1.2.3';
				}
			}

			bootstrap(FakeApp).then(app => {
				supertest(app.express).get('/version')
					.expect(200, <any>`"1.2.3"`)
					.end((err, res) => {
						app.stop();
						if (err) 
							return done(err);
						done();	
					});
			});
		});
	});
});