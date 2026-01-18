#!/usr/bin/env node

import { CommandLine } from '@alterior/command-line';
import { pathCombine, readJsonFile, writeJsonFile } from '@alterior/functions';
import { CLITaskList } from '@alterior/terminal';
import { ReleaseType, SemVer } from 'semver';
import { makeDirectory, runAndCaptureLines, runShellCommand } from './utils';

import git from 'simple-git';
import { findPackages, getPackageFromRepository, logToTask, runInAll, validateProject, visitInDependencyOrder } from './build-core';

const PKG = require('../package.json');

async function main(args: string[]) {
    let cmd = new CommandLine()

    cmd
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
            cmd.option({
                id: 'parallel',
                description: `Run the tasks in parallel (ignoring dependency order)`
            })
            cmd.run(async ([arg]) => {
                await validateProject(cmd);
                let taskList = new CLITaskList();
                try {
                    await runInAll(arg, taskList.startTask(`Run: ${arg}`), cmd.option('parallel').present);
                } finally {
                    taskList.stop();
                }
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
        .command('test', async cmd => {
            cmd.run(async ([]) => {
                await validateProject(cmd);

                let taskList = new CLITaskList();
                try {
                    await runInAll('test', taskList.startTask(`Test`));
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
        .run(async ([]) => {
            await validateProject(cmd);

            let taskList = new CLITaskList();
            try {
                await runInAll('build', taskList.startTask(`Build`));
            } finally {
                taskList.stop();
            }
        })
        .process();
    ;
}

main(process.argv.slice(1));