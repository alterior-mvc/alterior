import { Environment, Time } from "@alterior/common";
import {
    ConfiguredModule, Injector, Module, ModuleAnnotation, ModuleLike, ModuleOptions,
    Provider, ReflectiveInjector
} from "@alterior/di";
import { omit } from "@alterior/functions";
import { ApplicationOptions } from "./app-options";
import { Application, ApplicationOptionsRef } from "./application";
import { ApplicationArgs } from "./args";
import { ModuleDefinition, ModuleInstance } from "./modules";
import { RoleConfigurationMode, RolesService } from "./roles.service";

/**
 * Used to construct a runtime environment for a given entry module.
 * Handles resolving the module tree into an injector as well as constructing
 * the module instances and running lifecycle events.
 */
export class Runtime {
    constructor(entryModule: Function, options: ApplicationOptions) {
        this.definitions = this.resolveModuleDefinitions(entryModule);
        this.injector = this.resolveInjector(this.determineProviders(options));
        this.instances = this.definitions.map(defn => new ModuleInstance(defn, this.injector.get(defn.target)));
    }

    /**
     * Contains the definitions for modules found during bootstrapping.
     */
    readonly definitions: ModuleDefinition[];

    /**
     * Contains the instances of module classes created during bootstrapping. 
     */
    readonly instances: ModuleInstance[];

    /**
     * Get the runtime's dependency injector. This injector can provide all dependencies specified 
     * in the imported modules' `providers` definitions.
     */
    readonly injector: Injector;

    /**
     * Get a specific service from the dependency injector.
     * @param ctor 
     */
    getService<T>(ctor: { new(...args: any[]): T }): T {
        return this.injector!.get(ctor);
    }

    /**
     * Retrieve the providers that were collected from the 
     * module graph and used to create the primary injector.
     */
    providers: Provider[] = [];

    /**
     * Iterate over the module definitions which are part of this 
     * runtime and append to the given array the set of dependency injection
     * providers which are specified in the module definitions.
     *  
     * @param providers An array which will be populated
     */
    private determineProviders(options: ApplicationOptions) {
        let providers: Provider[] = [];
        providers.push(...[
            Application,
            ApplicationArgs,
            RolesService,
            Environment,
            Time,
            { provide: ApplicationOptionsRef, useValue: new ApplicationOptionsRef(options) },
            ...(options.providers ?? []),
            { provide: Runtime, useValue: this }
        ]);

        this.definitions
            .filter(defn => defn.metadata && defn.metadata.providers)
            .forEach(defn => providers.push(...(defn.metadata?.providers) ?? []))
            ;

        return providers;
    }

    /**
     * Perform runtime configuration steps
     */
    configure() {
        let roleEnv = this.injector.get(Environment)
            .get<{
                ALT_ROLES_ONLY: string,
                ALT_ROLES_ALL_EXCEPT: string,
                ALT_ROLES_DEFAULT_EXCEPT: string;
            }>()
            ;

        let roleMode: RoleConfigurationMode = 'default';
        let roles: string[] = [];

        if (roleEnv.ALT_ROLES_ONLY) {
            roleMode = 'only';
            roles = roleEnv.ALT_ROLES_ONLY.split(',');
        } else if (roleEnv.ALT_ROLES_ALL_EXCEPT) {
            roleMode = 'all-except';
            roles = roleEnv.ALT_ROLES_ALL_EXCEPT.split(',');
        } else if (roleEnv.ALT_ROLES_DEFAULT_EXCEPT) {
            roleMode = 'default-except';
            roles = roleEnv.ALT_ROLES_DEFAULT_EXCEPT.split(',');
        }

        let rolesService = this.injector.get(RolesService);
        if (roleMode !== 'default') {
            rolesService.configure({ mode: roleMode, roles });
        }

        if (typeof process !== 'undefined' && process.argv) {
            this.processCommandLine(process.argv.slice(2));
        }
    }

    private _selfTest = false;

    /**
     * True if the `--self-test` option was used to launch the application.
     */
    get selfTest() {
        return this._selfTest;
    }

    processCommandLine(args: string[]) {
        let argIndex = 0;

        let optionValue = () => {
            let arg = args[argIndex];
            if (argIndex + 1 >= args.length)
                throw new Error(`You must specify a value for option ${arg}`);


            let value = args[++argIndex];

            if (value.startsWith('-')) {
                throw new Error(`You must specify a value for option ${arg} (encountered option '${value}' instead)`);
            }

            return value;
        };

        let roleMode = 'default';
        let roles: string[] = [];

        for (; argIndex < args.length; ++argIndex) {
            let arg = args[argIndex];
            if (arg === '--self-test') {
                this._selfTest = true;
            } else if (arg == '-r' || arg == '--roles-only') {
                roleMode = 'only';
                roles = optionValue().split(',');
            } else if (arg == '-x' || arg == '--roles-skip') {
                roleMode = 'default-except';
                roles = optionValue().split(',');
            } else if (arg == '-R' || arg == '--roles-all-except') {
                roleMode = 'all-except';
                roles = optionValue().split(',');
            }
        }

        let rolesService = this.injector!.get(RolesService);
        if (roleMode !== 'default') {
            rolesService.configure({ mode: 'only', roles });
        }
    }

    /**
     * Fire an event to all modules which understand it. Should be upper-camel-case, meaning
     * to fire the altOnStart() method, send "OnStart". 
     * @param eventName 
     */
    fireEvent(eventName: string) {
        for (let modInstance of (this.instances ?? [])) {
            if (modInstance.instance[`alt${eventName}`])
                modInstance.instance[`alt${eventName}`]();
        }
    }

    /**
     * Instantiate the modules of this runtime using the given dependency injector.
     * The injector will be inherited into an injector that provides the dependencies 
     * specified in the imported modules' `providers` definitions.
     * 
     * @param injector 
     */
    private resolveInjector(providers: Provider[]) {
        let dependenciesInjector: ReflectiveInjector;
        try {
            dependenciesInjector = ReflectiveInjector.resolveAndCreate(providers);
        } catch (e) {
            console.error(`Failed to resolve injector:`);
            console.error(e);
            console.error(`Providers:`);
            console.dir(providers);
            console.error(`Modules:`);
            console.dir(this.definitions);
            throw e;
        }

        let moduleInjector: ReflectiveInjector;
        let moduleProviders = this.definitions.map(x => x.target);

        try {
            moduleInjector = ReflectiveInjector.resolveAndCreate(
                moduleProviders,
                dependenciesInjector
            );
        } catch (e) {
            console.error(`Failed to construct injector:`);
            console.error(`Providers:`);
            console.dir(moduleProviders);
            console.error(`Definitions:`);
            console.dir(this.definitions);
            throw e;
        }

        return moduleInjector;
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
    public getMetadataForModule(module: ModuleLike): ModuleAnnotation {
        return ModuleAnnotation.getForClass(module);
    }

    private isConfiguredModule(module: ModuleLike): module is ConfiguredModule {
        return '$module' in module;
    }

    /**
     * Resolves the given module, adding it to this runtime.
     * Calls itself for all imports. Visited modules are tracked per runtime,
     * so resolveModule() on the same runtime object will not work, preventing 
     * loops.
     */
    private resolveModuleDefinitions(module: ModuleLike, visited: ModuleLike[] = []): ModuleDefinition[] {

        // Prevent infinite recursion

        if (visited.includes(module))
            return [];
        visited.push(module);

        // Construct this compilation unit

        if (this.isConfiguredModule(module)) {
            let options = <ModuleOptions>omit(module, ['$module']);

            options.imports ??= [];
            options.imports.push(module.$module);

            @Module(options) class AnonymousConfigurationModule { };
            module = AnonymousConfigurationModule;
        }

        let metadata = this.getMetadataForModule(module);
        let definitions: ModuleDefinition[] = [
            {
                target: module,
                metadata,
            }
        ];

        if (metadata?.imports) {
            let position = 0;

            for (let importedModule of metadata.imports) {
                if (!importedModule) {
                    throw new Error(`Failed to resolve module referenced in position ${position} by ${module.toString()}`);
                }

                definitions.push(...this.resolveModuleDefinitions(importedModule, visited));
                ++position;
            }
        }

        return definitions;
    }
}