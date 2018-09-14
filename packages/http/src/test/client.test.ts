/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {beforeEach, afterEach, describe, it} from 'razmin';
import {toArray} from 'rxjs/operators';
import {expect} from 'chai';
import {HttpClient} from '../client';
import {HttpErrorResponse, HttpEventType, HttpResponse} from '../response';
import {HttpClientTestingBackend} from '../testing/backend';

describe('HttpClient', () => {
  let client: HttpClient = null !;
  let backend: HttpClientTestingBackend = null !;
  beforeEach(() => {
    backend = new HttpClientTestingBackend();
    client = new HttpClient(backend);
  });
  afterEach(() => { backend.verify(); });
  describe('makes a basic request', () => {
    it('for JSON data', done => {
      client.get('/test').subscribe(res => {
        expect((res as any)['data']).to.eq('hello world');
        done();
      });
      backend.expectOne('/test').flush({'data': 'hello world'});
    });
    it('for text data', done => {
      client.get('/test', {responseType: 'text'}).subscribe(res => {
        expect(res).to.eq('hello world');
        done();
      });
      backend.expectOne('/test').flush('hello world');
    });
    it('with headers', done => {
      client.get('/test', {headers: {'X-Option': 'true'}}).subscribe(() => done());
      const req = backend.expectOne('/test');
      expect(req.request.headers.get('X-Option')).to.eq('true');
      req.flush({});
    });
    it('with params', done => {
      client.get('/test', {params: {'test': 'true'}}).subscribe(() => done());
      backend.expectOne('/test?test=true').flush({});
    });
    it('for an arraybuffer', done => {
      const body = new ArrayBuffer(4);
      client.get('/test', {responseType: 'arraybuffer'}).subscribe(res => {
        expect(res).to.eq(body);
        done();
      });
      backend.expectOne('/test').flush(body);
    });
    if (typeof Blob !== 'undefined') {
      it('for a blob', done => {
        const body = new Blob([new ArrayBuffer(4)]);
        client.get('/test', {responseType: 'blob'}).subscribe(res => {
          expect(res).to.eq(body);
          done();
        });
        backend.expectOne('/test').flush(body);
      });
    }
    it('that returns a response', done => {
      const body = {'data': 'hello world'};
      client.get('/test', {observe: 'response'}).subscribe(res => {
        expect(res instanceof HttpResponse).to.equal(true);
        expect(res.body).to.eq(body);
        done();
      });
      backend.expectOne('/test').flush(body);
    });
    it('that returns a stream of events', done => {
      client.get('/test', {observe: 'events'}).pipe(toArray()).toPromise().then(events => {
        expect(events.length).to.eq(2);
        let x = HttpResponse;
        expect(events[0].type).to.eq(HttpEventType.Sent);
        expect(events[1].type).to.eq(HttpEventType.Response);
        expect(events[1] instanceof HttpResponse).to.be.ok;
        done();
      });
      backend.expectOne('/test').flush({'data': 'hello world'});
    });
    it('with progress events enabled', done => {
      client.get('/test', {reportProgress: true}).subscribe(() => done());
      const req = backend.expectOne('/test');
      expect(req.request.reportProgress).to.be.true;
      req.flush({});
    });
  });
  describe('makes a POST request', () => {
    it('with text data', done => {
      client.post('/test', 'text body', {observe: 'response', responseType: 'text'})
          .subscribe(res => {
            expect(res.ok).to.be.ok;
            expect(res.status).to.equal(200);
            done();
          });
      backend.expectOne('/test').flush('hello world');
    });
    it('with json data', done => {
      const body = {data: 'json body'};
      client.post('/test', body, {observe: 'response', responseType: 'text'}).subscribe(res => {
        expect(res.ok).to.be.ok;
        expect(res.status).to.equal(200);
        done();
      });
      const testReq = backend.expectOne('/test');
      expect(testReq.request.body).to.equal(body);
      testReq.flush('hello world');
    });
    it('with a json body of false', done => {
      client.post('/test', false, {observe: 'response', responseType: 'text'}).subscribe(res => {
        expect(res.ok).to.be.ok;
        expect(res.status).to.equal(200);
        done();
      });
      const testReq = backend.expectOne('/test');
      expect(testReq.request.body).to.equal(false);
      testReq.flush('hello world');
    });
    it('with a json body of 0', done => {
      client.post('/test', 0, {observe: 'response', responseType: 'text'}).subscribe(res => {
        expect(res.ok).to.be.ok;
        expect(res.status).to.equal(200);
        done();
      });
      const testReq = backend.expectOne('/test');
      expect(testReq.request.body).to.equal(0);
      testReq.flush('hello world');
    });
    it('with an arraybuffer', done => {
      const body = new ArrayBuffer(4);
      client.post('/test', body, {observe: 'response', responseType: 'text'}).subscribe(res => {
        expect(res.ok).to.be.ok;
        expect(res.status).to.be.equal(200);
        done();
      });
      const testReq = backend.expectOne('/test');
      expect(testReq.request.body).to.equal(body);
      testReq.flush('hello world');
    });
  });
  describe('makes a JSONP request', () => {
    it('with properly set method and callback', done => {
      client.jsonp('/test', 'myCallback').subscribe(() => done());
      backend.expectOne({method: 'JSONP', url: '/test?myCallback=JSONP_CALLBACK'})
          .flush('hello world');
    });
  });
  describe('makes a request for an error response', () => {
    it('with a JSON body', done => {
      client.get('/test').subscribe(() => {}, (res: HttpErrorResponse) => {
        expect(res.error.data).to.equal('hello world');
        done();
      });
      backend.expectOne('/test').flush(
          {'data': 'hello world'}, {status: 500, statusText: 'Server error'});
    });
  });
});