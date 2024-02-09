import { Type } from './type';
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