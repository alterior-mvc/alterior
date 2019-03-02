
/**
 * @alterior/annotations -- A class library for handling Typescript metadata decorators via "annotation" classes
 * 
 * TODO: Need Alterior-specific @Inject/@Injectable so that we can support 
 * both Injection-JS and Angular with one set of injection decorators
 * 
 */
import { NotSupportedError } from '@alterior/common';

/**
 * Represents an annotation which could be stored in the standard annotation lists 
 * on a class.
 */
export interface IAnnotation {
    $metadataName? : string;
    ngMetadataName? : string;
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
interface AnnotationConstructor<AnnoT extends Annotation, TS extends any[]> {
    new (...args : TS) : AnnoT;
    getMetadataName();
}

/**
 * Represents a decorator which accepts an Annotation's options object.
 */
export interface AnnotationDecorator<TS extends any[]> {
    (...args : TS) : (target, ...args) => void;
    (...args : TS) : (target) => void;
    (...args : TS) : (target, propertyKey : string) => void;
    (...args : TS) : (target, propertyKey : string, descriptor : PropertyDescriptor) => void;
    (...args : TS) : (target, propertyKey : string, index : number) => void;
}

interface DecoratorTarget {
    type : 'class' | 'method' | 'property' | 'parameter';
    target : any;
    propertyKey? : string;
    propertyDescriptor? : PropertyDescriptor;
    index? : number;
}

interface AnnotationDecoratorOptions<AnnoT, TS extends any[] = []> {
    factory? : (target : DecoratorTarget, ...args : TS) => AnnoT | void;
    validTargets? : ('class' | 'property' | 'method' | 'parameter')[];
    allowMultiple? : boolean;
}

/**
 * Thrown when a caller attempts to decorate an annotation target when the 
 * annotation does not support that target.
 */
export class AnnotationTargetError extends NotSupportedError {
    constructor(annotationClass, invalidType : string, supportedTypes : string[], message? : string) {
        super(message || `You cannot decorate a ${invalidType} with annotation ${annotationClass.name}. Valid targets: ${supportedTypes.join(', ')}`);

        this._invalidType = invalidType;
        this._annotationClass = annotationClass;
        this._supportedTypes = supportedTypes;
    }

    private _invalidType : string;
    private _annotationClass : Function;
    private _supportedTypes : string[];
    
    get invalidType() : string {
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
function makeDecorator<AnnoT extends Annotation, TS extends any[]>(
    ctor : AnnotationConstructor<AnnoT, TS>, 
    options? : AnnotationDecoratorOptions<AnnoT, TS>
): AnnotationDecorator<TS> 
{
    let factory : (target : DecoratorTarget, ...args : TS) => AnnoT | void = null;
    let validTargets : string[] = null;
    let allowMultiple = false;

    if (options) {
        if (options.factory)
            factory = options.factory;
        if (options.validTargets)
            validTargets = options.validTargets as any;
        if (options.allowMultiple)
            allowMultiple = options.allowMultiple;
    }

    if (!factory)
        factory = (target, ...args) => new ctor(...args);
    
    if (!validTargets)
        validTargets = ['class', 'method', 'property', 'parameter'];
    
    return (...decoratorArgs : TS) => {
        return (target, ...args) => {

            if (args.length === 2) {
                if (typeof args[1] === 'number') {
                    // Parameter decorator on a method or a constructor (methodName will be undefined)
                    let methodName : string = args[0];
                    let index : number = args[1];

                    if (!validTargets.includes('parameter'))
                        throw new AnnotationTargetError(ctor, 'parameter', validTargets);

                    if (!allowMultiple) {
                        let existingParamDecs = Annotations.getParameterAnnotations(target, methodName, true);
                        let existingParamAnnots = existingParamDecs[index] || [];
                        if (existingParamAnnots.find(x => x.$metadataName === ctor['$metadataName'])) 
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
                    let methodName : string = args[0];
                    let descriptor : PropertyDescriptor = args[1];
                    
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
            } else if (args.length === 1) {
                // Property decorator
                let propertyKey : string = args[0];
                
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

export function MetadataName(name : string) {
    return target => Object.defineProperty(target, '$metadataName', { value: name });
}

export class Mutator {
    public static create(mutator : (target : DecoratorTarget, ...args) => void, options? : AnnotationDecoratorOptions<void>) {
        return Annotation.decorator(Object.assign({}, options || {}, {
            factory: (target, ...args) => {
                mutator(target, ...args);
            }
        }));
    }
}

/**
 * Represents a metadata annotation which can be applied to classes,
 * constructor parameters, methods, properties, or method parameters 
 * via decorators. 
 * 
 * To create a custom Annotation, specify an Options type, subclass Annotation
 * with a constructor that takes 
 */
export class Annotation implements IAnnotation {
    constructor(
        props? : any
    ) {
        this.$metadataName = this.constructor['$metadataName'];
        if (!this.$metadataName || !this.$metadataName.includes(':')) {
            throw new Error(
                `You must specify a metadata name for this annotation in the form of ` 
                + ` 'mynamespace:myproperty'. You specified: '${this.$metadataName || '<none>'}'`
            );
        }

        Object.assign(this, props || {});
        this.ngMetadataName = (this.constructor as any).ngMetadataName;
    }

    readonly $metadataName : string;
    readonly ngMetadataName : string = undefined;

    static getMetadataName(): string {
        if (!this['$metadataName'])
            throw new Error(`Annotation subclass ${this.constructor.name} must have @MetadataName()`);

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
    public static decorator<T extends Annotation, TS extends any[]>(
        this: AnnotationConstructor<T, TS>, 
        options? : AnnotationDecoratorOptions<T, TS>
    ) {
        if ((this as any) === Annotation) {
            if (!options || !options.factory) {
                throw new Error(`When calling Annotation.decorator() to create a mutator, you must specify a factory (or use Mutator.decorator())`);
            }
        }
        return makeDecorator(this, options);
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
    public applyToClass(target : any): this {
        return Annotations.applyToClass(this, target);
    }

    /**
     * Apply this annotation instance to the given property.
     * @param target 
     * @param name 
     */
    public applyToProperty(target : any, name : string): this {
        return Annotations.applyToProperty(this, target, name);
    }

    /**
     * Apply this annotation instance to the given method.
     * @param target 
     * @param name 
     */
    public applyToMethod(target : any, name : string): this {
        return Annotations.applyToMethod(this, target, name);
    }

    /**
     * Apply this annotation instance to the given method parameter.
     * @param target 
     * @param name 
     * @param index 
     */
    public applyToParameter(target : any, name : string, index : number): this {
        return Annotations.applyToParameter(this, target, name, index);
    }

    /**
     * Apply this annotation instance to the given constructor parameter.
     * @param target 
     * @param name 
     * @param index 
     */
    public applyToConstructorParameter(target : any, index : number): this {
        return Annotations.applyToConstructorParameter(this, target, index);
    }

    public static filter<T extends Annotation, TS extends any[]>(
        this : AnnotationConstructor<T, TS>,
        annotations : IAnnotation[]
    ) : T[] {
        return annotations.filter(
            x => x.$metadataName === this.getMetadataName()
        ) as T[];
    }

    public static getAllForClass<T extends Annotation, TS extends any[]>(
        this : AnnotationConstructor<T, TS>, 
        type : any
    ): T[] {
        return (Annotations.getClassAnnotations(type) as T[])
            .filter(x => x.$metadataName === this.getMetadataName())
        ;
    }

    public static getForClass<T extends Annotation, TS extends any[]>(
        this : AnnotationConstructor<T, TS>, 
        type : any
    ): T {
        return (this as any).getAllForClass(type)[0];
    }

    public static getAllForMethod<T extends Annotation, TS extends any[]>(
        this : AnnotationConstructor<T, TS>, 
        type : any, 
        methodName : string
    ): T[] {
        return (Annotations.getMethodAnnotations(type, methodName) as T[])
            .filter(x => x.$metadataName === this.getMetadataName())
        ;
    }

    public static getForMethod<T extends Annotation, TS extends any[]>(
        this : AnnotationConstructor<T, TS>, 
        type : any,
        methodName : string
    ): T {
        return (this as any).getAllForMethod(type, methodName)[0];
    }
    
    public static getAllForProperty<T extends Annotation, TS extends any[]>(
        this : AnnotationConstructor<T, TS>, 
        type : any, 
        propertyName : string
    ): T[] {
        return (Annotations.getPropertyAnnotations(type, propertyName) as T[])
            .filter(x => x.$metadataName === this.getMetadataName())
        ;
    }

    public static getForProperty<T extends Annotation, TS extends any[]>(
        this : AnnotationConstructor<T, TS>, 
        type : any,
        propertyName : string
    ): T {
        return (this as any).getAllForProperty(type, propertyName)[0];
    }
    
    public static getAllForParameters<T extends Annotation, TS extends any[]>(
        this : AnnotationConstructor<T, TS>, 
        type : any, 
        methodName : string
    ): T[][] {
        return (Annotations.getParameterAnnotations(type, methodName) as T[][])
            .map(set => (set || []).filter(x => x.$metadataName === this.getMetadataName()))
        ;
    }

    public static getAllForConstructorParameters<T extends Annotation, TS extends any[]>(
        this : AnnotationConstructor<T, TS>, 
        type : any
    ): T[][] {
        return (Annotations.getConstructorParameterAnnotations(type) as T[][])
            .map(set => (set || []).filter(x => x.$metadataName === this.getMetadataName()))
        ;
    }
}

export class Annotations {

    public static copyClassAnnotations(from : Function, to : Function) {
        let annotations = Annotations.getClassAnnotations(from);
        annotations.forEach(x => Annotations.applyToClass(x, to));
    }

    /**
     * Apply this annotation to a given target. 
     * @param target 
     */
    public static applyToClass<T extends IAnnotation>(annotation : T, target : any): T {
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
    public static applyToProperty<T extends IAnnotation>(annotation : T, target : any, name : string): T {
        let list = this.getOrCreateListForProperty(target, name);
        let clone = this.clone(annotation);
        list.push(clone);
        
        if (Reflect.getOwnMetadata) {
            let reflectedAnnotations = Reflect.getOwnMetadata('propMetadata', target, name);
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
    public static applyToMethod<T extends IAnnotation>(annotation : T, target : any, name : string): T {
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
    public static applyToParameter<T extends IAnnotation>(annotation : T, target : any, name : string, index : number): T {
        let list = this.getOrCreateListForMethodParameters(target, name);
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
    public static applyToConstructorParameter<T extends IAnnotation>(annotation : T, target : any, index : number): T {
        let list = this.getOrCreateListForConstructorParameters(target);
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
    public static clone<T extends IAnnotation>(annotation : T): T {
        return Object.assign(Object.create(Object.getPrototypeOf(annotation)), annotation);
    }

    /**
     * Get all annotations (including from Angular and other compatible 
     * frameworks). 
     * 
     * @param target The target to fetch annotations for
     */
    public static getClassAnnotations(target : any): IAnnotation[] {
        return (this.getListForClass(target) || [])
            .map(x => this.clone(x));
    }

    /**
     * Get all annotations (including from Angular and other compatible 
     * frameworks). 
     * 
     * @param target The target to fetch annotations for
     */
    public static getMethodAnnotations(target : any, methodName : string, isStatic : boolean = false): IAnnotation[] {
        return (this.getListForMethod(isStatic ? target : target.prototype, methodName) || [])
            .map(x => this.clone(x));
    }

    /**
     * Get all annotations (including from Angular and other compatible 
     * frameworks). 
     * 
     * @param target The target to fetch annotations for
     */
    public static getPropertyAnnotations(target : any, methodName : string, isStatic : boolean = false): IAnnotation[] {
        return (this.getListForProperty(isStatic ? target : target.prototype, methodName) || [])
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
    public static getParameterAnnotations(type : any, methodName : string, isStatic : boolean = false): IAnnotation[][] {
        return (this.getListForMethodParameters(isStatic ? type : type.prototype, methodName) || [])
            .map(set => set ? set.map(anno => this.clone(anno)) : []);
    }

    /**
     * Get the annotations defined on the parameters of the given method of the given 
     * class.
     * 
     * @param type 
     * @param methodName 
     */
    public static getConstructorParameterAnnotations(type : any): IAnnotation[][] {
        return (this.getListForConstructorParameters(type) || [])
            .map(set => set ? set.map(anno => this.clone(anno)) : []);
    }

    private static getListForClass(target : any): IAnnotation[] {
        return target[ANNOTATIONS_KEY];
    }

    private static getOrCreateListForClass(target : any): IAnnotation[] {
        if (!target[ANNOTATIONS_KEY])
            Object.defineProperty(target, ANNOTATIONS_KEY, { value: [] });
        return target[ANNOTATIONS_KEY];
    }

    private static getMapForClassProperties(target : any): IAnnotation[] {
        return target[PROPERTY_ANNOTATIONS_KEY];
    }

    private static getOrCreateMapForClassProperties(target : any): IAnnotation[] {
        if (!target[PROPERTY_ANNOTATIONS_KEY])
            Object.defineProperty(target, PROPERTY_ANNOTATIONS_KEY, { value: [] });
        return target[PROPERTY_ANNOTATIONS_KEY];
    }

    private static getListForProperty(target : any, propertyKey : string): IAnnotation[] {
        let map = this.getMapForClassProperties(target);

        if (!map)
            return null;
        
        return map[propertyKey];
    }
    private static getOrCreateListForProperty(target : any, propertyKey : string): IAnnotation[] {
        let map = this.getOrCreateMapForClassProperties(target);
        if (!map[propertyKey])
            map[propertyKey] = [];
        
        return map[propertyKey];
    }

    private static getOrCreateListForMethod(target : any, methodName : string): IAnnotation[] {
        return this.getOrCreateListForProperty(target, methodName);
    }

    private static getListForMethod(target : any, methodName : string): IAnnotation[] {
        return this.getListForProperty(target, methodName);
    }

    private static getMapForMethodParameters(target : any): IAnnotation[] {
        return target[METHOD_PARAMETER_ANNOTATIONS_KEY];
    }

    private static getOrCreateMapForMethodParameters(target : any): IAnnotation[] {
        if (!target[METHOD_PARAMETER_ANNOTATIONS_KEY])
            Object.defineProperty(target, METHOD_PARAMETER_ANNOTATIONS_KEY, { value: [] });
        return target[METHOD_PARAMETER_ANNOTATIONS_KEY];
    }

    private static getListForMethodParameters(target : any, methodName : string): IAnnotation[][] {
        let map = this.getMapForMethodParameters(target);

        if (!map)
            return null;

        return map[methodName];
    }

    private static getOrCreateListForMethodParameters(target : any, methodName : string): IAnnotation[][] {
        let map = this.getOrCreateMapForMethodParameters(target);
        if (!map[methodName])
            map[methodName] = [];

        return map[methodName];
    }

    private static getOrCreateListForConstructorParameters(target : any): IAnnotation[][] {
        if (!target[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY])
            Object.defineProperty(target, CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY, { value: [] });
        return target[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY];
    }

    private static getListForConstructorParameters(target : any): IAnnotation[][] {
        return target[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY];
    }
}

/**
 * Query annotations for a given target type including only Angular ones
 */
export class AngularAnnotations {
    static getClassAnnotations(target : any) : IAnnotation[] {
        return Annotations.getClassAnnotations(target).filter(x => x['ngMetadataName']);
    }
    
    static getMethodAnnotations(target : any, methodName : string) : IAnnotation[] {
        return Annotations.getMethodAnnotations(target, methodName).filter(x => x['ngMetadataName']);
    }

    static getPropertyAnnotations(target : any, name : string) : IAnnotation[] {
        return Annotations.getPropertyAnnotations(target, name).filter(x => x['ngMetadataName']);
    }
    
    static getParameterAnnotations(target : any, methodName : string) : IAnnotation[][] {
        return Annotations.getParameterAnnotations(target, methodName)
            .map(paramList => (paramList || []).filter(x => x['ngMetadataName']));
    }
}

export function NgMetadataName(name : string) {
    return target => Object.defineProperty(target, 'ngMetadataName', { value: name });
}

@MetadataName('alterior:Label')
export class LabelAnnotation extends Annotation {
    constructor(readonly text : string) {
        super();
    }
}

export const Label = LabelAnnotation.decorator();
