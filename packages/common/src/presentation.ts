/// <reference types="reflect-metadata" />

import { Constructor } from "./constructor";

export const EXPOSE_PROTOTYPE_STORAGE_KEY = '@sliptap/backend:Expose';

export interface PresentedPropertyOptions {
    useProperty? : string;
    class? : Constructor<Presentation<any>>;
    defaultValue? : any;
}

export interface PresentedProperty {
    propertyKey : string;
    options : PresentedPropertyOptions;
}

/**
 * Allows for transforming data from one form to another using declarative rules.
 * To use, you must declare a subclass which has one or more properties annotated
 * with the `@Expose()` decorator. When the presentation is converted to JSON,
 * the property values from the `instance` given during instantiation will be used
 * within the JSON. If any property declaration within the `Presentation<T>` subclass
 * has a property type annotation for a type that extends `Presentation<T>`, a 
 * new instance of that type will be constructed and passed the property value from
 * the given `instance`. This allows you to control the presentation of subobjects.
 */
export class Presentation<T> {
    constructor(
        readonly instance : T
    ) {
    }

    /**
     * Construct a new set of presentations with the type of calling class
     * for the items within the given array.
     * 
     * @param this 
     * @param array 
     */
    public static from<T extends Presentation<U>, U>(this : Constructor<T>, array : U[]) : T[] {
        return array.map(x => new this(x));
    }

    public static get properties() : PresentedProperty[] {
        return this.prototype[EXPOSE_PROTOTYPE_STORAGE_KEY] || [];
    }

    public toJSON() {
        if (!this.instance)
            return null;
        
        let properties = {};

        let type = this.constructor;
        let exposureSets : PresentedProperty[][] = [];

        let prototype = type.prototype;
        while (prototype) {
            let value = prototype[EXPOSE_PROTOTYPE_STORAGE_KEY];
            if (value)
                exposureSets.push(value);
            prototype = Object.getPrototypeOf(prototype);
        }

        let exposures : PresentedProperty[] = exposureSets.reduce((pv, cv) => (pv.push(...cv), pv), []);

        type.prototype[EXPOSE_PROTOTYPE_STORAGE_KEY] || []
        for (let exposure of exposures) {
            let key = exposure.propertyKey;
            let options = exposure.options;
            
            let prototype = Object.getPrototypeOf(this);

            let propertyType = Reflect.getMetadata('design:type', this.constructor.prototype, key);
            let propertyDescriptor = Object.getOwnPropertyDescriptor(prototype, key);
            let value = this[key];

            if (options.useProperty) {
                value = this.instance[options.useProperty];
            } else if (!propertyDescriptor || !propertyDescriptor.get) {
                // Data property, fill from original object.
                value = this.instance[key];
            }

            let entityType : Constructor<Presentation<any>>;

            if (options.class) {
                entityType = options.class;
            } else if (propertyType && propertyType.prototype instanceof Presentation) {
                entityType = propertyType;
            }

            // Transform...
            if (entityType)
                value = new entityType(value);

            if (value && value.toJSON)
                value = value.toJSON();

            properties[key] = value;
        }

        return properties;
    }
}

/**
 * When used on properties declared within a subclass of `Presentation<T>`,
 * specifies that the property should be included in the final JSON presentation.
 * 
 * @see Presentation<T>
 */
export function Expose(options : PresentedPropertyOptions = {}) {
    return function (target: Object, propertyKey: string, descriptor?: PropertyDescriptor) {

        if (!target.hasOwnProperty(EXPOSE_PROTOTYPE_STORAGE_KEY)) {
            Object.defineProperty(target, EXPOSE_PROTOTYPE_STORAGE_KEY, {
                enumerable: false,
                value: []
            });
        }

        let exposures : PresentedProperty[] = target[EXPOSE_PROTOTYPE_STORAGE_KEY];

		exposures.push(<PresentedProperty>{
			propertyKey: propertyKey,
			options
        });
	};
}