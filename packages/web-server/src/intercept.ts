import { Mutator } from "@alterior/annotations";
import { Interceptor } from "./web-server-options";

/**
 * Use a WebService interceptor on a specific route method.
 * @group Decorators
 */
export function Intercept(interceptor: Interceptor) {
    return Mutator.create((value, target) => {
        return function (this: any, ...args: any[]) {
            return interceptor(value.bind(this), ...args);
        }
    }, { validTargets: ['method'] });
}