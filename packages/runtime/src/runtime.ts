import { Environment, Time } from "@alterior/common";
import { Injector, Provider } from "@alterior/di";
import { omit } from "@alterior/functions";
import { APP_OPTIONS, ApplicationOptions } from "./app-options";
import { Application } from "./application";
import { ApplicationArgs } from "./args";
import { BuiltinLifecycleEvents, fireLifecycleEvent, handleLegacyLifecycleEvent } from "./lifecycle";
import { ConfiguredModule, Module, ModuleAnnotation, ModuleLike, ModuleOptions } from "./module-annotation";
import { ModuleDefinition, ModuleInstance } from "./modules";
import { RoleConfigurationMode, ApplicationRoles } from "./roles.service";
import { DefaultRuntimeLogger, RUNTIME_LOGGER, RuntimeLogger, SilentRuntimeLogger } from "./runtime-logger";

/**
 * Used to construct a runtime environment for a given entry module.
 * Handles resolving the module tree into an injector as well as constructing
 * the module instances and running lifecycle events.
 */
export class Runtime {
    constructor(modules: ModuleDefinition[], options: ApplicationOptions) {
        this.autostart = options.autostart ?? true;
        this.definitions = modules;
        this.injector = this.resolveInjector(this.determineProviders(options));
        this.instances = this.definitions.map(defn => new ModuleInstance(defn, this.injector.get(defn.target)));
        this.logger = this.injector.get(RUNTIME_LOGGER, options.silent? Runtime.silentLogger : Runtime.defaultLogger);
    }

    readonly autostart: boolean;

    static defaultLogger: RuntimeLogger = new DefaultRuntimeLogger();
    static silentLogger: RuntimeLogger = new SilentRuntimeLogger();
    logger: RuntimeLogger;
    
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
            ApplicationRoles,
            Environment,
            Time,
            { provide: APP_OPTIONS, useValue: options },
            ...(options.providers ?? []),
            { provide: Runtime, useValue: this }
        ]);

        this.definitions
            .filter(defn => defn.metadata?.providers)
            .forEach(defn => providers.push(...(defn.metadata?.providers) ?? []))
            ;

        return providers;
    }

    async init() {
        await this.fireEvent(BuiltinLifecycleEvents.onInit);
        this.configure();
	
        if (this.selfTest) {
            console.log(`[Self Test] ✔ Looks good!`);
            process.exit(0);
        }

        if (this.autostart)
            await this.start();
    }

    /**
     * Perform runtime configuration steps
     */
    private configure() {
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

        let rolesService = this.injector.get(ApplicationRoles);
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

        let rolesService = this.injector!.get(ApplicationRoles);
        if (roleMode !== 'default') {
            rolesService.configure({ mode: 'only', roles });
        }
    }

    /**
     * Fire an event to all modules which understand it. Will call any methods on module classes which are decorated
     * with `@LifecycleEvent(eventName)` (or one of the provided convenience forms like `@OnInit`)
     * @param eventName 
     */
    async fireEvent(eventName: symbol) {
        for (let entry of (this.instances ?? [])) {
            await fireLifecycleEvent(entry.instance, eventName);
            handleLegacyLifecycleEvent(this.logger, entry.instance, eventName);
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
        let resolvedProviders = Injector.resolve(providers);
        let keys = new Set<any>();
        let duplicateKeys = new Set<any>();

        for (let provider of resolvedProviders) {
            if (!provider.multi && keys.has(provider.key)) {
                duplicateKeys.add(provider.key);
            }

            keys.add(provider.key);
        }

        if (duplicateKeys.size > 0) {
            // TODO: this error should be improved.
            throw new Error(
                `The following providers are specified multiple times: `
                + `${Array.from(duplicateKeys).map(x => `${x.name ?? x}`).join(', ')}`
            );
        }

        let dependenciesInjector: Injector;
        try {
            dependenciesInjector = Injector.resolveAndCreate(providers);
        } catch (e) {
            console.error(`Failed to resolve injector:`);
            console.error(e);
            console.error(`Providers:`);
            console.dir(providers);
            console.error(`Modules:`);
            console.dir(this.definitions);
            throw e;
        }

        let moduleInjector: Injector;
        let moduleProviders = this.definitions.map(x => x.target);

        try {
            moduleInjector = Injector.resolveAndCreate(
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
     * 
     * This will send the `onStop` lifecycle event to all modules and instruct the RolesService to stop any roles 
     * which are currently running. For more information about Roles, see the documentation for RolesService.
     */
    async stop() {
        console.log(`RUNTIME STOPPING`);
        await this.fireEvent(BuiltinLifecycleEvents.onStop);
        await this.injector.get(ApplicationRoles).stopAll();
        await this.fireEvent(BuiltinLifecycleEvents.afterStop);
        console.log(`RUNTIME STOPPED`);
    }

    /**
     * Start any services, as defined by modules. For instance, if you import WebServerModule from @alterior/web-server,
     * calling this will instruct the module to begin serving on the configured port. 
     * 
     * This will send the `OnStart` lifecycle event to all modules, which triggers the `altOnStart()` method of any module 
     * which implements it to be called. It also instructs the RolesService to start roles as per it's configuration. 
     * For more information about Roles, see the documentation for RolesService.
     */
    async start() {
        console.log(`RUNTIME STARTING`);
        await this.fireEvent(BuiltinLifecycleEvents.onStart);
        await this.injector.get(ApplicationRoles).startAll();
        await this.fireEvent(BuiltinLifecycleEvents.afterStart);
        console.log(`RUNTIME STARTED`);
    }

    /**
     * Stop all running services and exit
     */
    async shutdown() {
        await this.stop();
        process.exit();
    }

    private static isConfiguredModule(module: ModuleLike): module is ConfiguredModule {
        return '$module' in module;
    }

    /**
     * Resolves the given module, adding it to this runtime.
     * Calls itself for all imports. Visited modules are tracked per runtime,
     * so resolveModule() on the same runtime object will not work, preventing 
     * loops.
     */
    public static resolveModules(module: ModuleLike, visited: ModuleLike[] = []): ModuleDefinition[] {

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

        let metadata = ModuleAnnotation.getForClass(module);
        let definitions: ModuleDefinition[] = [];

        if (metadata?.imports) {
            let position = 0;

            for (let importedModule of metadata.imports) {
                if (!importedModule) {
                    throw new Error(`Failed to resolve module referenced in position ${position} by ${module.toString()}`);
                }

                definitions.push(...this.resolveModules(importedModule, visited));
                ++position;
            }
        }

        return [...definitions, { target: module, metadata, }];
    }
}