/**
 * (C) 2017-2019 William Lahti
 */

import { MetadataName, Annotation } from "@alterior/annotations";
import { Provider } from '@alterior/di';
import { BuiltinLifecycleEvents, withBuiltinLifecycleSymbols } from "./lifecycle";

export interface ConfiguredModule extends ModuleOptions {
    $module: ModuleLike;
    ngModule?: ModuleLike;
}

export function configureModule(module: Function, providers: Provider[]): ConfiguredModule {
    return {
        $module: module,
        ngModule: module,
        providers
    };
}

export type ModuleLike = Function | ConfiguredModule;

export interface ModuleOptions {
    tasks?: any[];

    /**
     * Dependencies of this module. Specifying a module as an import causes that module to be included in the 
     * application's module graph. All of the import's providers will be available from the application's 
     * dependency injector and it will be instantiated and receive lifecycle events throughout the life of the 
     * application. Only one instance of a module exists within an application even if multiple modules import it.
     */
    imports?: ModuleLike[];

    /**
     * Providers that will be contributed to the application's dependency injector when this module is present 
     * in the module graph. Note that the resulting dependency injector is not heirarchical (ie the providers of a
     * module are available to all other modules, regardless of whether the consuming module has listed the module 
     * as an import).
     */
    providers?: Provider[];

    /**
     * Called during Application.bootstrap() when this module is part of the application's module graph.
     * Delays bootstrapping of the application until the returned promise completes. When multiple modules specify
     * `prepare` functions, they are all run in parallel.
     */
    prepare?: () => Promise<void>;
}

@MetadataName('@alterior/runtime:Module')
export class ModuleAnnotation extends Annotation implements ModuleOptions {
    constructor(moduleOptions?: ModuleOptions) {
        super(moduleOptions);
    }

    /**
     * Task classes which are part of this module
     * @deprecated
     */
    tasks!: any[];

    /**
     * Modules imported by this module
     */
    imports!: ModuleLike[];

    /**
     * Dependency injection providers
     */
    providers!: Provider[];

    /**
     * Called during Application.bootstrap() when this module is part of the application's module graph.
     * Delays bootstrapping of the application until the returned promise completes. When multiple modules specify
     * `prepare` functions, they are all run in parallel.
     */
    prepare?: () => Promise<void>;
}

/**
 * Annotation that denotes an Alterior module class.
 */
const ModuleDecorator = ModuleAnnotation.decorator();

export const Module = withBuiltinLifecycleSymbols(ModuleDecorator);