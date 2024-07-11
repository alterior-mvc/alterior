import { Base64 } from "./base64";
import { expect } from "chai";
import { describe } from "razmin";

describe('Base64', () => {
    describe('.encode()', it => {
        it('encodes ASCII as expected', () => {
            expect(Base64.encode('A')).to.equal('QQ==');
            expect(Base64.encode('hello world')).to.equal('aGVsbG8gd29ybGQ=');
            expect(Base64.encode('hello world!')).to.equal('aGVsbG8gd29ybGQh');
            expect(Base64.encode('hello 123 $ _ / @ -')).to.equal('aGVsbG8gMTIzICQgXyAvIEAgLQ==');
        });
        it('encodes UTF-8 as expected', () => {
            expect(Base64.encode('🚀')).to.equal('8J+agA==');
        })
    })
    describe('.decode()', it => {
        it('decodes ASCII as expected', () => {
            expect(Base64.decode('aGVsbG8gd29ybGQ=')).to.equal('hello world');
            expect(Base64.decode('aGVsbG8gd29ybGQ')).to.equal('hello world');
            expect(Base64.decode('aGVsbG8gMTIzICQgXyAvIEAgLQ==')).to.equal('hello 123 $ _ / @ -');
            expect(Base64.decode('aGVsbG8gMTIzICQgXyAvIEAgLQ')).to.equal('hello 123 $ _ / @ -');
        });
        it('decodes UTF-8 as expected', () => {
            expect(Base64.decode('8J+agA==')).to.equal('🚀');
            expect(Base64.decode('8J+agA')).to.equal('🚀');
        })
        it('roundtrips UTF-8 as expected', () => {
            expect(Base64.decode(Base64.encode('😀'))).to.equal('😀');
        })
    })
})