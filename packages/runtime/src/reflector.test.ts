import { describe } from "razmin";
import { Reflector, Type } from "./reflector";
import { expect } from "chai";

describe('Reflector', it => {
    let reflector = new Reflector();

    it('finds methods', () => {
        class A {
            foo() {}
            bar() {}
        }

        let type = reflector.getTypeFromClass(A);
        expect(type.methodNames).to.eql(['constructor', 'foo', 'bar']);
    });
    it('finds fields when initialized from an instance', () => {
        class A {
            foo = 123;
            bar = 123;
        }

        let type = reflector.getTypeFromInstance(new A());
        expect(type.fieldNames).to.eql(['foo', 'bar']);
    });
});