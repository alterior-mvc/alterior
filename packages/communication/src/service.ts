import { InjectionToken } from '@alterior/di';
import { Documentation, DocumentationAnnotation } from './documentation';
import { HttpRoute, HttpRoutesBuilder, httpRoutes } from './http';
import { ConcreteConstructor, Method, allowConstruction } from './types';

function ServiceBuilder() {
    return {
        method: <P extends Array<any>, R>(...decorators: MethodDecorator[]): (...args: P) => Promise<R> => {
            return <any>{
                decorators
            };
        },

        /**
         * Provide documentation for a method.
         * @param docs 
         * @returns 
         */
        documentation: (docs: Documentation): MethodDecorator => {
            return (target, propertyKey) => {
                if (typeof propertyKey === 'string')
                    new DocumentationAnnotation(docs).applyToMethod(target, propertyKey);
            };
        },
    }
}

export type ServiceInterface<T> = { readonly [P in keyof T as T[P] extends Method ? P : never]: T[P]; };

interface MethodIntrospection {
    decorators: MethodDecorator[];
}

type ServiceIntrospection<T> = { readonly [P in keyof T as T[P] extends Method ? P : never]: MethodIntrospection; };

export const COMMUNICATION_SERVICE_CLASS = new InjectionToken<any>("COMMUNICATION_SERVICE_CLASS");

/**
 * Options for the web service. Available options are a superset 
 * of the options available for @Module() as well as WebServerModule.configure(...).
 */
export interface WebServiceOptions {
	/**
	 * Identity to use when exposing this service via Conduit. When not specified, the name of the class is used.
	 */
	identity?: string;

    /**
     * Human readable description of this web service, used for Conduit discovery and introspection as well 
     * as OpenAPI/Swagger definitions.
     */
    description?: string;
}

export type ServiceClientConstructor<T> = {
    new (endpoint: string): ServiceInterface<T>;
    ['interface']: ServiceInterface<T>;
    methods: ServiceMethod[];
    httpRoutes: HttpRoute[];

    http(definer: HttpRoutesBuilder<T>): ServiceClientConstructor<T>;
};

export interface ServiceMethod {
    name: string;
    decorators: MethodDecorator[];
}

export function Service(identity: string) {
    return {
        define: <T>(definer: (t: ReturnType<typeof ServiceBuilder>) => T): ServiceClientConstructor<T> => {
            let serviceInterface = definer(ServiceBuilder());
            let methods: ServiceMethod[] = [];
            let routes: HttpRoute[] = [];

            for (let name of Object.keys(<any>serviceInterface)) {
                let { decorators } = <MethodIntrospection>(serviceInterface as any)[name];
                methods.push({ name, decorators });
            }

            
            function serviceConstructor(endpoint: string) {
                // TODO: construct instance
                return <ServiceInterface<T>> <any> undefined;
            };

            serviceConstructor.interface = serviceInterface;
            serviceConstructor.http = function (this: ServiceClientConstructor<T>, definer: HttpRoutesBuilder<T>) {
                routes.push(...httpRoutes(definer));
                return this;
            };
            serviceConstructor.methods = methods;
            serviceConstructor.httpRoutes = routes;

            Object.defineProperty(serviceConstructor, 'name', {
                value: `ServiceClient[${identity}]`
            });

            let arr = [128, 56, 22, 9, 3244];
            let arr2 = arr.sort();

            return allowConstruction(serviceConstructor);
        },
    }
}
