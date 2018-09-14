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
import {HttpResponse} from '../response';

{
  describe('HttpResponse', () => {
    describe('constructor()', () => {
      it('fully constructs responses', () => {
        const resp = new HttpResponse({
          body: 'test body',
          headers: new HttpHeaders({
            'Test': 'Test header',
          }),
          status: 201,
          statusText: 'Created',
          url: '/test',
        });
        expect(resp.body).to.equal('test body');
        expect(resp.headers instanceof HttpHeaders).to.be.ok;
        expect(resp.headers.get('Test')).to.equal('Test header');
        expect(resp.status).to.equal(201);
        expect(resp.statusText).to.equal('Created');
        expect(resp.url).to.equal('/test');
      });
      it('uses defaults if no args passed', () => {
        const resp = new HttpResponse({});
        expect(resp.headers).not.to.be.null;
        expect(resp.status).to.equal(200);
        expect(resp.statusText).to.equal('OK');
        expect(resp.body).to.be.null;
        expect(resp.ok).to.be.ok;
        expect(resp.url).to.be.null;
      });
      it('accepts a falsy body', () => {
        expect(new HttpResponse({body: false}).body).to.equal(false);
        expect(new HttpResponse({body: 0}).body).to.equal(0);
      });
    });
    it('.ok is determined by status', () => {
      const good = new HttpResponse({status: 200});
      const alsoGood = new HttpResponse({status: 299});
      const badHigh = new HttpResponse({status: 300});
      const badLow = new HttpResponse({status: 199});
      expect(good.ok).to.equal(true);
      expect(alsoGood.ok).to.equal(true);
      expect(badHigh.ok).to.equal(false);
      expect(badLow.ok).to.equal(false);
    });
    describe('.clone()', () => {
      it('copies the original when given no arguments', () => {
        const clone =
            new HttpResponse({body: 'test', status: 201, statusText: 'created', url: '/test'})
                .clone();
        expect(clone.body).to.equal('test');
        expect(clone.status).to.equal(201);
        expect(clone.statusText).to.equal('created');
        expect(clone.url).to.equal('/test');
        expect(clone.headers).not.to.be.null;
      });
      it('overrides the original', () => {
        const orig =
            new HttpResponse({body: 'test', status: 201, statusText: 'created', url: '/test'});
        const clone =
            orig.clone({body: {data: 'test'}, status: 200, statusText: 'Okay', url: '/bar'});
        expect(clone.body).to.eql({data: 'test'});
        expect(clone.status).to.equal(200);
        expect(clone.statusText).to.equal('Okay');
        expect(clone.url).to.equal('/bar');
        expect(clone.headers).to.equal(orig.headers);
      });
    });
  });
}