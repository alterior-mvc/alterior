import { shallowClone, disallowNativeAsync } from '@alterior/common';
import { Provider } from '@alterior/di';
import { Expose } from '@alterior/runtime';
import { MiddlewareProvider } from '../middleware';
import { Interceptor } from '../web-server-options';

export class RouteReflector {
    constructor(type: Function, mountPath?: string) {

        let controllerMetadata = Reflect.getMetadata("alterior:Controller", type);
        let basePath = '/' + (mountPath || '').replace(/^\/+|\/+$/g, '');

        if (basePath === '/')
            basePath = '';

        if (controllerMetadata && controllerMetadata.basePath) {
            let controllerBasePath = controllerMetadata.basePath.replace(/^\/+|\/+$/g, '');
            if (controllerBasePath !== '') {
                basePath += `/${controllerBasePath}`;
            }
        }

        if (basePath === '/')
            basePath = '';

        let prototype = type.prototype as HasRouteDefinitions & HasMountDefinitions;
        this.routes = (prototype['alterior:routes'] || []).map(x => shallowClone(x));
        this.routes.forEach(route => {
            route.path = `${basePath}/${route.path.replace(/^\/*/, '')}`.replace(/\/+$/g, '');
            if (route.path === '')
                route.path = '/';
        });

        this.mounts = (prototype['alterior:mounts'] || []).map(x => shallowClone(x));
        this.mounts.forEach(mount => {
            let definedMountPath = mount.path || '';
            mount.path = `${basePath}/${definedMountPath.replace(/^\/*/, '')}`
            mount.controller = Reflect.getMetadata('design:type', type.prototype, mount.propertyKey);
            if (!mount.controller) {
                throw new Error(
                    `Failed to determine class for @Mount(${definedMountPath || ''}) in class ${type.name}. `
                    + `Make sure that emitDecoratorMetadata is enabled and the class is decorated. `
                    + `Make sure there are no circular dependencies. If the controller type is declared in `
                    + `the same file where @Mount() is make sure the controller is defined first.`
                );
            }
        });
    }

    public routes: RouteDefinition[];
    public mounts: MountDefinition[];
}

export interface MountDefinition {
    path?: string;
    controller: Function;
    options: MountOptions;
    propertyKey: string | symbol;
}

export interface MountDefinitionInit {
    path?: string;
    controller?: Function;
    options?: MountOptions;
    propertyKey?: string | symbol;
}

export interface MountOptions {
    providers?: Provider[];
}

export interface RouteDefinition {
    method: string;
    httpMethod: string;
    options: RouteOptions;
    path: string;
}

export interface RouteOptions {
    middleware?: MiddlewareProvider[];
    description?: string;

    /**
     * Wrap execution of this method with the given interceptors. Earlier interceptors run first. 
     * Technically this is the same as using a mutating decorator (see Mutator.create() from `@/annotations`)
     * or using the `@Intercept()` helper decorator, but it is provided here for API symmetry.
     */
    interceptors?: Interceptor[];
    summary?: string;
    group?: string;

    /**
     * Override the global maximum body size for this specific request. See also `WebServerOptions.maxBodySize`.
     * The default global size is 100 KB.
     */
    maxBodySize?: number;
}

export function Get(path?: string, options?: RouteOptions) { return Route('GET', path, options); }
export function Put(path?: string, options?: RouteOptions) { return Route('PUT', path, options); }
export function Post(path?: string, options?: RouteOptions) { return Route('POST', path, options); }
export function Delete(path?: string, options?: RouteOptions) { return Route('DELETE', path, options); }
export function Options(path?: string, options?: RouteOptions) { return Route('OPTIONS', path, options); }
export function Patch(path?: string, options?: RouteOptions) { return Route('PATCH', path, options); }

export type HasRouteDefinitions = { ['alterior:routes']?: RouteDefinition[] };
export function Route(method: string, path?: string, options?: RouteOptions) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        disallowNativeAsync((target as any)[propertyKey]);

        Expose()(target, propertyKey, descriptor);

        if (!target.hasOwnProperty('alterior:routes')) {
            Object.defineProperty(target, 'alterior:routes', {
                enumerable: false,
                value: []
            });
        }

        (target as HasRouteDefinitions)['alterior:routes']!.push({
            method: propertyKey,
            httpMethod: method || "GET",
            options: options || {},
            path: path || ''
        });
    };
}

export type HasMountDefinitions = { ['alterior:mounts']?: MountDefinitionInit[] };
export function Mount(path?: string, options?: MountOptions) {
    return function (target: any, propertyKey: string | symbol) {
        (target as HasMountDefinitions)['alterior:mounts'] ??= [];
        (target as HasMountDefinitions)['alterior:mounts']!.push({
            path: path,
            options: options,
            propertyKey
        });
    };
}