/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {describe, it} from 'razmin';
import {expect} from 'chai';

import {HttpHeaders} from '../headers';
import {HttpParams} from '../params';
import {HttpRequest} from '../request';

const TEST_URL = 'http://angular.io';
const TEST_STRING = `I'm a body!`;

{
  describe('HttpRequest', () => {
    describe('constructor', () => {
      it('initializes url', () => {
        const req = new HttpRequest('', TEST_URL, null);
        expect(req.url).to.equal(TEST_URL);
      });
      it('doesn\'t require a body for body-less methods', () => {
        let req = new HttpRequest('GET', TEST_URL);
        expect(req.method).to.equal('GET');
        expect(req.body).to.be.null;
        req = new HttpRequest('HEAD', TEST_URL);
        expect(req.method).to.equal('HEAD');
        expect(req.body).to.be.null;
        req = new HttpRequest('JSONP', TEST_URL);
        expect(req.method).to.equal('JSONP');
        expect(req.body).to.be.null;
        req = new HttpRequest('OPTIONS', TEST_URL);
        expect(req.method).to.equal('OPTIONS');
        expect(req.body).to.be.null;
      });
      it('accepts a string request method', () => {
        const req = new HttpRequest('TEST', TEST_URL, null);
        expect(req.method).to.equal('TEST');
      });
      it('accepts a string body', () => {
        const req = new HttpRequest('POST', TEST_URL, TEST_STRING);
        expect(req.body).to.equal(TEST_STRING);
      });
      it('accepts an object body', () => {
        const req = new HttpRequest('POST', TEST_URL, {data: TEST_STRING});
        expect(req.body).to.eql({data: TEST_STRING});
      });
      it('creates default headers if not passed', () => {
        const req = new HttpRequest('GET', TEST_URL);
        expect(req.headers instanceof HttpHeaders).to.be.ok;
      });
      it('uses the provided headers if passed', () => {
        const headers = new HttpHeaders();
        const req = new HttpRequest('GET', TEST_URL, {headers});
        expect(req.headers).to.equal(headers);
      });
      it('defaults to Json', () => {
        const req = new HttpRequest('GET', TEST_URL);
        expect(req.responseType).to.equal('json');
      });
    });
    describe('clone() copies the request', () => {
      const headers = new HttpHeaders({
        'Test': 'Test header',
      });
      const req = new HttpRequest('POST', TEST_URL, 'test body', {
        headers,
        reportProgress: true,
        responseType: 'text',
        withCredentials: true,
      });
      it('in the base case', () => {
        const clone = req.clone();
        expect(clone.method).to.equal('POST');
        expect(clone.responseType).to.equal('text');
        expect(clone.url).to.equal(TEST_URL);
        // Headers should be the same, as the headers are sealed.
        expect(clone.headers).to.equal(headers);
        expect(clone.headers.get('Test')).to.equal('Test header');
      });
      it('and updates the url',
         () => { expect(req.clone({url: '/changed'}).url).to.equal('/changed'); });
      it('and updates the method',
         () => { expect(req.clone({method: 'PUT'}).method).to.equal('PUT'); });
      it('and updates the body',
         () => { expect(req.clone({body: 'changed body'}).body).to.equal('changed body'); });
    });
    describe('content type detection', () => {
      const baseReq = new HttpRequest('POST', '/test', null);
      it('handles a null body', () => { expect(baseReq.detectContentTypeHeader()).to.be.null; });
      it('doesn\'t associate a content type with ArrayBuffers', () => {
        const req = baseReq.clone({body: new ArrayBuffer(4)});
        expect(req.detectContentTypeHeader()).to.be.null;
      });
      it('handles strings as text', () => {
        const req = baseReq.clone({body: 'hello world'});
        expect(req.detectContentTypeHeader()).to.equal('text/plain');
      });
      it('handles arrays as json', () => {
        const req = baseReq.clone({body: ['a', 'b']});
        expect(req.detectContentTypeHeader()).to.equal('application/json');
      });
      it('handles numbers as json', () => {
        const req = baseReq.clone({body: 314159});
        expect(req.detectContentTypeHeader()).to.equal('application/json');
      });
      it('handles objects as json', () => {
        const req = baseReq.clone({body: {data: 'test data'}});
        expect(req.detectContentTypeHeader()).to.equal('application/json');
      });
    });
    describe('body serialization', () => {
      const baseReq = new HttpRequest('POST', '/test', null);
      it('handles a null body', () => { expect(baseReq.serializeBody()).to.be.null; });
      it('passes ArrayBuffers through', () => {
        const body = new ArrayBuffer(4);
        expect(baseReq.clone({body}).serializeBody()).to.equal(body);
      });
      it('passes strings through', () => {
        const body = 'hello world';
        expect(baseReq.clone({body}).serializeBody()).to.equal(body);
      });
      it('serializes arrays as json', () => {
        expect(baseReq.clone({body: ['a', 'b']}).serializeBody()).to.equal('["a","b"]');
      });
      it('handles numbers as json',
         () => { expect(baseReq.clone({body: 314159}).serializeBody()).to.equal('314159'); });
      it('handles objects as json', () => {
        const req = baseReq.clone({body: {data: 'test data'}});
        expect(req.serializeBody()).to.equal('{"data":"test data"}');
      });
      it('serializes parameters as urlencoded', () => {
        const params = new HttpParams().append('first', 'value').append('second', 'other');
        const withParams = baseReq.clone({body: params});
        expect(withParams.serializeBody()).to.equal('first=value&second=other');
        expect(withParams.detectContentTypeHeader())
            .to.equal('application/x-www-form-urlencoded;charset=UTF-8');
      });
    });
    describe('parameter handling', () => {
      const baseReq = new HttpRequest('GET', '/test', null);
      const params = new HttpParams({fromString: 'test=true'});
      it('appends parameters to a base URL', () => {
        const req = baseReq.clone({params});
        expect(req.urlWithParams).to.equal('/test?test=true');
      });
      it('appends parameters to a URL with an empty query string', () => {
        const req = baseReq.clone({params, url: '/test?'});
        expect(req.urlWithParams).to.equal('/test?test=true');
      });
      it('appends parameters to a URL with a query string', () => {
        const req = baseReq.clone({params, url: '/test?other=false'});
        expect(req.urlWithParams).to.equal('/test?other=false&test=true');
      });
      it('sets parameters via setParams', () => {
        const req = baseReq.clone({setParams: {'test': 'false'}});
        expect(req.urlWithParams).to.equal('/test?test=false');
      });
    });
  });
}