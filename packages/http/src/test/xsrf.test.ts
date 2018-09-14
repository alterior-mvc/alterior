/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {describe, it, beforeEach, afterEach} from 'razmin';
import {expect} from 'chai';

import {HttpHeaders} from '../headers';
import {HttpRequest} from '../request';
import {HttpXsrfInterceptor, HttpXsrfTokenExtractor} from '../xsrf';

import {HttpClientTestingBackend} from '../testing/backend';

class SampleTokenExtractor extends HttpXsrfTokenExtractor {
  constructor(private token: string|null) { super(); }

  getToken(): string|null { return this.token; }
}

{
  describe('HttpXsrfInterceptor', () => {
    let backend: HttpClientTestingBackend;
    const interceptor = new HttpXsrfInterceptor(new SampleTokenExtractor('test'), 'X-XSRF-TOKEN');
    beforeEach(() => { backend = new HttpClientTestingBackend(); });
    it('applies XSRF protection to outgoing requests', () => {
      interceptor.intercept(new HttpRequest('POST', '/test', {}), backend).subscribe();
      const req = backend.expectOne('/test');
      expect(req.request.headers.get('X-XSRF-TOKEN')).to.equal('test');
      req.flush({});
    });
    it('does not apply XSRF protection when request is a GET', () => {
      interceptor.intercept(new HttpRequest('GET', '/test'), backend).subscribe();
      const req = backend.expectOne('/test');
      expect(req.request.headers.has('X-XSRF-TOKEN')).to.equal(false);
      req.flush({});
    });
    it('does not apply XSRF protection when request is a HEAD', () => {
      interceptor.intercept(new HttpRequest('HEAD', '/test'), backend).subscribe();
      const req = backend.expectOne('/test');
      expect(req.request.headers.has('X-XSRF-TOKEN')).to.equal(false);
      req.flush({});
    });
    it('does not overwrite existing header', () => {
      interceptor
          .intercept(
              new HttpRequest(
                  'POST', '/test', {}, {headers: new HttpHeaders().set('X-XSRF-TOKEN', 'blah')}),
              backend)
          .subscribe();
      const req = backend.expectOne('/test');
      expect(req.request.headers.get('X-XSRF-TOKEN')).to.equal('blah');
      req.flush({});
    });
    it('does not set the header for a null token', () => {
      const interceptor = new HttpXsrfInterceptor(new SampleTokenExtractor(null), 'X-XSRF-TOKEN');
      interceptor.intercept(new HttpRequest('POST', '/test', {}), backend).subscribe();
      const req = backend.expectOne('/test');
      expect(req.request.headers.has('X-XSRF-TOKEN')).to.equal(false);
      req.flush({});
    });
    afterEach(() => { backend.verify(); });
  });
}