/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Type } from './facade/type';
import { forwardRef, resolveForwardRef } from '.';
import { expect } from 'chai';
import { suite } from 'razmin';

suite(describe => {
  describe('forwardRef', it => {
    it('should wrap and unwrap the reference', () => {
      const ref = forwardRef(() => String);
      expect(ref instanceof Type).to.eq(true);
      expect(resolveForwardRef(ref)).to.eq(String);
    });
  });
  
})