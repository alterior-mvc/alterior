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

describe('HttpHeaders', () => {

  describe('initialization', () => {
    it('should conform to spec', () => {
      const httpHeaders = {
        'Content-Type': 'image/jpeg',
        'Accept-Charset': 'utf-8',
        'X-My-Custom-Header': 'Zeke are cool',
      };
      const secondHeaders = new HttpHeaders(httpHeaders);
      expect(secondHeaders.get('Content-Type')).to.equal('image/jpeg');
    });

    it('should merge values in provided dictionary', () => {
      const headers = new HttpHeaders({'foo': 'bar'});
      expect(headers.get('foo')).to.equal('bar');
      expect(headers.getAll('foo')).to.eql(['bar']);
    });

    it('should lazily append values', () => {
      const src = new HttpHeaders();
      const a = src.append('foo', 'a');
      const b = a.append('foo', 'b');
      const c = b.append('foo', 'c');
      expect(src.getAll('foo')).to.be.null;
      expect(a.getAll('foo')).to.eql(['a']);
      expect(b.getAll('foo')).to.eql(['a', 'b']);
      expect(c.getAll('foo')).to.eql(['a', 'b', 'c']);
    });

    it('should keep the last value when initialized from an object', () => {
      const headers = new HttpHeaders({
        'foo': 'first',
        'fOo': 'second',
      });

      expect(headers.getAll('foo')).to.eql(['second']);
    });
  });

  describe('.set()', () => {
    it('should clear all values and re-set for the provided key', () => {
      const headers = new HttpHeaders({'foo': 'bar'});
      expect(headers.get('foo')).to.equal('bar');

      const second = headers.set('foo', 'baz');
      expect(second.get('foo')).to.equal('baz');

      const third = headers.set('fOO', 'bat');
      expect(third.get('foo')).to.equal('bat');
    });

    it('should preserve the case of the first call', () => {
      const headers = new HttpHeaders();
      const second = headers.set('fOo', 'baz');
      const third = second.set('foo', 'bat');
      expect(third.keys()).to.eql(['fOo']);
    });
  });

  describe('.get()', () => {
    it('should be case insensitive', () => {
      const headers = new HttpHeaders({'foo': 'baz'});
      expect(headers.get('foo')).to.equal('baz');
      expect(headers.get('FOO')).to.equal('baz');
    });

    it('should return null if the header is not present', () => {
      const headers = new HttpHeaders({bar: []});
      expect(headers.get('bar')).to.equal(null);
      expect(headers.get('foo')).to.equal(null);
    });
  });

  describe('.getAll()', () => {
    it('should be case insensitive', () => {
      const headers = new HttpHeaders({foo: ['bar', 'baz']});
      expect(headers.getAll('foo')).to.eql(['bar', 'baz']);
      expect(headers.getAll('FOO')).to.eql(['bar', 'baz']);
    });

    it('should return null if the header is not present', () => {
      const headers = new HttpHeaders();
      expect(headers.getAll('foo')).to.equal(null);
    });
  });

  describe('.delete', () => {
    it('should be case insensitive', () => {
      const headers = new HttpHeaders({'foo': 'baz'});
      expect(headers.has('foo')).to.equal(true);
      const second = headers.delete('foo');
      expect(second.has('foo')).to.equal(false);

      const third = second.set('foo', 'baz');
      expect(third.has('foo')).to.equal(true);
      const fourth = third.delete('FOO');
      expect(fourth.has('foo')).to.equal(false);
    });
  });

  describe('.append', () => {
    it('should append a value to the list', () => {
      const headers = new HttpHeaders();
      const second = headers.append('foo', 'bar');
      const third = second.append('foo', 'baz');
      expect(third.get('foo')).to.equal('bar');
      expect(third.getAll('foo')).to.eql(['bar', 'baz']);
    });

    it('should preserve the case of the first call', () => {
      const headers = new HttpHeaders();
      const second = headers.append('FOO', 'bar');
      const third = second.append('foo', 'baz');
      expect(third.keys()).to.eql(['FOO']);
    });
  });

  describe('response header strings', () => {
    it('should be parsed by the constructor', () => {
      const response = `Date: Fri, 20 Nov 2015 01:45:26 GMT\n` +
          `Content-Type: application/json; charset=utf-8\n` +
          `Transfer-Encoding: chunked\n` +
          `Connection: keep-alive`;
      const headers = new HttpHeaders(response);
      expect(headers.get('Date')).to.equal('Fri, 20 Nov 2015 01:45:26 GMT');
      expect(headers.get('Content-Type')).to.equal('application/json; charset=utf-8');
      expect(headers.get('Transfer-Encoding')).to.equal('chunked');
      expect(headers.get('Connection')).to.equal('keep-alive');
    });
  });
});