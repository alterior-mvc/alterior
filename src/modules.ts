import { AngularCompatibleAnnotation, MetadataName, NgMetadataName } from "./annotations";

export interface ModuleOptions {
    declarations?: any[];
    controllers?: any[];
    imports?: Function[];
    providers?: Function[];
}

@NgMetadataName('NgModule')
@MetadataName('alterior:Module')
export class ModuleAnnotation extends AngularCompatibleAnnotation implements ModuleOptions {
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
    imports: Function[];

    /**
     * Angular/InjectionJS/Alterior-compatible DI providers
     */
    providers: Function[];
}

export const Module = ModuleAnnotation.decorator();
