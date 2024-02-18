import { inject } from "@alterior/di";
import { timeout, InvalidOperationError, ArgumentError } from "@alterior/common";
import { ApplicationOptionsRef } from "./application";
import { RUNTIME_LOGGER } from "./runtime-logger";
import { Runtime } from "./runtime";

const SUPPORTED_ROLE_MODES = ['default', 'default-except', 'all-except', 'only'];
export type RoleConfigurationMode = 'default' | 'default-except' | 'all-except' | 'only';

export interface RoleConfiguration {
    mode: RoleConfigurationMode;
    roles: any[];
}

/**
 * Role registration information. Use this when your module provides a service which should support being turned on and 
 * off at runtime.
 */
export interface RoleRegistration {
    /**
     * Set to false to cause this role to be disabled unless explicitly asked for. When unspecified, the default is 
     * true.
     */
    enabledByDefault?: boolean;

    /**
     * The identifier that will be matched when interpreting command line role enablements.
     */
    identifier: string;

    /**
     * The human readable name for this role. 
     */
    name: string;

    /**
     * A short (one sentence) summary which may be shown in command line help output and other places.
     */
    summary: string;
}

export interface RoleEvents {
    /**
     * Start services associated with this role. 
     * For instance, an HTTP server module would start it's HTTP server.
     */
    start(): Promise<void>;

    /**
     * Stop services associated with this role.
     */
    stop(): Promise<void>;
}

/**
 * Roles allow runtime configuration of which parts of an application are currently running. 
 * For instance WebServerModule and TasksModule both register their respective roles, 
 * so that they can be easily configured to start or not, as well as be turned on and 
 * off while the application is running.
 */
export class ApplicationRoles {
    private appOptionsRef = inject(ApplicationOptionsRef);
    private logger = inject(RUNTIME_LOGGER, { optional: true }) ?? Runtime.defaultLogger;

    silent = this.appOptionsRef.options.silent ?? false;

    private _activeRoles: RoleRegistration[] = [];
    private _configuration: RoleConfiguration = { mode: 'default', roles: [] };
    private _roles: RoleRegistration[] = [];

    get configuration(): RoleConfiguration {
        return this._configuration;
    }

    /**
     * Register a role which can be managed by this service.
     */
    registerRole(role: RoleRegistration & RoleEvents) {
        this._roles.push(role);
    }

    get roles(): RoleRegistration[] {
        return this._roles;
    }

    /**
     * Calculate the exact list of roles the configuration currently applies to.
     */
    get effectiveRoles(): RoleRegistration[] {
        let config = this._configuration;

        if (config.mode === 'default') {
            return this._roles
                .filter(x => x.enabledByDefault !== false);
        } else if (config.mode == 'all-except') {
            return this._roles
                .filter(x => !config.roles.includes(x.identifier));
        } else if (config.mode == 'default-except') {
            return this._roles
                .filter(x => x.enabledByDefault !== false)
                .filter(x => !config.roles.includes(x.identifier));
        } else if (config.mode == 'only') {
            return this._roles
                .filter(x => config.roles.includes(x.identifier));
        }

        return [];
    }

    get activeRoles(): RoleRegistration[] {
        return this._activeRoles.slice();
    }

    /**
     * Configure which roles should be run by this service
     */
    configure(config: RoleConfiguration) {
        if (!SUPPORTED_ROLE_MODES.includes(config.mode))
            throw new InvalidOperationError(`Role mode '${config.mode}' is not supported (supports 'all-except', 'only')`);

        let missingRoles = config.roles.filter(x => !this.roles.find(y => y.identifier === x));
        if (missingRoles.length > 0) {
            throw new Error(`The following roles have not been defined: ${missingRoles.join(', ')}. Did you define roles in altOnStart() instead of altOnInit()?`);
        }

        this._configuration = config;
    }

    getById(id: string) {
        let role = this._roles.find(x => x.identifier === id);

        if (!role)
            throw new ArgumentError(`Role with ID '${id}' is not registered`);

        return role;
    }

    private getByIdInternal(id: string) {
        return this.getById(id) as RoleRegistration & RoleEvents;
    }

    async restartAll() {
        await this.stopAll();
        await timeout(1);
        await this.startAll();
    }

    isRunning(identifier: string) {
        return this.activeRoles.some(x => x.identifier === identifier);
    }

    async start(identifier: string) {
        if (this.isRunning(identifier))
            return;

        const role = this.getByIdInternal(identifier);
        await role.start();
        this._activeRoles.push(role);
        this.logger.info(`Role ${role.identifier} started`);
    }

    async stop(identifier: string) {
        if (!this.isRunning(identifier))
            return;

        const role = this.getByIdInternal(identifier);
        await role.stop();
        this._activeRoles = this._activeRoles.filter(x => x !== role);
        this.logger.info(`Role ${role.identifier} stopped`);
    }

    async startAll() {
        await Promise.all(this.effectiveRoles.map(async role => await this.start(role.identifier)));
    }

    async stopAll() {
        await Promise.all(this.activeRoles.map(async role => await this.stop(role.identifier)));
    }
}