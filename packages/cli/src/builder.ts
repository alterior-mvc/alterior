import { isConstructor, getWorkingDirectory, changeWorkingDirectory, makeDirectory, pathCombine, unindent, 
    writeTextFile, fileExists, removeAll, isPropertyPrivate, pathResolve } from "./utils";
import { ServiceAnnotation, ExposureReflector, ServiceCompiler, MethodShim } from "@alterior/runtime";
import { ApplicationError, getParameterNames } from "@alterior/common";
import { CommandRunner } from "./command-runner";
import { ANNOTATIONS_KEY, CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY, PROPERTY_ANNOTATIONS_KEY, METHOD_PARAMETER_ANNOTATIONS_KEY } from "@alterior/annotations";
import * as ts from 'typescript';
import { readJsonFile } from "./utils";
import rttiTransformer from 'typescript-rtti/dist/transformer';

export class BuildError extends ApplicationError {

}

export class ClientBuilder {
    constructor(
        private projectDir : string
    ) {
        this.outDir = pathCombine(this.projectDir, 'src', '__browser');
    }

    private outDir : string;
    private exports : any;

    private typeToRef(type : Object): string {
        if (type === true)
            return 'true';
        if (type === false)
            return 'false';
        if (type === undefined)
            return 'unknown';
        if (type === null)
            return 'null';
        
        if (type === String || type === 'String')
            return 'string';
        if (type === Number || type === 'Number')
            return 'number';
        if (type === Boolean || type === 'Boolean')
            return 'boolean';
        
        if (typeof type === 'string') {
            if (type.startsWith('class ') || type.startsWith('async function ') || type.startsWith('function ') || type.startsWith('('))
                return type;
            return JSON.stringify(type);
        }
        
        if (typeof type === 'function' && type.name)
            return type.name;
          
        return type.toString();
    }

    private async loadExports() {
        let indexFilenameJS = pathCombine(this.projectDir, 'dist', 'index.js');
        let absoluteIndexJS = pathResolve(getWorkingDirectory(), indexFilenameJS);
        try {
            this.exports = require(absoluteIndexJS);
        } catch (e) {
            console.error(`Failed to import backend from ${indexFilenameJS}:`);
            console.error(e);
            throw new Error(`Failed to compile client`);
        }
    }

    private async precheckExports() {
        for (let exportName in this.exports) {
            let exportObj = this.exports[exportName];
            if (typeof exportObj === 'function') {
                if (isConstructor(exportObj)) {
                    let serviceAnnot = ServiceAnnotation.getForClass(exportObj);

                    if (!serviceAnnot) {
                        throw new BuildError(
                            `The export ${exportName} is a class (named ${exportObj.name}) which is not annotated with @Service. ` 
                            + `All classes exported from your package must be ` 
                            + `intentionally exposed to the frontend by marking them with @Service.`
                        );
                    }

                    // Check static properties 

                    let staticPropertyNames = Object.getOwnPropertyNames(exportObj)
                        .filter(x => 
                            ![
                                'length', 'prototype', 'name',
                                ANNOTATIONS_KEY,
                                CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY,
                                PROPERTY_ANNOTATIONS_KEY,
                                METHOD_PARAMETER_ANNOTATIONS_KEY
                            ].includes(x)
                            && !x.startsWith('__')
                            && !x.startsWith('$$')
                        );
                    if (staticPropertyNames.length > 0) {
                        throw new BuildError(
                            `class ${exportName}: Classes marked with @Service are not allowed to have ` 
                            + `static properties/methods. Found the following static properties: ${staticPropertyNames.join(', ')}`
                        );
                    }

                    // Check exposures 

                    let exposureReflector = new ExposureReflector(exportObj);
                    let exposures = exposureReflector.exposures;
                    let prototype = exportObj.prototype;
                    for (let exposure of exposures) {
                        let element = prototype[exposure.propertyName];

                        if (!element) {
                            throw new Error(
                                `${exportName}#${exposure.propertyName} cannot be found [this is probably a bug]`
                            );
                        }

                        if (typeof element === 'function') {
                            let returnType = Reflect.getMetadata('design:returntype', prototype, exposure.propertyName);

                            if (returnType !== Promise) {

                                if (returnType) {
                                    throw new BuildError(
                                        `${exportName}#${exposure.propertyName}: Must be async, or return Promise<${this.typeToRef(returnType)}>`
                                    );
                                } else {
                                    throw new BuildError(
                                        `${exportName}#${exposure.propertyName}: Must be async or return Promise`
                                    );
                                }
                            }
                        }
                    }

                    
                    // for (let key of Object.getOwnPropertyNames(prototype)) {
                    //     if (key === 'constructor')
                    //         continue;

                    //     let exposure = exposures.find(x => x.propertyName === key);
                    //     let isPrivate = isPropertyPrivate(prototype, key);

                    //     console.info(`${exportName}#${key}: exposure=${exposure ? 'yes' : 'no'}, private=${isPrivate ? 'yes' : 'no'}`);
                    //     if (isPrivate && exposure) {
                    //         throw new BuildError(
                    //             `${exportName}#${key}: Private properties cannot be exposed.`
                    //         );
                    //     }
                        
                    //     if (!isPrivate && !exposure) {
                    //         throw new BuildError(
                    //             `${exportName}#${key}: Transparent services are not allowed to have unexposed public properties.` 
                    //         );
                    //     }
                    // }
                } else {
                    throw new BuildError(
                        `Your package exports a bare function ${exportName}(). ` 
                        + `Alterior packages must only export classes marked with @Service.`);
                }
            }
        }
    }

    private async postbuild() {
        let workingDir = getWorkingDirectory();
        changeWorkingDirectory(this.projectDir);
        
        let runner = new CommandRunner();
        runner.silent = true;
        await runner.run('tsc', '--incremental');
        changeWorkingDirectory(workingDir);
    }

    private async prebuild() {
        let workingDir = getWorkingDirectory();
        changeWorkingDirectory(this.projectDir);

        let runner = new CommandRunner();
        await runner.run('npm', 'run', 'build');
        changeWorkingDirectory(workingDir);
    }

    private async compile(): Promise<void> {
        await makeDirectory(this.outDir);

        for (let exportedServiceName in this.exports) {
            let exportObj = this.exports[exportedServiceName];

            if (!exportObj) {
                throw new BuildError(`Export ${exportedServiceName} is undefined`);
            }

            let serviceAnnot = ServiceAnnotation.getForClass(exportObj);
            if (!serviceAnnot) 
                throw new BuildError(`Failed to locate service annotation for exported @Service class ${exportObj.name}`);

            if (!serviceAnnot.compiler) {
                console.warn(`Warning: @Service() class ${exportedServiceName} does not specify a service compiler! Skipping!`);
                continue;
            }

            let outFile = pathCombine(this.outDir, `${exportedServiceName}.ts`);
            //console.log(`[${serviceAnnot.compiler?.name}] ${exportedServiceName} -> ${outFile}`);

            let compiler : ServiceCompiler = Reflect.construct(serviceAnnot.compiler, []); // TODO: DI
            let declarations : string[] = [];
            let exposureReflector = new ExposureReflector(exportObj);
            let prototype = exportObj.prototype;

            for (let exposure of exposureReflector.exposures) {
                let element = prototype[exposure.propertyName];
                if (!element) {
                    console.warn(`Warning: Failed to locate ${exportedServiceName}#${exposure.propertyName}! Skipping`);
                    continue;
                }

                if (typeof element === 'function') {
                    // This is a method

                    let paramNames : string[] = getParameterNames(element);
                    let paramTypes = Reflect.getMetadata('design:paramtypes', prototype, exposure.propertyName)

                    let params = paramNames.map((name, i) => ({
                        name,
                        type: paramTypes[i]
                    }));

                    params.forEach(param => param.name = `Φ${param.name}`);

                    let method : MethodShim = {
                        name: exposure.propertyName,
                        body: `
                            // Not Implemented [MethodShim]
                        `,
                        params,
                        target: exportObj
                    }

                    try {
                        await compiler.compileMethod(method);
                    } catch (e) {
                        throw new BuildError(`[${serviceAnnot.compiler.name}] ${exportObj.name}: ${e.message}`);
                    }

                    declarations.push(unindent(
                        `
                        async ${method.name}(${method.params.map(p => `${p.name} : ${this.typeToRef(p.type)}`).join(', ')}): Promise<any> {
                            ${method.body}
                        }
                        `
                    ));
                }
            }

            await writeTextFile(
                outFile, 
                unindent(
                    `
                    /// AUTOGENERATED
                    /// DO NOT EDIT THIS FILE!
                    export class ${exportObj.name} {
                        constructor() {
                        }

                        ${declarations.join("\n\n")}
                    }
                    `
                )
            );
            serviceAnnot.compiler
        }
    }

    private async sanityCheck(dir : string) {
        if (!await fileExists(pathCombine(dir, `package.json`))) {
            throw new BuildError(`must be run in your package's root directory`);
        }

        if (!await fileExists(pathCombine(dir, 'src', 'index.ts'))) {
            throw new BuildError(`cannot find library entrypoint src/index.ts: Is this an Alterior package?`);
        }

        return true;
    }

    private async clearOutDir() {
        if (await fileExists(this.outDir)) {
            await removeAll(this.outDir);
        }
    }

    async build() {
        let dir = this.projectDir; 

        try {
            await this.sanityCheck(dir);
            await this.clearOutDir();
            //await this.prebuild();
               
            //console.log();
            //console.log(`#################### @alterior/compiler`);

            await this.loadExports();
            await this.precheckExports();
            await this.compile();

            //console.log(`####################`);
            //console.log();

            await this.postbuild();
        } catch (e) {
            if (e instanceof BuildError) {
                console.error(`alt build: ${e.message}`);
                return 1;
            }

            throw e;
        }
    }
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
                options: ts.CompilerOptions, 
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

                    //customTransformers.before.push(rttiTransformer(program.getProgram()));
                    
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
        this.clientBuilder = new ClientBuilder(projectDir);
    }

    private backendBuilder : BackendBuilder;
    private clientBuilder : ClientBuilder;

    async build() {
        await this.backendBuilder.build();
        await this.clientBuilder.build();
    }
}