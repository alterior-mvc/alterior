import { expect } from "chai";
import { deepClone } from "./clone";
import { describe } from "razmin";

describe('deepClone', it => {

    function assertEquality(items : Record<string,any>) {
        for (let key of Object.keys(items))
            it(`can clone ${key}`, () => expect(deepClone(items[key])).to.equal(items[key]));
    }

    function assertCustom(items : Record<string, [any, (v : any) => boolean]>) {
        for (let [ key, [ value, checker ] ] of Object.entries(items))
            it(`can clone ${key}`, () => expect(checker(deepClone(value))).to.be.true);
    }

    assertEquality({
        strings: 'foo',
        numbers: 123,
        true: true,
        false: false,
        null: null,
        undefined: undefined,
        Infinity: Infinity,
        '0': 0
    });

    assertCustom({
        NaN: [NaN, v => isNaN(v)]
    });
});