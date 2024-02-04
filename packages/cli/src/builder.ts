import { ANNOTATIONS_KEY, CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY, METHOD_PARAMETER_ANNOTATIONS_KEY, PROPERTY_ANNOTATIONS_KEY } from "@alterior/annotations";
import { ApplicationError, getParameterNames } from "@alterior/common";
import { ExposureReflector } from "@alterior/runtime";
import rttiTransformer from 'typescript-rtti/dist/transformer';
import { CommandRunner } from "./command-runner";
import {
    changeWorkingDirectory,
    fileExists,
    getWorkingDirectory,
    isConstructor,
    makeDirectory, pathCombine,
    pathResolve,
    readJsonFile,
    removeAll,
    unindent,
    writeTextFile
} from "./utils";

import * as ts from 'typescript';

export class BuildError extends ApplicationError {

}

export class BackendBuilder {
    constructor(
        readonly projectDir : string
    ) {
        this.commandRunner = new CommandRunner();
        this.commandRunner.silent = true;
    }

    private commandRunner : CommandRunner;
    private enableCustomTSC = true;
    async build() {
        if (this.enableCustomTSC) {
            let tsConfigFile = pathResolve('.', "tsconfig.json");
            let config = await readJsonFile(tsConfigFile);

            let createProgram : ts.CreateProgram<ts.EmitAndSemanticDiagnosticsBuilderProgram>;
            
            createProgram = (
                rootNames: readonly string[] | undefined, 
                options?: ts.CompilerOptions, 
                host?: ts.CompilerHost, 
                oldProgram?: ts.EmitAndSemanticDiagnosticsBuilderProgram, 
                configFileParsingDiagnostics?: readonly ts.Diagnostic[], 
                projectReferences?: readonly ts.ProjectReference[] | undefined
            ) => {
                let program = ts.createEmitAndSemanticDiagnosticsBuilderProgram(
                    rootNames, options, host, oldProgram, configFileParsingDiagnostics, projectReferences
                );

                let origEmit = program.emit;

                program.emit = (
                    targetSourceFile?: ts.SourceFile, 
                    writeFile?: ts.WriteFileCallback, 
                    cancellationToken?: ts.CancellationToken, 
                    emitOnlyDtsFiles?: boolean, 
                    customTransformers?: ts.CustomTransformers
                ) => {
                    if (!customTransformers)
                        customTransformers = {};

                    if (!customTransformers.before)
                        customTransformers.before = [];

                    customTransformers.before.push(rttiTransformer(program.getProgram()));
                    
                    return origEmit.apply(program, [
                        targetSourceFile,
                        writeFile,
                        cancellationToken,
                        emitOnlyDtsFiles,
                        customTransformers
                    ])
                };

                return program;
            };

            let host = ts.createSolutionBuilderHost(undefined, createProgram);

            let builder = ts.createSolutionBuilder(host, [ tsConfigFile ], {

            });


            const exitStatus = builder.build();

            if (exitStatus !== ts.ExitStatus.Success) {
                console.error(`Failed to build project: ${exitStatus}`);
                throw new BuildError(`Failed to build project: ${exitStatus}`);
            }
        } else {
            await this.commandRunner.run(`tsc`, `--incremental`);
        }
    }
}

export class Builder {
    constructor(
        readonly projectDir : string
    ) {
        this.backendBuilder = new BackendBuilder(projectDir);
    }

    private backendBuilder : BackendBuilder;
    
    async build() {
        await this.backendBuilder.build();
    }
}