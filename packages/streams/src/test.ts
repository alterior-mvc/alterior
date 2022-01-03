import 'source-map-support/register';
import wptRunner from 'wpt-runner';
import { installer } from './installer';

async function main() {
    installer();

    let set = `wpt/streams`;
    let results = await wptRunner(set, { 
        setup: window => {
            installer(window)
            window.TypeError = TypeError;
            window.RangeError = RangeError;
            window.Promise = Promise;
        },
        filter: (testPath : string, testURL : string) => 
            testPath.includes('close-propagation-backward.any.html') && !testPath.includes('async-iterator')
    });

    console.log(`Finished tests: ${results} failures`);
}

main();