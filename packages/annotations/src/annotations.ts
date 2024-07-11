/// <reference types="reflect-metadata" />

/**
 * @alterior/annotations
 * A class library for handling Typescript metadata decorators via "annotation" classes
 */

import { NotSupportedError } from '@alterior/common';
import { Constructor } from '@alterior/common';

/**
 * Represents an annotation which could be stored in the standard annotation lists 
 * on a class.
 */
export interface IAnnotation {
    $metadataName?: string;
}

// These are the properties on a class where annotation metadata is deposited 
// when annotation decorators are executed. Note that these are intended to 
// be compatible with Angular 6's model

export const ANNOTATIONS_KEY = '__annotations__';
export const CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY = '__parameters__';
export const PROPERTY_ANNOTATIONS_KEY = '__prop__metadata__';
export const METHOD_PARAMETER_ANNOTATIONS_KEY = '__parameter__metadata__';

/**
 * Represents an Annotation subclass from the perspective of using it to 
 * construct itself by passing an options object.
 */
type AnnotationConstructor<AnnoT extends Annotation> = Constructor<AnnoT> & typeof Annotation;

/**
 * Represents a decorator which accepts an Annotation's options object.
 */
export interface AnnotationDecorator<ConstructorT extends Constructor<T>, T> {
    (...args: ConstructorParameters<ConstructorT>): (target: any, ...args: any[]) => void;
    (...args: ConstructorParameters<ConstructorT>): (target: any) => void;
    (...args: ConstructorParameters<ConstructorT>): (target: any, propertyKey: string) => void;
    (...args: ConstructorParameters<ConstructorT>): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
    (...args: ConstructorParameters<ConstructorT>): (target: any, propertyKey: string, index: number) => void;
}

export interface DecoratorSite {
    type: 'class' | 'method' | 'property' | 'parameter';
    target: any;
    propertyKey?: string;
    propertyDescriptor?: PropertyDescriptor;
    index?: number;
}

export interface AnnotationDecoratorOptions<AnnoConstructorT extends Constructor<AnnoT>, AnnoT> {
    factory?: (target: DecoratorSite, ...args: ConstructorParameters<AnnoConstructorT>) => AnnoT | undefined;
    validTargets?: ('class' | 'property' | 'method' | 'parameter')[];
    allowMultiple?: boolean;
}

/**
 * Thrown when a caller attempts to decorate an annotation target when the 
 * annotation does not support that target.
 */
export class AnnotationTargetError extends NotSupportedError {
    constructor(annotationClass: Function, invalidType: string, supportedTypes: string[], message?: string) {
        super(message || `You cannot decorate a ${invalidType} with annotation ${annotationClass.name}. Valid targets: ${supportedTypes.join(', ')}`);

        this._invalidType = invalidType;
        this._annotationClass = annotationClass;
        this._supportedTypes = supportedTypes;
    }

    private _invalidType: string;
    private _annotationClass: Function;
    private _supportedTypes: string[];
    
    get invalidType(): string {
        return this._invalidType;
    }

    get supportedTypes(): string[] {
        return this._supportedTypes;
    }

    get annotationClass(): Function {
        return this._annotationClass;
    }
}

/**
 * Create a decorator suitable for use along with an Annotation class.
 * This is the core of the Annotation.decorator() method.
 * 
 * @param ctor 
 * @param options 
 */
function makeDecorator<AnnoConstructorT extends AnnotationConstructor<AnnoT>, AnnoT extends Annotation>(
    ctor: AnnoConstructorT, 
    options?: AnnotationDecoratorOptions<AnnoConstructorT, AnnoT>
): AnnotationDecorator<AnnoConstructorT, AnnoT>
{
    if (!ctor)
        throw new Error(`Cannot create decorator: Passed class reference was undefined/null: This can happen due to circular dependencies.`);

    let factory: (target: DecoratorSite, ...args: ConstructorParameters<AnnoConstructorT>) => AnnoT | undefined = (target, ...args) => <AnnoT> new ctor(...args);
    let validTargets: string[] = ['class', 'method', 'property', 'parameter'];
    let allowMultiple = false;

    if (options) {
        if (options.factory)
            factory = options.factory;
        if (options.validTargets)
            validTargets = options.validTargets as any;
        if (options.allowMultiple)
            allowMultiple = options.allowMultiple;
    }

    return (...decoratorArgs: ConstructorParameters<AnnoConstructorT>) => {
        return (target, ...args: any[]) => {

            // Note that checking the length is not enough, because for properties
            // two arguments are passed, but the property descriptor is `undefined`.
            // So we make sure that we have a valid property descriptor (args[1]) 

            if (args.length === 2 && args[1] !== undefined) {
                if (typeof args[1] === 'number') {
                    // Parameter decorator on a method or a constructor (methodName will be undefined)
                    let methodName: string = args[0];
                    let index: number = args[1];

                    if (!validTargets.includes('parameter'))
                        throw new AnnotationTargetError(ctor, 'parameter', validTargets);

                    if (!allowMultiple) {
                        let existingParamDecs = Annotations.getParameterAnnotations(target, methodName, true);
                        let existingParamAnnots = existingParamDecs[index] || [];
                        if (existingParamAnnots.find(x => x.$metadataName === ctor.$metadataName)) 
                            throw new Error(`Annotation ${ctor.name} can only be applied to an element once.`);
                    }

                    if (methodName) {
                        let annotation = factory({
                            type: 'parameter',
                            target, 
                            propertyKey: methodName,
                            index
                        }, ...decoratorArgs);

                        if (!annotation)
                            return;

                        annotation.applyToParameter(target, methodName, index);
                    } else {
                        let annotation = factory({
                            type: 'parameter',
                            target,
                            index
                        }, ...decoratorArgs);

                        if (!annotation)
                            return;
                            
                        annotation.applyToConstructorParameter(target, index);
                    }
                } else {
                    // Method decorator
                    let methodName: string = args[0];
                    let descriptor: PropertyDescriptor = args[1];
                    
                    if (!validTargets.includes('method'))
                        throw new AnnotationTargetError(ctor, 'method', validTargets);
                       
                    if (!allowMultiple) {
                        let existingAnnots = Annotations.getMethodAnnotations(target, methodName, true);
                        if (existingAnnots.find(x => x.$metadataName === ctor['$metadataName'])) 
                            throw new Error(`Annotation ${ctor.name} can only be applied to an element once.`);
                    }

                    let annotation = factory({
                        type: 'method',
                        target,
                        propertyKey: methodName,
                        propertyDescriptor: descriptor
                    }, ...decoratorArgs);

                    if (!annotation)
                        return;

                    annotation.applyToMethod(target, methodName);
                }
            } else if (args.length >= 1) { 
                // Property decorator
                let propertyKey: string = args[0];
                
                if (!validTargets.includes('property'))
                    throw new AnnotationTargetError(ctor, 'property', validTargets);

                if (!allowMultiple) {
                    let existingAnnots = Annotations.getPropertyAnnotations(target, propertyKey, true);
                    if (existingAnnots.find(x => x.$metadataName === ctor['$metadataName'])) 
                        throw new Error(`Annotation ${ctor.name} can only be applied to an element once.`);
                }

                let annotation = factory({
                    type: 'property',
                    target,
                    propertyKey
                }, ...decoratorArgs);

                if (!annotation)
                    return;

                annotation.applyToProperty(target, propertyKey);

            } else if (args.length === 0) {
                // Class decorator

                if (!validTargets.includes('class'))
                    throw new AnnotationTargetError(ctor, 'class', validTargets);
                    
                if (!allowMultiple) {
                    let existingAnnots = Annotations.getClassAnnotations(target);
                    if (existingAnnots.find(x => x.$metadataName === ctor['$metadataName'])) 
                        throw new Error(`Annotation ${ctor.name} can only be applied to an element once.`);
                }

                let annotation = factory({
                    type: 'class',
                    target
                }, ...decoratorArgs);

                if (!annotation)
                    return;

                annotation.applyToClass(target);
            } else {
                // Invalid, or future decorator types we don't support yet.
                throw new Error(`Encountered unknown decorator invocation with ${args.length + 1} parameters.`);
            }
        };
    }
}

export function MetadataName(name: string) {
    return (target: Function) => {
        Object.defineProperty(target, '$metadataName', { value: name })
    };
}

/**
 * Represents a metadata annotation which can be applied to classes,
 * constructor parameters, methods, properties, or method parameters 
 * via decorators. 
 * 
 * Custom annotations are defined as subclasses of this class. 
 * By convention, all custom annotation classes should have a name 
 * which ends in "Annotation" such as "NameAnnotation". 
 * 
 * To create a new annotation create a subclass of `Annotation` 
 * with a constructor that takes the parameters you are interested in
 * storing, and save the appropriate information onto fields of the 
 * new instance. For your convenience, Annotation provides a default 
 * constructor which takes a map object and applies its properties onto
 * the current instance, but you may replace it with a constructor that
 * takes any arguments you wish.
 * 
 * You may wish to add type safety to the default constructor parameter.
 * To do so, override the constructor and define it:
 * 
```
class XYZ extends Annotation {
    constructor(
        options: MyOptions
    ) {
        super(options);
    }
}
```
 *
 * Annotations are applied by using decorators. 
 * When you define a custom annotation, you must also define a 
 * custom decorator:
 * 
```
const Name = 
    NameAnnotation.decorator();
```
 * You can then use that decorator:
```
@Name()
class ABC {
    // ...
}
```
 * 
 */
export class Annotation implements IAnnotation {
    constructor(
        props?: any
    ) {
        this.$metadataName = (this.constructor as typeof Annotation)['$metadataName'];
        if (!this.$metadataName || !this.$metadataName.includes(':')) {
            throw new Error(
                `You must specify a metadata name for this annotation in the form of ` 
                + ` 'mynamespace:myproperty'. You specified: '${this.$metadataName || '<none>'}'`
            );
        }

        Object.assign(this, props || {});
    }

    readonly $metadataName: string;
    static readonly $metadataName: string;

    toString() {
        return `@${this.constructor.name}`;
    }

    static getMetadataName(): string {
        if (!this.$metadataName)
            throw new Error(`Annotation subclass ${this.name} must have @MetadataName()`);

        return this['$metadataName'];
    }
    
    /**
     * Construct a decorator suitable for attaching annotations of the called type 
     * onto classes, constructor parameters, methods, properties, and parameters.
     * Must be called while referencing the subclass of Annotation you wish to construct
     * the decorator for. E.g., for FooAnnotation, call FooAnnotation.decorator().
     * 
     * @param this The Annotation subclass for which the decorator is being constructed
     * @param options Allows for specifying options which will modify the behavior of the decorator. 
     *  See the DecoratorOptions documentation for more information.
     */
    public static decorator<ConstructorT extends AnnotationConstructor<T> & typeof Annotation, T extends Annotation>(
        this: ConstructorT, 
        options?: AnnotationDecoratorOptions<ConstructorT, T>
    ): AnnotationDecorator<ConstructorT, T> {
        if (this === Annotation) {
            if (!options || !options.factory) {
                throw new Error(`When calling Annotation.decorator() to create a mutator, you must specify a factory (or use Mutator.decorator())`);
            }
        }
        return makeDecorator<ConstructorT, T>(this, options);
    }

    /**
     * Clone this annotation instance into a new one. This is not a deep copy.
     */
    public clone(): this {
        return Annotations.clone(this);
    }

    /**
     * Apply this annotation to a given target. 
     * @param target 
     */
    public applyToClass(target: any): this {
        return Annotations.applyToClass(this, target);
    }

    /**
     * Apply this annotation instance to the given property.
     * @param target 
     * @param name 
     */
    public applyToProperty(target: any, name: string): this {
        return Annotations.applyToProperty(this, target, name);
    }

    /**
     * Apply this annotation instance to the given method.
     * @param target 
     * @param name 
     */
    public applyToMethod(target: any, name: string): this {
        return Annotations.applyToMethod(this, target, name);
    }

    /**
     * Apply this annotation instance to the given method parameter.
     * @param target 
     * @param name 
     * @param index 
     */
    public applyToParameter(target: any, name: string, index: number): this {
        return Annotations.applyToParameter(this, target, name, index);
    }

    /**
     * Apply this annotation instance to the given constructor parameter.
     * @param target 
     * @param name 
     * @param index 
     */
    public applyToConstructorParameter(target: any, index: number): this {
        return Annotations.applyToConstructorParameter(this, target, index);
    }

    /**
     * Filter the given list of annotations for the ones which match this annotation class
     * based on matching $metadataName.
     * 
     * @param this 
     * @param annotations 
     */
    public static filter<ConstructorT extends AnnotationConstructor<T>, T extends Annotation>(
        this: ConstructorT,
        annotations: IAnnotation[]
    ): T[] {
        return annotations.filter(
            x => x.$metadataName === this.getMetadataName()
        ) as T[];
    }

    /**
     * Get all instances of this annotation class attached to the given class.
     * If called on a subclass of Annotation, it returns only annotations that match 
     * that subclass.
     * @param this 
     * @param type The class to check
     */
    public static getAllForClass<T extends Annotation>(
        this: Constructor<T> & typeof Annotation, 
        type: any
    ): T[] {
        return (Annotations.getClassAnnotations(type) as T[])
            .filter(x => x.$metadataName === this.getMetadataName())
        ;
    }

    /**
     * Get a single instance of this annotation class attached to the given class.
     * If called on a subclass of Annotation, it returns only annotations that match 
     * that subclass.
     * 
     * @param this 
     * @param type 
     */
    public static getForClass<T extends Annotation>(
        this: Constructor<T> & typeof Annotation, 
        type: any
    ): T | undefined {
        return this.getAllForClass<T>(type)[0];
    }

    /**
     * Get all instances of this annotation class attached to the given method.
     * If called on a subclass of Annotation, it returns only annotations that match 
     * that subclass.
     * 
     * @param this 
     * @param type The class where the method is defined
     * @param methodName The name of the method to check
     */
    public static getAllForMethod<T extends Annotation>(
        this: Constructor<T> & typeof Annotation, 
        type: any, 
        methodName: string
    ): T[] {
        return (Annotations.getMethodAnnotations(type, methodName) as T[])
            .filter(x => x.$metadataName === this.getMetadataName())
        ;
    }

    /**
     * Get one instance of this annotation class attached to the given method.
     * If called on a subclass of Annotation, it returns only annotations that match 
     * that subclass.
     * 
     * @param this 
     * @param type The class where the method is defined
     * @param methodName The name of the method to check
     */
    public static getForMethod<T extends Annotation>(
        this: Constructor<T> & typeof Annotation, 
        type: any,
        methodName: string
    ): T | undefined {
        return this.getAllForMethod<T>(type, methodName)[0];
    }
    
    /**
     * Get all instances of this annotation class attached to the given property.
     * If called on a subclass of Annotation, it returns only annotations that match 
     * that subclass.
     * 
     * @param this 
     * @param type The class where the property is defined
     * @param propertyName The name of the property to check
     */
    public static getAllForProperty<T extends Annotation>(
        this: Constructor<T> & typeof Annotation, 
        type: any, 
        propertyName: string
    ): T[] {
        return (Annotations.getPropertyAnnotations(type, propertyName) as T[])
            .filter(x => x.$metadataName === this.getMetadataName())
        ;
    }

    /**
     * Get one instance of this annotation class attached to the given property.
     * If called on a subclass of Annotation, it returns only annotations that match 
     * that subclass.
     * 
     * @param this 
     * @param type The class where the property is defined
     * @param propertyName The name of the property to check
     */
    public static getForProperty<T extends Annotation>(
        this: Constructor<T> & typeof Annotation, 
        type: any,
        propertyName: string
    ): T | undefined {
        return (this as any).getAllForProperty(type, propertyName)[0];
    }
    
    /**
     * Get all instances of this annotation class attached to the parameters of the given method.
     * If called on a subclass of Annotation, it returns only annotations that match 
     * that subclass.
     * 
     * @param this 
     * @param type The class where the method is defined
     * @param methodName The name of the method where parameter annotations should be checked for
     */
    public static getAllForParameters<T extends Annotation>(
        this: Constructor<T> & typeof Annotation, 
        type: any, 
        methodName: string
    ): T[][] {
        return (Annotations.getParameterAnnotations(type, methodName) as T[][])
            .map(set => (set || []).filter(x => (this as any) === Annotation ? true: (x.$metadataName === this.getMetadataName())))
        ;
    }

    /**
     * Get all instances of this annotation class attached to the parameters of the constructor
     * for the given class.
     * If called on a subclass of Annotation, it returns only annotations that match 
     * that subclass.
     * 
     * @param this 
     * @param type The class where constructor parameter annotations should be checked for
     */
    public static getAllForConstructorParameters<T extends Annotation>(
        this: Constructor<T> & typeof Annotation, 
        type: any
    ): T[][] {
        
        let finalSet = new Array(<any>type.length).fill(undefined);
        let annotations = (Annotations.getConstructorParameterAnnotations(type) as T[][])
            .map(set => (set || []).filter(x => (this as any) === Annotation ? true: (x.$metadataName === this.getMetadataName())))
        ;

        for (let i = 0, max = annotations.length; i < max; ++i)
            finalSet[i] = annotations[i];

        return finalSet;
    }
}

/**
 * A helper class for managing annotations
 */
export class Annotations {

    /**
     * Copy the annotations defined for one class onto another.
     * @param from The class to copy annotations from
     * @param to The class to copy annotations to
     */
    public static copyClassAnnotations(from: Function, to: Function) {
        let annotations = Annotations.getClassAnnotations(from);
        annotations.forEach(x => Annotations.applyToClass(x, to));
    }

    /**
     * Apply this annotation to a given target. 
     * @param target 
     */
    public static applyToClass<T extends IAnnotation>(annotation: T, target: any): T {
        let list = this.getOrCreateListForClass(target);
        let clone = this.clone(annotation);
        list.push(clone);

        if (Reflect.getOwnMetadata) {
            let reflectedAnnotations = Reflect.getOwnMetadata('annotations', target) || [];
            reflectedAnnotations.push({ toString() { return `${clone.$metadataName}`; }, annotation: clone });
            Reflect.defineMetadata('annotations', reflectedAnnotations, target);
        }

        return clone;
    }

    /**
     * Apply this annotation instance to the given property.
     * @param target 
     * @param name 
     */
    public static applyToProperty<T extends IAnnotation>(annotation: T, target: any, name: string): T {
        let list = this.getOrCreateListForProperty(target, name);
        let clone = this.clone(annotation);
        list.push(clone);
        
        if (Reflect.getOwnMetadata) {
            let reflectedAnnotations = Reflect.getOwnMetadata('propMetadata', target, name) || [];
            reflectedAnnotations.push({ toString() { return `${clone.$metadataName}`; }, annotation: clone });
            Reflect.defineMetadata('propMetadata', reflectedAnnotations, target, name);
        }

        return clone;
    }

    /**
     * Apply this annotation instance to the given method.
     * @param target 
     * @param name 
     */
    public static applyToMethod<T extends IAnnotation>(annotation: T, target: any, name: string): T {
        let list = this.getOrCreateListForMethod(target, name);
        let clone = Annotations.clone(annotation);
        list.push(clone);

        if (Reflect.getOwnMetadata && target.constructor) {
            const meta = Reflect.getOwnMetadata('propMetadata', target.constructor) || {};
            meta[name] = (meta.hasOwnProperty(name) && meta[name]) || [];
            meta[name].unshift({ toString() { return `${clone.$metadataName}`; }, annotation: clone });
            Reflect.defineMetadata('propMetadata', meta, target.constructor);
        }

        return clone;
    }

    /**
     * Apply this annotation instance to the given method parameter.
     * @param target 
     * @param name 
     * @param index 
     */
    public static applyToParameter<T extends IAnnotation>(annotation: T, target: any, name: string, index: number): T {
        let list: (IAnnotation[] | null)[] = this.getOrCreateListForMethodParameters(target, name);
        while (list.length < index)
            list.push(null);

        let paramList = list[index] || [];
        let clone = this.clone(annotation);
        paramList.push(clone);
        list[index] = paramList;

        return clone;
    }

    /**
     * Apply this annotation instance to the given constructor parameter.
     * @param target 
     * @param name 
     * @param index 
     */
    public static applyToConstructorParameter<T extends IAnnotation>(annotation: T, target: any, index: number): T {
        let list: (IAnnotation[] | null)[] = this.getOrCreateListForConstructorParameters(target);
        while (list.length < index)
            list.push(null);

        let paramList = list[index] || [];
        let clone = this.clone(annotation);
        paramList.push(clone);
        list[index] = paramList;

        if (Reflect.getOwnMetadata) {
            let parameterList = Reflect.getOwnMetadata('parameters', target) || [];
            
            while (parameterList.length < index)
                parameterList.push(null);

            let parameterAnnotes = parameterList[index] || [];
            parameterAnnotes.push(clone);
            parameterList[index] = parameterAnnotes;

            Reflect.defineMetadata('parameters', parameterList, target);
        }

        return clone;
    }

    /**
     * Clone the given Annotation instance into a new instance. This is not 
     * a deep copy.
     * 
     * @param annotation 
     */
    public static clone<T extends IAnnotation>(annotation: T): T {
        if (!annotation)
            return annotation;
        
        return Object.assign(Object.create(Object.getPrototypeOf(annotation)), annotation);
    }

    /**
     * Get all annotations (including from Angular and other compatible 
     * frameworks). 
     * 
     * @param target The target to fetch annotations for
     */
    public static getClassAnnotations(target: any): IAnnotation[] {
        return (this.getListForClass(target) || [])
            .map(x => this.clone(x));
    }

    /**
     * Get all annotations (including from Angular and other compatible 
     * frameworks). 
     * 
     * @param target The target to fetch annotations for
     */
    public static getMethodAnnotations(target: any, methodName: string, isStatic: boolean = false): IAnnotation[] {
        return (this.getListForMethod(isStatic ? target: target.prototype, methodName) || [])
            .map(x => this.clone(x));
    }

    /**
     * Get all annotations (including from Angular and other compatible 
     * frameworks). 
     * 
     * @param target The target to fetch annotations for
     */
    public static getPropertyAnnotations(target: any, methodName: string, isStatic: boolean = false): IAnnotation[] {
        return (this.getListForProperty(isStatic ? target: target.prototype, methodName) || [])
            .map(x => this.clone(x));
    }

    /**
     * Get the annotations defined on the parameters of the given method of the given 
     * class.
     * 
     * @param type 
     * @param methodName 
     * @param isStatic Whether `type` itself (isStatic = true), or `type.prototype` (isStatic = false) should be the target.
     *  Note that passing true may indicate that the passed `type` is already the prototype of a class.
     */
    public static getParameterAnnotations(type: any, methodName: string, isStatic: boolean = false): IAnnotation[][] {
        return (this.getListForMethodParameters(isStatic ? type: type.prototype, methodName) || [])
            .map(set => set ? set.map(anno => this.clone(anno)): []);
    }

    /**
     * Get the annotations defined on the parameters of the given method of the given 
     * class.
     * 
     * @param type 
     * @param methodName 
     */
    public static getConstructorParameterAnnotations(type: any): IAnnotation[][] {
        return (this.getListForConstructorParameters(type) || [])
            .map(set => set ? set.map(anno => this.clone(anno)): []);
    }

    /**
     * Get a list of annotations for the given class.
     * @param target 
     */
    private static getListForClass(target: Object): IAnnotation[] {
        if (!target)
            return [];
        
        let combinedSet: IAnnotation[] = [];

        let superclass = Object.getPrototypeOf(target);

        if (superclass && superclass !== Function)
            combinedSet = combinedSet.concat(this.getListForClass(superclass));

        if (target.hasOwnProperty(ANNOTATIONS_KEY))
            combinedSet = combinedSet.concat((target as any)[ANNOTATIONS_KEY] || []);

        return combinedSet;
    }

    /**
     * Get a list of own annotations for the given class, or create that list.
     * @param target 
     */
    private static getOrCreateListForClass(target: Object): IAnnotation[] {
        if (!target.hasOwnProperty(ANNOTATIONS_KEY))
            Object.defineProperty(target, ANNOTATIONS_KEY, { enumerable: false, value: [] });
        return (target as any)[ANNOTATIONS_KEY] ?? [];
    }

    /**
     * Gets a map of the annotations defined on all properties of the given class/function. To get the annotations of instance fields,
     * make sure to use `Class.prototype`, otherwise static annotations are returned.
     */
    public static getMapForClassProperties(target: Object, mapToPopulate?: Record<string,IAnnotation[]>): Record<string,IAnnotation[]> {
        let combinedSet = mapToPopulate || {};
        if (!target || target === Function)
            return combinedSet;

        this.getMapForClassProperties(Object.getPrototypeOf(target), combinedSet);

        if (target.hasOwnProperty(PROPERTY_ANNOTATIONS_KEY)) {
            let ownMap: Record<string,IAnnotation[]> = (target as any)[PROPERTY_ANNOTATIONS_KEY] || {};
            for (let key of Object.keys(ownMap))
                combinedSet[key] = (combinedSet[key] || []).concat(ownMap[key]);
        }

        return combinedSet;
    }

    private static getOrCreateMapForClassProperties(target: Object): Record<string,IAnnotation[]> {
        if (!target.hasOwnProperty(PROPERTY_ANNOTATIONS_KEY))
            Object.defineProperty(target, PROPERTY_ANNOTATIONS_KEY, { enumerable: false, value: [] });
        return (target as any)[PROPERTY_ANNOTATIONS_KEY];
    }

    private static getListForProperty(target: any, propertyKey: string): IAnnotation[] | null {
        let map = this.getMapForClassProperties(target);

        if (!map)
            return null;
        
        return map[propertyKey];
    }

    private static getOrCreateListForProperty(target: any, propertyKey: string): IAnnotation[] {
        let map = this.getOrCreateMapForClassProperties(target);
        if (!map[propertyKey])
            map[propertyKey] = [];
        
        return map[propertyKey];
    }

    private static getOrCreateListForMethod(target: any, methodName: string): IAnnotation[] {
        return this.getOrCreateListForProperty(target, methodName);
    }

    private static getListForMethod(target: any, methodName: string): IAnnotation[] | null {
        return this.getListForProperty(target, methodName);
    }

    /**
     * Get a map of the annotations defined on all parameters of all methods of the given class/function.
     * To get instance methods, make sure to pass `Class.prototype`, otherwise the results are for static fields.
     */
    public static getMapForMethodParameters(target: Object, mapToPopulate?: Record<string,IAnnotation[][]>): Record<string,IAnnotation[][]> {
        let combinedMap = mapToPopulate || {};

        if (!target || target === Function)
            return combinedMap;

        // superclass/prototype
        this.getMapForMethodParameters(Object.getPrototypeOf(target), combinedMap);
        
        if (target.hasOwnProperty(METHOD_PARAMETER_ANNOTATIONS_KEY)) {
            let ownMap: Record<string,IAnnotation[][]> = (target as any)[METHOD_PARAMETER_ANNOTATIONS_KEY] || {};

            for (let methodName of Object.keys(ownMap)) {
                let parameters = ownMap[methodName];
                let combinedMethodMap = combinedMap[methodName] || [];

                for (let i = 0, max = parameters.length; i < max; ++i) {
                    combinedMethodMap[i] = (combinedMethodMap[i] || []).concat(parameters[i] || []);
                }

                combinedMap[methodName] = combinedMethodMap;
            }
        }

        return combinedMap;
    }

    private static getOrCreateMapForMethodParameters(target: Object): Record<string, IAnnotation[][]> {
        if (!target.hasOwnProperty(METHOD_PARAMETER_ANNOTATIONS_KEY))
            Object.defineProperty(target, METHOD_PARAMETER_ANNOTATIONS_KEY, { enumerable: false, value: {} });
        return (target as any)[METHOD_PARAMETER_ANNOTATIONS_KEY];
    }

    private static getListForMethodParameters(target: any, methodName: string): IAnnotation[][] | null {
        let map = this.getMapForMethodParameters(target);

        if (!map)
            return null;

        return map[methodName];
    }

    private static getOrCreateListForMethodParameters(target: any, methodName: string): IAnnotation[][] {
        let map = this.getOrCreateMapForMethodParameters(target);
        if (!map[methodName])
            map[methodName] = [];

        return map[methodName];
    }

    private static getOrCreateListForConstructorParameters(target: any): IAnnotation[][] {
        if (!target[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY])
            Object.defineProperty(target, CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY, { enumerable: false, value: [] });
        return target[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY];
    }

    private static getListForConstructorParameters(target: any): IAnnotation[][] {
        return target[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY];
    }
}

/**
 * An annotation for attaching a label to a programmatic element. 
 * Can be queried with LabelAnnotation.getForClass() for example.
 */
@MetadataName('alterior:Label')
export class LabelAnnotation extends Annotation {
    constructor(readonly text: string) {
        super();
    }
}

export const Label = LabelAnnotation.decorator();