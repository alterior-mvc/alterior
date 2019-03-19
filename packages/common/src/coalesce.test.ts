import { suite } from "razmin";
import { coalesce } from "./coalesce";
import { expect } from "chai";

suite(describe => {
    describe('coalesce', it => {
        it('should produce the first defined value', () => {
            expect(coalesce(undefined, undefined, 2)).to.equal(2);
        });
        it('should accept null as a defined value', () => {
            expect(coalesce(undefined, null, 2)).to.be.null;
        });
        it('should accept empty string as a defined value', () => {
            expect(coalesce(undefined, '', 'foo')).to.equal('');
        });
        it('should accept zero as a defined value', () => {
            expect(coalesce(undefined, 0, 2)).to.equal(0);
        });
        it('should accept a negative number as a defined value', () => {
            expect(coalesce(undefined, -1, 2)).to.equal(-1);
        });
        it('should accept a function as a defined value', () => {
            let func = () => {};
            expect(coalesce(undefined, func, 2)).to.equal(func);
        });
        it('should accept false as a defined value', () => {
            let func = () => {};
            expect(coalesce(undefined, false, true)).to.equal(false);
        });
        it('should accept true as a defined value', () => {
            let func = () => {};
            expect(coalesce(undefined, true, false)).to.equal(true);
        });
    })
})