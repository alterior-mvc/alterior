import { ModuleAnnotation, ModuleOptions, Module, ModuleLike } from "@alterior/di";
import { Injector, Provider, ReflectiveInjector } from "@alterior/di";
import { timeout, Environment } from "@alterior/common";
import { RolesService } from "./roles.service";
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
     * Perform runtime configuration steps
     */
    configure() {

        let environment = this.injector.get(Environment);
        let rolesService = this.injector.get(RolesService);
        let allRoles = rolesService.roles;

        if (environment.get<any>().ALT_ROLES_ONLY) {
            let value = environment.get<any>().ALT_ROLES_ONLY;
            let roles = value.split(',')
                .map(x => allRoles.find(y => y.identifier == x))
                .map(x => x.class)
            ;

            rolesService.configure({ mode: 'only', roles });
        } else if (environment.get<any>().ALT_ROLES_ALL_EXCEPT) {
            let value = environment.get<any>().ALT_ROLES_ALL_EXCEPT;
            let roles = value.split(',')
                .map(x => allRoles.find(y => y.identifier == x))
                .map(x => x.class)
            ;

            rolesService.configure({ mode: 'all-except', roles });
        } 

        if (typeof process !== 'undefined' && process.argv) {
            this.processCommandLine(process.argv.splice(2));
        }
    }

    processCommandLine(args : string[]) {
        let rolesService = this.injector.get(RolesService);
        let argIndex = 0;

        let getArgumentValue = () => {
            let arg = args[argIndex];
            if (argIndex + 1 >= args.length)
                throw new Error(`You must specify a value for option ${arg}`);
            

            let value = args[++argIndex];

            if (value.startsWith('-')) {
                throw new Error(`You must specify a value for option ${arg} (encountered option '${value}' instead)`);
            }

            return value;
        };

        let allRoles = rolesService.roles;
        for (; argIndex < args.length; ++argIndex) {
            let arg = args[argIndex];

            if (arg == '-r' || arg == '--roles-only') {
                let value = getArgumentValue();

                let roles = value.split(',')
                    .map(x => allRoles.find(y => y.identifier == x))
                    .filter(x => x)
                    .map(x => x.class)
                ;

                rolesService.configure({ mode: 'only', roles });
            } else if (arg == '-R' || arg == '--roles-all-except') {
                let value = getArgumentValue();

                let roles = value.split(',')
                    .map(x => allRoles.find(y => y.identifier == x))
                    .filter(x => x)
                    .map(x => x.class)
                ;

                rolesService.configure({ mode: 'all-except', roles });
            }
        }
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

        this._injector = ownInjector;

        let moduleInstances = this.definitions.map (defn => new ModuleInstance(defn, ownInjector.get(defn.target)));
        this.instances = moduleInstances;
        
        return this.instances;
    }

    /**
     * Stop any services, as defined by imported modules of this runtime. For instance, if you import WebServerModule 
     * from @alterior/web-server, calling this will instruct the module to stop serving on the configured port. 
     * Also builds in a timeout to allow for all services and operations to stop before resolving.
     * 
     * This will send the `OnStop` lifecycle event to all modules, which triggers the `altOnStop()` method of any module 
     * which implements it to be called. It also instructs the RolesService to stop any roles which are currently running.
     * For more information about Roles, see the documentation for RolesService.
     */
    async stop() {
        this.fireEvent('OnStop');
        let rolesService = this.injector.get(RolesService);
        rolesService.stopAll();
    }

    /**
     * Start any services, as defined by modules. For instance, if you import WebServerModule from @alterior/web-server,
     * calling this will instruct the module to begin serving on the configured port. 
     * 
     * This will send the `OnStart` lifecycle event to all modules, which triggers the `altOnStart()` method of any module 
     * which implements it to be called. It also instructs the RolesService to start roles as per it's configuration. 
     * For more information about Roles, see the documentation for RolesService.
     */
    start() {
        this.fireEvent('OnStart');

        let rolesService = this.injector.get(RolesService);
        rolesService.startAll();
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
        
        if (metadata && metadata.imports) {
            for (let importedModule of metadata.imports) {
                this.resolveModule(importedModule);
            }
        }
        
        this.definitions.push({ 
            target: module,
            metadata,
        });

    }
}