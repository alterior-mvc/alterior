import { suite } from 'razmin';
import { inspect } from './inspect';
import { expect } from 'chai';

suite(describe => {
    describe('inspect', it => {
        it('directly stringifies numbers', () => expect(inspect(123)).to.equal('123'));
        it('quotes strings', () => expect(inspect('hello')).to.equal("'hello'"));
        it('knows false', () => expect(inspect(false)).to.equal("false"));
        it('knows true', () => expect(inspect(true)).to.equal("true"));
        it('knows null', () => expect(inspect(null)).to.equal("null"));
        it('knows undefined', () => expect(inspect(undefined)).to.equal("undefined"));
        it('digs into objects', () => expect(inspect({ abc: 123 })).to.equal("{ abc: 123 }"));
        it('presents functions', () => expect(inspect(() => 123)).to.equal("[Function]"));

        function namedTest() {}
        it('presents named functions', () => expect(inspect(namedTest)).to.equal("[Function: namedTest]"));
    });
});