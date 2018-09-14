import { ModuleAnnotation, ModuleOptions, Module, ModuleLike } from "@alterior/di";
import { Injector, Provider, ReflectiveInjector } from "@alterior/di";
import { timeout } from "@alterior/common";

/**
 * Combines a module annotation and a target class into a single 
 * object for storage purposes in Runtime and related objects.
 */
export class ModuleDefinition {
    metadata : ModuleAnnotation;
    target : any;
}

/**
 * Represents a live instance of a module.
 * Contains both the module definition as well 
 * as a reference to the module instance itself.
 */
export class ModuleInstance {
    constructor(
        readonly definition : ModuleDefinition,
        readonly instance : any
    ) {
    }
}

/**
 * Used to construct a runtime environment for a given entry module.
 * Handles resolving the module tree into an injector as well as constructing
 * the module instances and running lifecycle events.
 */
export class Runtime {
    constructor(entryModule : Function) {
        this.resolveModule(entryModule);
    }

    definitions : ModuleDefinition[] = [];
    visited : ModuleLike[] = [];
    instances : ModuleInstance[] = null;

    /**
     * Get a specific service from the dependency injector.
     * @param ctor 
     */
    getService<T>(ctor : { new(...args) : T }): T {
        return this.injector.get(ctor);
    }

    /**
     * Iterate over the module definitions which are part of this 
     * runtime and append to the given array the set of dependency injection
     * providers which are specified in the module definitions.
     *  
     * @param providers An array which will be populated
     */
    contributeProviders(providers : Provider[]) {
        providers.push({ provide: Runtime, useValue: this });
        this.definitions
            .filter(defn => defn.metadata && defn.metadata.providers)
            .forEach(defn => providers.push(...defn.metadata.providers))
        ;
    }

    /**
     * Fire an event to all modules which understand it. Should be upper-camel-case, meaning
     * to fire the altOnStart() method, send "OnStart". 
     * @param eventName 
     */
    fireEvent(eventName : string) {
        for (let modInstance of this.instances) {
            if (modInstance.instance[`alt${eventName}`])
                modInstance.instance[`alt${eventName}`]();
        }
    }

    private _injector : Injector = null;

    /**
     * Get the runtime's dependency injector. This injector can provide all dependencies specified 
     * in the imported modules' `providers` definitions.
     */
    get injector() {
        return this._injector;
    }

    /**
     * Instantiate the modules of this runtime using the given dependency injector.
     * The injector will be inherited into an injector that provides the dependencies 
     * specified in the imported modules' `providers` definitions.
     * 
     * @param injector 
     */
    load(injector : Injector): ModuleInstance[] {
        if (this.instances)
            return;

        this._injector = injector;
        let ownInjector : ReflectiveInjector;
        
        let providers = this.definitions.map(x => x.target);

        try {
            ownInjector = ReflectiveInjector.resolveAndCreate(
                providers, 
                injector
            );
        } catch (e) {
            console.error(`Failed to construct injector:`);
            console.error(`Providers:`);
            console.dir(providers);
            console.error(`Definitions:`);
            console.dir(this.definitions);
            throw e;
        }

        let moduleInstances = this.definitions.map (defn => new ModuleInstance(defn, ownInjector.get(defn.target)));
        this.instances = moduleInstances;
        
        return this.instances;
    }

    /**
     * Stop any services, as defined by imported modules of this runtime. For instance, if you import WebServerModule 
     * from @alterior/web-server, calling this will instruct the module to stop serving on the configured port. 
     * Also builds in a timeout to allow for all services and operations to stop before resolving.
     * 
     * Fundamentally, this sends the `OnStop` lifecycle event, triggering the `altOnStop()` method of any module 
     * which implements it.
     */
    async stop() {
        this.fireEvent('OnStop');
        await timeout(1000);
    }

    /**
     * Start any services, as defined by modules. For instance, if you import WebServerModule from @alterior/web-server,
     * calling this will instruct the module to begin serving on the configured port. 
     * 
     * Fundamentally, this sends the `OnStart` lifecycle event, triggering the `altOnStart()` method of any module 
     * which implements it.
     */
    start() {
        this.fireEvent('OnStart');
    }

    /**
     * Stop all running services and shut down the process
     */
    async shutdown() {
        await this.stop();
        process.exit();
    }

    /**
     * Retrieve the ModuleAnnotation for a given Module definition, whether it be a class annotated
     * with `@Module()` or a plain object with `$module` which configures a module class.
     * 
     * This is an alias of ModuleAnnotation.getForClass(module)
     * 
     * @param module 
     */
    public getMetadataForModule(module : ModuleLike): ModuleAnnotation {
        return ModuleAnnotation.getForClass(module);
    }

    /**
     * Resolves the given module, adding it to this runtime.
     * Calls itself for all imports. Visited modules are tracked per runtime,
     * so resolveModule() on the same runtime object will not work, preventing 
     * loops.
     */
    private resolveModule(module : ModuleLike) {

        // Prevent infinite recursion

        if (this.visited.includes(module))
            return;
            this.visited.push(module);

        // Construct this compilation unit
        let isExtension = false;

        if (module['$module']) {
            isExtension = true;
            // This is a mask
            module = Object.assign({}, module);
            let parentModule = module['$module'];
            let options : ModuleOptions = Object.assign({}, module as any);
            delete module['$module'];

            if (!options.imports)
                options.imports = [];

            options.imports.push(parentModule);

            @Module(options) class subModule {};
            module = subModule;
            
            let metadata = this.getMetadataForModule(module);
        }

        let metadata = this.getMetadataForModule(module);
        
        this.definitions.push({ 
            target: module,
            metadata,
        });

        if (metadata && metadata.imports) {
            for (let importedModule of metadata.imports) {
                this.resolveModule(importedModule);
            }
        }
    }
}