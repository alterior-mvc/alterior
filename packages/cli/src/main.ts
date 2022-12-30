#!/usr/bin/env node

import 'zone.js';
import 'reflect-metadata';
import 'source-map-support/register';

import { CommandLine } from "@alterior/command-line";
import { NewCommand } from './new.command';
import { BuildCommand } from './build.command';
import { PrepareCommand } from './prepare.command';
import { LintCommand } from './lint.command';

const PKG = require('../package.json');

let line = new CommandLine()
    .info({
        executable: 'alt',
        description: 'Create and manage Alterior projects',
        copyright: 'Copyright 2021-2022 The Alterior Project',
        version: PKG.version
    })
    .command('new', cmd => {
        cmd .info({
                description: 'Create a new project',
                argumentUsage: '[service|library] <folder>'
            })
            .run(async args => await new NewCommand().run(args))
        ;
    })
    .command('lint', cmd => {
        cmd .info({
                description: 'Check a project for problems',
                argumentUsage: ''
            })
            .run(async args => await new LintCommand().run(args))
        ;
    })
    .command('build', cmd => {
        cmd.info({
            description: 'Build a project',
            argumentUsage: '[<folder>]'
        })
        .run(async args => await new BuildCommand().run(args))
    })
    .command('prepare', cmd => {
        cmd.info({
            description: 'Prepare a project for publishing to NPM',
            argumentUsage: ''
        })
        .run(async args => await new PrepareCommand().run(args))
    })
    .run(args => line.showHelp())
;

line.process();
