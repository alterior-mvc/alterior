import { Method } from "./types";

export const CONST_HTTP_VERB_MAP = {
	/**
     * Make service method accessible via an HTTP GET request.
	 */
	get: 'GET',
	/**
     * Make service method accessible via an HTTP PUT request.
	 */
	put: 'PUT',
	/**
     * Make service method accessible via an HTTP POST request.
	 */
	post: 'POST',
	/**
     * Make service method accessible via an HTTP DELETE request.
	 */
	delete: 'DELETE',
	/**
     * Make service method accessible via an HTTP OPTIONS request.
	 */
	options: 'OPTIONS',
	/**
     * Make service method accessible via an HTTP PATCH request.
	 */
	patch: 'PATCH'
} as const;

export const HTTP_VERB_MAP = CONST_HTTP_VERB_MAP as Record<string,string>;
export const HTTP_VERBS = <string[]>Object.values(HTTP_VERB_MAP);

const HTTP_BINDING = Symbol();
type HttpBindingStandin<T> = { [HTTP_BINDING]: T };

interface HttpRequestStandin {
    path(name: string): HttpBindingStandin<string>;
    queryParam<T>(name: string): HttpBindingStandin<T>;
    queryParams(): HttpBindingStandin<Record<string,string>>;
    body<T>(): HttpBindingStandin<T>;
}

type HttpBindingParams<TS extends [...any[]]> = Array<any> & {
    [I in keyof TS]: HttpBindingStandin<TS[I]>;
} & { length: TS['length'] };

interface HttpParameterBinding {
    type: 'path' | 'queryParam' | 'queryParams' | 'body';
    name?: string;
}

type HttpBinding = {
    methodName: string;
    parameters: HttpParameterBinding[];
};

type HttpBindingHost<T> = {
    [P in keyof T as T[P] extends Method ? P : never]: T[P] extends Method 
        ? (...args: HttpBindingParams<Parameters<T[P]>>) => HttpBinding
        : never; 
}

type HttpRouteMapperBuilder<T> = (request: HttpRequestStandin, instance: HttpBindingHost<T>) => HttpBinding;

export type HttpRoute = HttpBinding & {
    httpMethod: string;
    path: string;
}

interface HttpRouteBuilder<T> {
    /**
     * Provide a mapping from request to method call and vice versa.
     * @param mapper 
     */
    bind(mapper: HttpRouteMapperBuilder<T>): HttpRoute;
}

type HttpDecorators<T> = {
    [P in keyof typeof CONST_HTTP_VERB_MAP]: 
        (path?: string) => HttpRouteBuilder<T>
};

export type HttpRoutesBuilder<T> = (r: HttpDecorators<T>) => HttpRoute[];
export function httpRoutes<T>(definer: HttpRoutesBuilder<T>) {
    return definer(
        new Proxy<HttpDecorators<T>>({} as any, {
            get: (_, p) => {
                if (typeof p === 'string' && Object.keys(HTTP_VERB_MAP).includes(p)) {
                    return (path?: string): HttpRouteBuilder<T> => {
                        return {
                            bind: (mapper: HttpRouteMapperBuilder<T>) => {
                                const binding = mapper({
                                    body() { return <any><HttpParameterBinding>{ type: 'body' }; },
                                    path(name) { return <any><HttpParameterBinding>{ type: 'path', name }; },
                                    queryParam(name) { return <any><HttpParameterBinding>{ type: 'queryParam', name } },
                                    queryParams() { return <any><HttpParameterBinding>{ type: 'queryParams' } }
                                }, new Proxy({} as any, {
                                    get: (_, p) => (...args: HttpParameterBinding[]) => <HttpBinding>{
                                        methodName: p,
                                        parameters: args
                                    }
                                }));

                                return <HttpRoute>{ 
                                    httpMethod: HTTP_VERB_MAP[p], 
                                    path: path ?? '',
                                    methodName: binding.methodName,
                                    parameters: binding.parameters
                                };
                            }
                        }
                    };
                }
            }
        })
    );
}