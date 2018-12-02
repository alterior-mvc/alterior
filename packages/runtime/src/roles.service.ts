import { Injectable } from "@alterior/di";
import { timeout, InvalidOperationError, ArgumentError } from "@alterior/common";

const SUPPORTED_ROLE_MODES =       ['all-except',  'only' ];
export type RoleConfigurationMode = 'all-except' | 'only'  ;

export interface RoleConfiguration {
    mode : RoleConfigurationMode;
    roles : any[];
}

/**
 * Role registration information. Use this when your module provides a service which should support being turned on and 
 * off at runtime.
 */
export interface RoleRegistration {
    /**
     * The instance of the module being registered. This should be `this` for the caller in most cases, as it should be 
     * called from an Alterior module's `altOnInit()` method.
     */
    instance : any;
    
    /**
     * The identifier that will be matched when interpreting command line role enablements.
     */
    identifier : string;

    /**
     * The human readable name for this role. 
     */
    name : string;

    /**
     * A short (one sentence) summary which may be shown in command line help output and other places.
     */
    summary : string;

    /**
     * Start services associated with this role. 
     * For instance, an HTTP server module would start it's HTTP server.
     */
    start() : Promise<void>;

    /**
     * Stop services associated with this role.
     */
    stop() : Promise<void>;
}

export interface RoleState extends RoleRegistration {
    class : any;
    running : boolean;
}

/**
 * Roles allow runtime configuration of which outward facing services to start. 
 * For instance WebServerModule and TasksModule both register their respective roles, 
 * so that they can be easily turned on and off when the application is called.
 * 
 */
@Injectable()
export class RolesService {
    constructor() {

    }

    _activeRoles : any[] = null;
    _configuration : RoleConfiguration = { mode: 'all-except', roles: [] };
    _roles : RoleState[] = [];

    get configuration() : RoleConfiguration {
        return this._configuration;
    }

    /**
     * Register a role which can be managed by this service.
     */
    registerRole(role : RoleRegistration) {
        let roleState : RoleState = Object.assign(
            role,
            {
                class: role.instance.constructor,
                running: false
            }
        );

        this._roles.push(roleState);
    }

    /**
     * Calculate the exact list of roles the configuration currently applies to.
     */
    get effectiveRoles(): RoleState[] {
        let config = this._configuration;

        if (config.mode == 'all-except')
            return this._roles.filter(x => !config.roles.includes(x.class));
        else if (config.mode == 'only')
            return this._roles.filter(x => config.roles.includes(x.class));
        
        return [];
    }

    get activeRoles(): RoleState[] {
        return this._roles.filter(x => x.running);
    }

    /**
     * Configure which roles should be run by this service
     */
    configure(config : RoleConfiguration) {
        if (!SUPPORTED_ROLE_MODES.includes(config.mode))
            throw new InvalidOperationError(`Role mode '${config.mode}' is not supported (supports 'all-except', 'only')`);
        
        this._configuration = config;
    }

    async start(roleModuleClass : any) {
        return await this.getRoleForModule(roleModuleClass).start();
    }

    async stop(roleModuleClass : any) {
        return await this.getRoleForModule(roleModuleClass).stop();
    }

    getRoleForModule(roleModuleClass) {
        let role = this._roles.find(x => x.class === roleModuleClass);

        if (!role)
            throw new ArgumentError(`Role module class ${roleModuleClass.name} is not registered`);

        return role;
    }

    async restartAll() {
        await this.stopAll();
        await timeout(1);
        await this.startAll();
    }

    async startAll() {
        await Promise.all(
            this.effectiveRoles
                .filter(x => !x.running)
                .map(x => x.start())
        );
    }

    async stopAll() {
        await Promise.all(
            this.activeRoles
                .map(x => x.stop())
        );
    }
}