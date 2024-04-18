import { Mutator } from "@alterior/annotations";
import { Interceptor } from "./web-server-options";

/**
 * Use a WebService interceptor on a specific route method.
 */
export const Intercept = Mutator.create((target, interceptor: Interceptor) => {
    let original = target.propertyDescriptor.value as Function;
    target.propertyDescriptor.value = function (...args) {
        return interceptor(original.bind(this), ...args);
    }
});