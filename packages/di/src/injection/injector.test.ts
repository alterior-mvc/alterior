/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Injector } from '..';
import { suite } from 'razmin';
import { expect } from 'chai';
import { NullInjector } from './null-injector';
import { THROW_IF_NOT_FOUND } from './throw-if-not-found';

suite(describe => {
  describe('Injector.NULL', it => {
    it('should throw if no arg is given', () => {
      expect(() => NullInjector.instance.get('someToken')).to.throw('No provider for someToken!');
    });

    it('should throw if THROW_IF_NOT_FOUND is given', () => {
      expect(() => NullInjector.instance.get('someToken', THROW_IF_NOT_FOUND)).to.throw('No provider for someToken!');
    });

    it('should return the default value', () => {
      expect(NullInjector.instance.get('someToken', 'notFound')).to.equal('notFound');
    });
  });
});