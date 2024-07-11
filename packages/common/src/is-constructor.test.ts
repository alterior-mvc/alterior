import { suite } from "razmin";
import { isClass, isConstructor } from "./is-constructor";
import { expect } from "chai";

suite(describe => {
    describe('isConstructor()', it => {
        it('works as expected', () => {
            expect(isConstructor(function () { })).to.be.true;
            expect(isConstructor(() => {})).to.be.false;
            expect(isConstructor(<any>123)).to.be.false;
            expect(isConstructor(Symbol)).to.be.false;
            expect(isConstructor(class A { })).to.be.true;
        });
    });
    describe('isClass()', it => {
        it('works as expected', () => {
            expect(isClass(class A { })).to.be.true;
            expect(isClass(function () { })).to.be.false;
            expect(isClass(() => {})).to.be.false;
            expect(isClass(<any>123)).to.be.false;
            expect(isClass(Symbol)).to.be.false;
        });
    });
});