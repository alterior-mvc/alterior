import { Cache } from './cache';
import { describe } from 'razmin';
import { expect } from 'chai';

describe('Cache', () => {
    describe('.get()', it => {
        it('returns an item', () => {
            let cache = new Cache<string>(1000, 1000);
            cache.insertItem('foo', 'bar');
            expect(cache.get('foo')).to.equal('bar')
        });
    });
    describe('.fetch()', it => {
        it('uses the default TTL when unspecified', async () => {
            let cache = new Cache<string>(1234, 1000);
            await cache.fetch('foo', async () => 'bar');
            let entry = cache.getEntry('foo');
            expect(entry.expiresAt - entry.time).to.equal(1234);
        });
        it('uses the override TTL when specified', async () => {
            let cache = new Cache<string>(1234, 1000);
            await cache.fetch('foo', async () => 'bar', { timeToLive: 123 });
            let entry = cache.getEntry('foo');
            expect(entry.expiresAt - entry.time).to.equal(123);
        });
        it('caches a value correctly', async () => {
            let cache = new Cache<string>(1000, 1000);
            let value1 = await cache.fetch('foo', async () => 'bar', { timeToLive: 1000 });
            let value2 = await cache.fetch('foo', async () => 'baz');
            
            expect(value1).to.equal('bar');
            expect(value2).to.equal('bar');
        });
        it('caches null correctly', async () => {
            let cache = new Cache<string | null>(1000, 1000);
            let value1 = await cache.fetch('foo', async () => null, { timeToLive: 1000 });
            let value2 = await cache.fetch('foo', async () => 'bar');
            
            expect(value1).to.be.null;
            expect(value2).to.be.null;
        });
        it('caches undefined correctly', async () => {
            let cache = new Cache<string | undefined>(1000, 1000);
            let value1 = await cache.fetch('foo', async () => undefined, { timeToLive: 1000 });
            let value2 = await cache.fetch('foo', async () => 'bar');
            
            expect(value1).to.be.undefined;
            expect(value2).to.equal('bar');
        });
    });
});