import { ModuleAnnotation, ModuleOptions, Module, ModuleLike } from "@alterior/di";
import { Injector, Provider, ReflectiveInjector } from "injection-js";
import { timeout } from "@alterior/common";
import { ApplicationArgs } from "./args";

export class ModuleDefinition {
    metadata : ModuleAnnotation;
    target : any;
}

export class ModuleInstance {
    constructor(
        readonly definition : ModuleDefinition,
        readonly instance : any
    ) {   
    }
}

export class Runtime {
    constructor(entryModule : Function) {
        this.resolveModule(entryModule);
    }

    definitions : ModuleDefinition[] = [];
    visited : ModuleLike[] = [];
    instances : ModuleInstance[] = null;

    getService<T>(ctor : { new(...args) : T }): T {
        return this.injector.get(ctor);
    }

    contributeProviders(providers : Provider[]) {
        providers.push({ provide: Runtime, useValue: this });
        this.definitions
            .filter(defn => defn.metadata && defn.metadata.providers)
            .forEach(defn => providers.push(...defn.metadata.providers))
        ;
    }

    fireEvent(eventName : string) {
        for (let modInstance of this.instances) {
            if (modInstance.instance[`alt${eventName}`])
                modInstance.instance[`alt${eventName}`]();
        }
    }

    private _injector : Injector = null;

    get injector() {
        return this._injector;
    }

    load(injector : Injector): ModuleInstance[] {
        if (this.instances)
            return;

        this._injector = injector;
        let ownInjector = ReflectiveInjector.resolveAndCreate(
            this.definitions.map(x => x.target), 
            injector
        );

        let moduleInstances = this.definitions.map (defn => new ModuleInstance(defn, ownInjector.get(defn.target)));
        this.instances = moduleInstances;
        
        return this.instances;
    }

    async stop() {
        this.fireEvent('OnStop');
        await timeout(1000);
    }

    start() {
        this.fireEvent('OnStart');
    }

    async shutdown() {
        await this.stop();
        process.exit();
    }

    public getMetadataForModule(module : ModuleLike): ModuleAnnotation {
        return ModuleAnnotation.getForClass(module);
    }

    private resolveModule(module : ModuleLike) {

        // Prevent infinite recursion

        if (this.visited.includes(module))
            return;
            this.visited.push(module);

        // Construct this compilation unit

        if (module['$module']) {
            // This is a mask
            let parentModule = module['$module'];
            let options : ModuleOptions = Object.assign({}, module as any);
            delete module['$module'];

            if (!options.imports)
                options.imports = [];

            options.imports.push(parentModule);

            @Module(options) class subModule {};
            module = subModule;
        }

        let metadata = this.getMetadataForModule(module);
        this.definitions.push({ 
            target: module,
            metadata,
        });

        if (metadata.imports) {
            for (let importedModule of metadata.imports) {
                this.resolveModule(importedModule);
            }
        }
    }
}