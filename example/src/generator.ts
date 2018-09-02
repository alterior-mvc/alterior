import { generateClient, bootstrap } from '../../dist';
import { Application } from './application';
import * as path from 'path';

!async function main() {
    generateClient(await bootstrap(Application, [], {
        autostart: false
    }), path.join(__dirname, 'generated'));
}();
