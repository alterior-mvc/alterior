/// <reference types="reflect-metadata" />

import { ConcreteConstructor, Constructor } from "./constructor";
import { clone } from "./clone";

export const EXPOSE_PROTOTYPE_STORAGE_KEY = '@alterior/common:Expose';

export interface PresentedPropertyOptions {
    useProperty?: string;
    class?: ConcreteConstructor<Presentation<any>>;
    defaultValue?: any;
}

export interface PresentedProperty {
    propertyKey: string;
    options: PresentedPropertyOptions;
    designType?: any;
}

export class PresentationSchema<T> {
    constructor(readonly type: Constructor<Presentation<T>>) {
        this.populate();
    }

    private populate() {
        let exposureSets: PresentedProperty[][] = [];

        let prototype = this.type.prototype;
        let prototypes = [];

        while (prototype) {
            prototypes.push(prototype);
            let value = prototype[EXPOSE_PROTOTYPE_STORAGE_KEY];
            if (value)
                exposureSets.push(value);
            prototype = Object.getPrototypeOf(prototype);
        }

        // Reverse the order so that the super-most properties appear first,
        // followed by the subproperties.

        exposureSets = exposureSets.reverse();

        let exposures = exposureSets
            .reduce((pv, cv) => (pv.push(...cv), pv), [])
            .map(x => clone(x))
            ;

        for (let exposure of exposures) {
            let key = exposure.propertyKey;

            if (exposure.options && exposure.options.useProperty) {
                key = exposure.options.useProperty;
            }

            let designType = null;

            for (let prototype of prototypes) {
                designType = Reflect.getMetadata('design:type', prototype, key);
                if (designType)
                    break;
            }

            if (!exposure.designType)
                exposure.designType = designType;
        }

        this.properties = exposures;
    }

    properties: PresentedProperty[] = [];
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
        readonly instance: T
    ) {
    }

    /**
     * Construct a new set of presentations with the type of calling class
     * for the items within the given array.
     * 
     * @param this 
     * @param array 
     */
    public static from<T extends Presentation<U>, U>(this: ConcreteConstructor<T>, array: U[]): T[] {
        return array.map(x => new this(x));
    }

    public static get properties(): PresentedProperty[] {
        return new PresentationSchema(this).properties;
    }

    public toJSON() {
        if (!this.instance)
            return null;

        let properties: Record<string, unknown> = {};
        let exposures: PresentedProperty[] = (this.constructor as any).properties;

        for (let exposure of exposures) {
            let key = exposure.propertyKey;
            let options = exposure.options;

            let prototype = Object.getPrototypeOf(this);

            let propertyType = Reflect.getMetadata('design:type', this.constructor.prototype, key);
            let propertyDescriptor = Object.getOwnPropertyDescriptor(prototype, key);
            let value = (this as any)[key];

            if (options.useProperty) {
                value = (this.instance as any)[options.useProperty];
            } else if (!propertyDescriptor || !propertyDescriptor.get) {
                // Data property, fill from original object.
                value = (this.instance as any)[key];
            }

            let entityType: ConcreteConstructor<Presentation<any>> | undefined = undefined;

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
export function Expose(options: PresentedPropertyOptions = {}) {
    return function (target: Object, propertyKey: string, descriptor?: PropertyDescriptor) {

        if (!target.hasOwnProperty(EXPOSE_PROTOTYPE_STORAGE_KEY)) {
            Object.defineProperty(target, EXPOSE_PROTOTYPE_STORAGE_KEY, {
                enumerable: false,
                value: []
            });
        }

        let exposures: PresentedProperty[] = (target as any)[EXPOSE_PROTOTYPE_STORAGE_KEY] ?? [];

        exposures.push(<PresentedProperty>{
            propertyKey: propertyKey,
            options
        });
    };
}