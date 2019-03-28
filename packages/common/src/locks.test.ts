import { suite } from "razmin";
import { Lock, ZoneLock } from "./locks";
import { timeout } from "./timeout";
import { expect } from 'chai';

suite(describe => {
    describe('Lock', it => {
        it('runs instances independently', async () => {
            for (let test = 0, maxTest = 3; test < maxTest; ++test) {
                let lock = new Lock();
                let result = '';
                let runs = [];
                for (let i = 0, max = 5; i < max; ++i) {
                    runs.push(lock.run(async () => {
                        result += `${i}`;
                        await timeout(Math.random() * 4);
                        result += `${i}` 
                    }));
                }

                await Promise.all(runs);
                expect(result).to.equal('0011223344');
            }
        });
    });

    describe('ZoneLock', it => {
        it('runs instances independently regardless of promise passing', async () => {

            // CONTRA-TEST

            let lock = new Lock();
            let result = '';
            let runs = [];
            for (let i = 0, max = 5; i < max; ++i) {
                runs.push(lock.run(async () => {
                    result += `${i}`;
                    setTimeout(() => result += `${i}`, Math.random() * 4);
                }));
            }

            await Promise.all(runs);
            expect(result).not.to.equal('0011223344');
            
            // TEST

            for (let test = 0, maxTest = 3; test < maxTest; ++test) {
                let lock = new ZoneLock();
                let result = '';
                let runs = [];
                for (let i = 0, max = 5; i < max; ++i) {
                    runs.push(lock.run(async () => {
                        result += `${i}`;
                        setTimeout(() => result += `${i}`, Math.random() * 4);
                    }));
                }

                await Promise.all(runs);
                expect(result).to.equal('0011223344');
            }
        });
    });
});