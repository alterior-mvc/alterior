import { HttpError } from '@alterior/common';
import { expect } from 'chai';
import { suite } from 'razmin';
import { Get } from './metadata';
import { Response } from './response';

import { WebService } from './service';
import { teststrap } from './teststrap';

suite(describe => {
	describe("Response", it => {
		it('.created() should produce a 201 Created with response URL', () => {
			let body = {name: 'Foo'};
			let response = Response.created('http://example.com/', body);

			expect(response.status).to.equal(201);
			expect(response.headers[0][0]).to.equal('Location');
			expect(response.headers[0][1]).to.equal('http://example.com/');
			expect(response.body).to.equal(JSON.stringify(body));
		});

		it('string body should be JSON encoded', () => {
			let response = new Response(200, [], "hello");
			expect(response.body).to.equal(`"hello"`);
		});

		it('.encodeAs(\'raw\') should cause body to be pass-through encoded', () => {
			let response = new Response(200, [], "hello").encodeAs('raw');
			expect(response.body).to.equal("hello");
		});

		it('.throw() should throw an equivalent HttpError', () => {
			try {
				new Response(123, [['X-Test', 'pass']], "hello").throw();
			} catch (e) {
				expect(e).to.be.an.instanceof(HttpError);
				let httpe = <HttpError>e;
				expect(httpe.body).to.equal(`"hello"`);
				expect(httpe.statusCode).to.equal(123);
				expect(httpe.headers.length).to.equal(2);
				expect(httpe.headers[0][0]).to.equal('X-Test');
				expect(httpe.headers[0][1]).to.equal('pass');
				expect(httpe.headers[1][0]).to.equal('Content-Type');
				expect(httpe.headers[1][1]).to.equal('application/json; charset=utf-8');
			}
		});
		
		it('should be accepted and used when given as return value of a controller route method', async () => {
    
			@WebService({
				server: { silent: true }
			})
			class FakeApp {
				@Get('/foo')
				getX() {
					return new Response(
						201, 
						{
							'Content-Type': 'text/plain; charset=utf-8'
						},
						"token string"
					).encodeAs('raw');
				}
			}

			await teststrap(FakeApp)
				.get('/foo')
				.expect(201, <any>'token string')
				.expect('Content-Type', 'text/plain; charset=utf-8')
			;
		});

		it('should cause Content-Type: application/json when response is JSON', async () => {
    
			@WebService({
				server: { silent: true }
			})
			class FakeApp {
				@Get('/foo')
				getX() {
					return new Response(201, [], { stuff: 'and things' });
				}
			}

			teststrap(FakeApp)
				.get('/foo')
				.expect(201, <any>'{"stuff":"and things"}')
				.expect('Content-Type', 'application/json; charset=utf-8')
			;
		});
	});
});