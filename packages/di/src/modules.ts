import { MetadataName, NgMetadataName, Annotation, AnnotationDecorator } from "@alterior/annotations";
import { Provider, Injector } from 'injection-js';

export interface ConfiguredModule extends ModuleOptions {
    $module: ModuleLike;
}

export type ModuleLike = Function | ConfiguredModule;

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
     * Controllers which are part of this module
     */
    controllers : any[];

    /**
     * Task classes which are part of this module
     */
    tasks : any[];

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
