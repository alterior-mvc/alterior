import { Command, CommandLine } from '@alterior/command-line';
import { dirExists, fileExists, pathCombine, readJsonFile, writeJsonFile } from '@alterior/functions';
import { CLITask, CLITaskList, style, styled } from '@alterior/terminal';
import { ReleaseType, SemVer } from 'semver';
import { listDirectory, makeDirectory, runAndCapture, runAndCaptureLines, runShellCommand } from './utils';

import git from 'simple-git';

const PKG = require('../package.json');

async function main(args: string[]) {
    new CommandLine()
        .info({
            executable: 'alt-build',
            description: 'Build Alterior projects',
            copyright: 'Copyright 2025 The Alterior Project',
            version: PKG.version
        })
        .command('version', cmd => {
            cmd .info({
                    description: 'Bump the version of the entire mono-repo',
                    argumentUsage: '<major|minor|patch>'
                })
                .option({
                    id: 'skip-tag',
                    description: 'Do not make a Git tag'
                })
                .option({
                    id: 'skip-commit',
                    description: 'Do not make a Git commit (implies --skip-tag)'
                })
                .run(async ([ releaseType ]) => {
                    await validateProject(cmd);

                    let projectRoot = process.cwd();
                    let rootManifestFile = pathCombine(projectRoot, 'package.json');
                    let rootManifest = await readJsonFile(rootManifestFile);
                    let oldVersion = rootManifest.version;
                    let newVersion = new SemVer(oldVersion)
                        .inc(releaseType as ReleaseType).toString();

                    console.log(`${oldVersion} -> ${newVersion}`);

                    let files: string[] = [rootManifestFile];

                    rootManifest.version = newVersion;
                    await writeJsonFile(rootManifestFile, rootManifest);

                    let packages = await findPackages(projectRoot);
                    for (let pkg of packages) {
                        pkg.manifest.version = newVersion;

                        for (let dependencies of ['dependencies', 'devDependencies', 'peerDependencies']) {
                            if (pkg.manifest[dependencies]) {
                                for (let otherPkg of packages) {
                                    if (otherPkg === pkg)
                                        continue;
                                    if (pkg.manifest[dependencies][otherPkg.name]) {
                                        pkg.manifest[dependencies][otherPkg.name] = `^${newVersion}`;
                                    }
                                }
                            } 
                        }
                        
                        await writeJsonFile(pathCombine(pkg.folder, 'package.json'), pkg.manifest);
                        files.push(pathCombine(pkg.folder, 'package.json'));
                    }

                    // Commit and tag

                    if (!cmd.option('skip-commit').present) {
                        await git(projectRoot).commit(`v${newVersion}`, files);
                        if (!cmd.option('skip-tag').present)
                            await git(projectRoot).addTag(`v${newVersion}`);
                    }
                })
            ;
        })
        .command('run', async cmd => {
            cmd.run(async ([arg]) => {
                await validateProject(cmd);
                await runInAll(arg);
            })
        })
        .command('build', async cmd => {
            cmd.run(async ([]) => {
                await validateProject(cmd);

                let taskList = new CLITaskList();
                try {
                    await runInAll('build', taskList.startTask(`Build`));
                } finally {
                    taskList.stop();
                }
            })
        })
        .command('publish', async cmd => {
            cmd .info({
                    description: `Publish the current package version(s) to NPM`
                })
                .option({
                    id: 'skip-already-published-check',
                    description: 'Skip checking if the packages are already published'
                })
                .option({
                    id: 'skip-prepublish',
                    description: 'Skip prepublish tasks'
                })
                .option({
                    id: 'skip-login',
                    description: 'Skip logging in prior to publish'
                })
                .option({
                    id: 'dry-run',
                    description: 'Do not actually publish'
                })
                .run(async () => {
                    await validateProject(cmd);

                    let taskList = new CLITaskList();

                    try {
                        let prepTask = taskList.startTask('Preparation');

                        let packages = await findPackages();

                        // Make sure all the packages are publishable
                        
                        if (!cmd.option('skip-already-published-check').present) {
                            let alreadyPublished = 0;
                            let precheck = prepTask.subtask(`Ensure packages are not already published...`);
                            for (let pkg of packages) {
                                try {
                                    let listing = await getPackageFromRepository(pkg.name, `${pkg.manifest.version}`);

                                    if (alreadyPublished === 0) 
                                        precheck.log(`Cannot proceed, the following packages already exist in the NPM registry:`);
                                    ++alreadyPublished;
                                    precheck.log(` - ${pkg.name}@${pkg.manifest.version}`);
                                } catch (e) {
                                    continue;
                                }
                            }
                            if (alreadyPublished > 0) {
                                precheck.error(`Some packages are already published.`);
                                prepTask.error();
                                return;
                            } else {
                                precheck.finish();
                            }
                        }

                        if (!cmd.option('skip-prepublish').present) {
                            let prepublishTask = prepTask.subtask(`Prepublish tasks`);
                            try {
                                await runInAll('prepublishOnly', prepublishTask);
                                prepublishTask.finish();
                            } catch (e) {
                                prepublishTask.error(e.message);
                                return;
                            }
                        }

                        let projectRoot = process.cwd();
                        let tmpDir = pathCombine(projectRoot, 'tmp');
                        let packTask = prepTask.subtask(`Packing`);
                        try {
                            await makeDirectory(tmpDir);

                            await runAndCaptureLines(
                                `npm pack --pack-destination "${tmpDir}" ${packages.map(x => `"${x.folder}"`).join(' ')}`, 
                                (line, error) => {
                                    if (/^npm notice\b/.test(line))
                                        return;
                                    if (line.endsWith('.tgz'))
                                        return;
                                    logToTask(packTask, line, false)
                                }
                            );
                            packTask.finish();
                        } catch (e) {
                            packTask.error(e.message);
                            return;
                        }

                        prepTask.finish();
                        taskList.stop();

                        if (!cmd.option('skip-login').present)
                            await runShellCommand(`npm login`);

                        await visitInDependencyOrder(async pkg => {
                            try {
                                let tarballFile = pathCombine(
                                    tmpDir, 
                                    `${pkg.name.replace(/^@/, '').replace(/\//g, '-')}-${pkg.manifest.version}.tgz`
                                );

                                let publishCommand = `npm publish "${tarballFile}"`;
                                if (cmd.option('dry-run').present) {
                                    console.log(`Would run: ${publishCommand}`);
                                } else {
                                    await runShellCommand(publishCommand);
                                }
                            } catch (e) {
                                console.log(`Failed to publish ${pkg}: ${e.stack}`);
                                return false;
                            }
                        });
                    } finally {
                        taskList.stop();
                    }
                });
        })
        .process();
    ;
}

export interface Package {
    name: string;
    folder: string;
    manifest: any;
}

async function getPackageFromRepository(name: string, version?: string) {
    let result = await runAndCapture(`npm view ${version ? `${name}@${version}` : name} --json`);
    let data = JSON.parse(result.stdout);
    if (data.error)
        throw new Error(`[${data.error.code}] ${data.error.summary}`);
    return data;
}

async function validateProject(cmd: Command) {
    let projectRoot = process.cwd();
    let rootManifestFile = pathCombine(projectRoot, 'package.json');

    if (!await fileExists(rootManifestFile)) {
        console.log(`Error: Current directory must be root of the mono-repo.`);
        cmd.showHelp();
        return;
    }
}

async function runInAll(command: string, task?: CLITask) {
    await visitInDependencyOrder(async unit => {
        let subtask = task?.subtask(unit.name);
        if (unit.manifest.scripts[command]) {
            if (subtask) {
                try {
                    let exitCode = await runAndCaptureLines(
                        `npm run ${command}`, 
                        (line, error) => logToTask(subtask, line, error), 
                        unit.folder
                    );

                    if (exitCode !== 0)
                        throw new Error(`${unit.name}: Failed to run '${command}'`);
                    
                    subtask?.finish();
                } catch(e) {
                    subtask?.error(e.message);
                    throw e;
                }
            } else {
                runShellCommand(`npm run ${command}`, undefined, unit.folder);
            }
        }
    });
}

async function visitInDependencyOrder(visitor: (unit: Package) => Promise<boolean|void>) {
    let units = await findPackages();
    let visited: Package[] = [];
    for (let unit of units) {
        let result = await visitPackageInDependencyOrder(unit, visitor, units, visited);
        if (result === false)
            return false;
    }
}

async function visitInReverseDependencyOrder(visitor: (unit: Package) => Promise<boolean>) {
    let units: Package[] = [];
    await visitInDependencyOrder(async unit => (units.push(unit), true));
    units.reverse();
    for (let unit of units) {
        if (await visitor(unit) === false)
            break;
    }
}

async function visitDependents(dependency: Package, visitor: (unit: Package) => Promise<boolean>) {
    let units = await findPackages();

    for (let dependent of units) {
        if (dependent.name === dependency.name)
            continue;
        
        if (dependent.manifest.dependencies?.[dependency.name]) {
            let result = await visitor(dependent);
            if (result === false)
                return;
        }
    }
}

async function visitPackageInDependencyOrder(
    pkg: Package, 
    visitor: (pkg: Package) => Promise<boolean|void>, 
    packages: Package[], 
    visited: Package[] = [],
    depth = 0
) {
    if (visited.includes(pkg))
        return;
    visited.push(pkg);

    //console.log(`${fill(depth, () => `-- `).join('')} ${pkg.name}`);
    
    for (let depName of Object.keys(pkg.manifest.dependencies || {})) {
        let dep = packages.find(x => x.name === depName);
        if (!dep)
            continue;

        let result = await visitPackageInDependencyOrder(dep, visitor, packages, visited, depth + 1);
        if (result === false)
            return false;
    }

    if ((await visitor(pkg)) === false)
        return false;
}

async function findPackages(projectRoot: string = process.cwd(), includePrivate = false) {
    let packages: Package[] = [];
    for (let folder of await listDirectory(pathCombine(projectRoot, 'packages'))) {
        let folderPath = pathCombine(projectRoot, 'packages', folder);
        if (!await dirExists(folderPath))
            continue;

        let manifestFile = pathCombine(folderPath, 'package.json');
        if (!await fileExists(manifestFile))
            continue;

        let manifest = await readJsonFile(manifestFile);

        if (!includePrivate && manifest.private)
            continue;

        if (!manifest.name)
            continue;

        packages.push({ name: manifest.name, folder: folderPath, manifest });
    }
    return packages;
}

function logToTask(task: CLITask, line: string, error: boolean) {
    if (error)
        task.log(styled(style.$red(line)));
    else
        task.log(line);
}

main(process.argv.slice(1));