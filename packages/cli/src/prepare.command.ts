import { BuildConfig } from './build-config';
import { CommandRunner } from './command-runner';
import { PackageConfiguration } from './package-configuration';
import { getWorkingDirectory, pathCombine, readJsonFile } from './utils';

export class PrepareCommand {
    constructor() {
    }

    runner = new CommandRunner();

    async run(args : string[]) {

        if (process.env['ALT_NESTED']) {
            console.log(`alt prepare: Skipping recursive invocation`);
            return 0;
        }

        // if (process.env.npm_config_argv) {
        //     let npmArgv = JSON.parse(process.env.npm_config_argv);
        //     if (npmArgv.cooked && npmArgv.cooked.includes('--dry-run')) {
        //         console.log(`alt prepare: Skipping for dry-run.`);
        //         return;
        //     }
        // }

        if (args.length !== 0) {
            console.error(`usage: alt prepare`);
            console.error(`** Extra arguments were passed (none expected)`);
            return 1;
        }

        // @ts-ignore unused
        let buildConfig = await readJsonFile<BuildConfig>(pathCombine(getWorkingDirectory(), 'alterior.json'));
        let pkgJson = await readJsonFile(pathCombine(getWorkingDirectory(), 'package.json'));
        let currentAccess = pkgJson.publishConfig?.access;

        if (!currentAccess) {
            if (pkgJson.name.startsWith('@'))
                currentAccess = 'private';
            else
                currentAccess = 'public';
        }

        // let commandRunner = new CommandRunner();
        // process.env['ALT_NESTED'] = '1';
        // await commandRunner.run(`npm`, `publish`, `--dry-run`);
        // process.env['ALT_NESTED'] = '0';
        // console.log(`The above is a DRY RUN of publishing your package.`);

        // for (let key of Object.keys(process.env)) {
        //     console.log(` ** ${key}=${process.env[key]}`);
        // }
            
        // Make sure we've excluded the backend via .npmignore if necessary

        let pkgConfig = new PackageConfiguration(getWorkingDirectory());
        await pkgConfig.setPublishBackend(false);

    }
}