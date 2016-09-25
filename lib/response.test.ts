import { controllerClasses, Controller } from './controller';
import { Get, Post, Put, Patch, Delete, Options, RouteEvent } from './route';
import { Response as _Response } from './response';
import * as assert from 'assert';
import * as express from 'express';
import * as http from 'http';
import * as bodyParser from 'body-parser';

import { HttpException } from './errors';

import { AppOptions } from './application';
import { bootstrap } from './bootstrap';
import * as supertest from 'supertest';

describe("response", () => {

	describe("Response", () => {
		
		it('should be accepted and used when given as return value of a controller route method', (done) => {
    
			@Controller()
			class TestController {
				@Get('/foo')
				getX(req : express.Request, res : express.Response) {
					return new _Response(201, [['Content-Type', 'text/plain; charset=utf-8']], "token string");
				}
			} 

			@AppOptions({ port: 10001, silent: true,
				autoRegisterControllers: false,
				controllers: [TestController],
				middleware: [
					(req, res, next) => { res.header('Content-Type', 'application/json'); next(); }
				] 
			}) 
			class FakeApp {
			}

			bootstrap(FakeApp).then(app => {
				supertest(app.express)
					.get('/foo')
					.expect(201, <any>'token string')
					.expect('Content-Type', 'text/plain; charset=utf-8')
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