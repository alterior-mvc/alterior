import { ModuleAnnotation } from "@alterior/di";

/**
 * Combines a module annotation and a target class into a single 
 * object for storage purposes in Runtime and related objects.
 */
export class ModuleDefinition {
    metadata?: ModuleAnnotation;
    target: any;
}

/**
 * Represents a live instance of a module.
 * Contains both the module definition as well 
 * as a reference to the module instance itself.
 */
export class ModuleInstance {
    constructor(
        readonly definition: ModuleDefinition,
        readonly instance: any
    ) {
    }
}
