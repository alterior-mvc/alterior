import { MetadataName, NgMetadataName, Annotation } from "@alterior/annotations";
import { Provider, Injector } from 'injection-js';

interface ModuleMask extends ModuleOptions {
    $module: ModuleLike;
}

export type ModuleLike = Function | ModuleMask;

export interface ModuleOptions {
    declarations?: any[];
    controllers?: any[];
    imports?: ModuleLike[];
    providers?: Provider[];
}

@NgMetadataName('NgModule')
@MetadataName('@alterior/di:Module')
export class ModuleAnnotation extends Annotation implements ModuleOptions {
    constructor(moduleOptions? : ModuleOptions) {
        super(moduleOptions);
    }

    /**
     * Angular's declarations
     */
    declarations : any[];

    /**
     * Angular-compatible exports. Not used by Alterior 
     * currently. Ignored if present.
     */
    exports : any[];

    /**
     * Alterior's declarations
     */
    controllers : any[];

    /**
     * Alterior or Angular modules
     */
    imports: ModuleLike[];

    /**
     * Angular/InjectionJS/Alterior-compatible DI providers
     */
    providers: Provider[];
}

export const Module = ModuleAnnotation.decorator();
