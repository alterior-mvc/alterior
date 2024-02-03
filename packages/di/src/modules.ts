/**
 * (C) 2017-2019 William Lahti
 */

 import { MetadataName, Annotation } from "@alterior/annotations";
import { Provider } from './injection';

export interface ConfiguredModule extends ModuleOptions {
    $module: ModuleLike;
    ngModule? : ModuleLike;
}

export function configureModule(module: Function, providers : Provider[]): ConfiguredModule {
    return {
        $module: module,
        ngModule: module,
        providers
    };
}

export type ModuleLike = Function | ConfiguredModule;

export interface ModuleOptions {
    tasks? : any[];
    imports?: ModuleLike[];
    providers?: Provider[];
}

@MetadataName('@alterior/di:Module')
export class ModuleAnnotation extends Annotation implements ModuleOptions {
    constructor(moduleOptions? : ModuleOptions) {
        super(moduleOptions);
    }

    /**
     * Task classes which are part of this module
     * @deprecated
     */
    tasks : any[] = [];

    /**
     * Modules imported by this module
     */
    imports: ModuleLike[] = [];

    /**
     * Dependency injection providers
     */
    providers: Provider[] = [];
}

/**
 * Annotation that denotes an Alterior module class.
 */
export const Module = ModuleAnnotation.decorator();
