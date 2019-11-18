import * as child_process from 'child_process';
import * as path from 'path';
import * as fetch from 'node-fetch';
import { timeout } from '@alterior/common';

export interface TestResults {
    responseTimes : number[];
    minimumTime : number;
    maximumTime : number;
    averageTime : number;
    totalTime : number;
    totalCount : number;
    averageRequestsPerSecond : number;
}

export interface TestSettings {
    concurrency : number;
    total : number;
}

export class PerfComparison {
    private async doTestCall(url : string) {
        let startedAt = Date.now();
        let value = {
            super: 'cool'
        };

        let response = await fetch(url, { 
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value: { super: 'cool' } })
        });
        
        let data = await response.json();

        if (JSON.stringify(value) !== JSON.stringify(data.saw)) {
            throw new Error(`Bad response did not match request. Received ${JSON.stringify(data.saw)}`);
        }

        return Date.now() - startedAt;
    }

    async testBackend(name : string, settings : TestSettings): Promise<TestResults> {
        let serverFile = path.join(__dirname, `server.${name}.js`)

        //console.log(`Starting system under test (${name})...`);
        let proc = child_process.exec(`node "${serverFile}"`);
        let url = `http://localhost:3000/`;
        let results = [];
        let startedAt : number;
        let endedAt : number;

        try {
            await timeout(2000);

            startedAt = Date.now();
            //console.log(`Starting test (${name})...`);

            for (let i = 0, max = settings.total; i < max; ++i) {
                let promises = [];

                for (let j = 0, maxJ = settings.concurrency; j < maxJ; ++j) {
                    promises.push(this.doTestCall(url));
                }
     
                results.push(...await Promise.all(promises));

                // if (i > 0 && i % 1000 === 0)
                //     console.log(`Finished 100 requests ${i - 1000} - ${i}...`);
            }
            endedAt = Date.now();
        } finally {
            console.log('Killing the process...');
            try {
                await fetch(`http://localhost:3000/exit`, { method: 'POST' });
            } catch (e) {
                // ECONNRESET is normal
            }
        }

        //console.log(`Completed ${settings.total} requests.`);

        return {
            responseTimes: results,
            minimumTime: results.reduce((pv, cv) => pv < cv ? pv : cv, Infinity),
            maximumTime: results.reduce((pv, cv) => pv > cv ? pv : cv, 0),
            averageTime: results.reduce((pv, cv) => pv + cv, 0) / results.length,
            totalTime: endedAt - startedAt,
            totalCount: settings.total,
            averageRequestsPerSecond: settings.total / (endedAt - startedAt) * 1000
        }
    }
}

async function runTest(name, discard = false) {
    let comp = new PerfComparison();
    let results = await comp.testBackend(name, {
        concurrency: 1,
        total: 5_000
    });

    delete results.responseTimes;

    if (!discard) {
        console.dir(`Results for ${name}:`)
        console.dir(results);
    }
}

async function main() {
    await runTest('express', true);
    await runTest('altweb', true);
    await runTest('express');
    await runTest('altweb');
}
main();