import { Annotation, Annotations, IAnnotation } from "@alterior/annotations";
import { getParameterNames } from "@alterior/common";

export type Constructor<T> = new(...args) => T;
export type AbstractConstructor<T> = abstract new(...args) => T;
export type AnyConstructor<T> = Constructor<T> | AbstractConstructor<T>;

export type Visibility = 'private' | 'public' | 'protected';

/**
 * Represents a property on a class. A property can also be a field or a method.
 */
export class Property<T>{
    constructor(
        private _type : Constructor<T>,
        private _name : string,
        private _isStatic : boolean = false
    ) {
        this._visibility = _name[0] === '_' ? 'private' : 'public';
    }

    private _visibility : Visibility;
    private _descriptor : PropertyDescriptor = null;
    private _annotations : IAnnotation[];

    defineMetadata(key : string, value : string) {
        Reflect.defineMetadata(key, value, this.type, this.name);
    }

    getMetadata(key : string): any {
        return Reflect.getMetadata(key, this.type, this.name);
    }

    deleteMetadata(key : string) {
        Reflect.deleteMetadata(key, this.type, this.name);
    }

    private _valueType : Type<any>;
    get valueType() : Type<any> {
        if (!this._valueType) {
            let rawType = this.getMetadata('design:type');
            if (!rawType)
                return undefined;
            this._valueType = new Type<any>(rawType);    
        }

        return this._valueType;
    }

    public get isStatic() {
        return this._isStatic;
    }

    protected get type() {
        return this._type;
    }

    get annotations() {
        if (!this._annotations) {
            if (this._name === 'constructor')
                this._annotations = Annotations.getClassAnnotations(this._type);
            else
                this._annotations = Annotations.getPropertyAnnotations(this._type, this.name, this.isStatic);
        }

        return this._annotations;
    }

    annotationsOfType<T extends Annotation>(type : Constructor<T>) : T[] {
        return (type as any).filter(this.annotations);
    }

    annotationOfType<T extends Annotation>(type : Constructor<T>) : T {
        return (type as any).filter(this.annotations)[0];
    }

    get descriptor() : PropertyDescriptor {
        if (!this._descriptor)
            this._descriptor = Object.getOwnPropertyDescriptor(this._type.prototype, this._name);

        return this._descriptor;
    }

    get name() {
        return this._name;
    }

    get visibility() {
        return this._visibility;
    }
}

/**
 * Represents a method on a class. A method can be a static or instance method, and has a set of parameters 
 * and a return type.
 */
export class Method<T> extends Property<T> {
    constructor(
        type : Constructor<T>,
        name : string,
        isStatic : boolean = false
    ) {
        super(type, name, isStatic);
    }

    private _parameterNames : string[];
    private _implementation : Function;

    private _returnType : Type<any>;
    get returnType() : Type<any> {
        if (!this._returnType) {
            let rawType = this.getMetadata('design:returntype');
            if (!rawType)
                return undefined;
            this._returnType = new Type<any>(rawType);    
        }

        return this._returnType;
    }

    private _parameterTypes : Type<any>;
    get parameterTypes() : Type<any> {
        if (!this._parameterTypes) {
            let rawTypes = this.getMetadata('design:paramtypes');
            this._parameterTypes = rawTypes.map(x => x ? new Type<any>(x) : undefined);
        }

        return this._parameterTypes;
    }

    get implementation() : Function {
        return this.type[this.name];
    }

    get parameterNames() {
        if (!this._parameterNames)
            this._parameterNames = getParameterNames(this.implementation);

        return this._parameterNames;
    }

    get parameters(): Parameter<T>[] {
        let parameterNames = this.parameterNames;
        return [...Array(this.implementation.length).keys()]
            .map(i => new Parameter(this, i, parameterNames[i]))
        ;
    }

    private _parameterAnnotations : IAnnotation[][];

    get parameterAnnotations(): IAnnotation[][] {
        if (!this._parameterAnnotations)
            this._parameterAnnotations = Annotations.getParameterAnnotations(this.type, this.name);

        return this._parameterAnnotations;
    }
}

export class Field<T> extends Property<T> {
    constructor(
        type : Constructor<T>,
        name : string,
        isStatic : boolean = false
    ) {
        super(type, name, isStatic);
    }
}

export class ConstructorMethod<T> extends Method<T> {
    constructor(
        type : Constructor<T>
    ) {
        super(type, 'constructor');
    }

    private _ctorParameterAnnotations : IAnnotation[][];
    get parameterAnnotations() {
        if (!this._ctorParameterAnnotations)
            this._ctorParameterAnnotations = Annotations.getConstructorParameterAnnotations(this.type);

        return this._ctorParameterAnnotations;
    }
}

export class Parameter<T> {
    constructor(
        private _method : Method<T>,
        private _index : number,
        private _name : string = null
    ) {
    
    }

    private _annotations : Annotation[];

    get annotations() {
        return this.method.parameterAnnotations[this.index];
    }

    annotationsOfType<T extends Annotation>(type : Constructor<T>) : T[] {
        return (type as any).filter(this.annotations);
    }

    annotationOfType<T extends Annotation>(type : Constructor<T>) : T {
        return (type as any).filter(this.annotations)[0];
    }

    protected get method() {
        return this._method;
    }

    get valueType() {
        return this.method.parameterTypes[this.index];
    }

    get index() {
        return this._index;
    }

    get name() {
        return this._name;
    }
}

/**
 * Represents a class Type and it's metadata
 */
export class Type<T extends Object> {
    constructor(
        private _class : Constructor<T>
    ) {
    }

    private _propertyNames : string[];
    private _methodNames : string[];
    private _fieldNames : string[];
    private _annotations : IAnnotation[];

    get name() {
        return this._class.name;
    }

    getMetadata(key : string) {
        Reflect.getOwnMetadata(key, this._class);
    }

    defineMetadata(key : string, value : any) {
        Reflect.defineMetadata(key, value, this._class.prototype);
    }

    deleteMetadata(key : string) {
        Reflect.deleteMetadata(key, this._class);
    }

    private _metadataKeys : string[];
    get metadataKeys() : string[] {
        if (!this._metadataKeys)
            this._metadataKeys = Reflect.getOwnMetadataKeys(this._class);
     
        return this._metadataKeys;
    }

    /**
     * Get all annotations attached to this class
     */
    get annotations(): IAnnotation[] {
        if (!this._annotations)
            this._annotations = Annotations.getClassAnnotations(this._class);

        return this._annotations;
    }

    annotationsOfType<T extends Annotation>(type : Constructor<T>) : T[] {
        return (type as any).filter(this.annotations);
    }

    annotationOfType<T extends Annotation>(type : Constructor<T>) : T {
        return (type as any).filter(this.annotations)[0];
    }

    private fetchPropertyNames() {
        this._propertyNames = Object.getOwnPropertyNames(this._class.prototype);
        for (let propertyName of this._propertyNames) {
            if (typeof this._class.prototype[propertyName] === 'function') {
                this._methodNames.push(propertyName);
            } else {
                this._fieldNames.push(propertyName);
            }
        }
    }

    private _staticPropertyNames : string[] = [];
    private _staticMethodNames : string[] = [];
    private _staticFieldNames : string[] = [];

    private fetchStaticPropertyNames() {
        this._staticPropertyNames = Object.getOwnPropertyNames(this._class).filter(x => !['length', 'prototype', 'name'].includes(x));
        
        for (let propertyName of this._staticPropertyNames) {
            if (typeof this._class[propertyName] === 'function') {
                this._staticMethodNames.push(propertyName);
            } else {
                this._staticFieldNames.push(propertyName);
            }
        }
    }

    get staticPropertyNames() {
        if (!this._staticPropertyNames)
            this.fetchStaticPropertyNames();

        return this._staticPropertyNames.slice();
    }

    get staticMethodNames() {
        if (!this._staticPropertyNames)
            this.fetchStaticPropertyNames();

        return this._staticMethodNames.slice();
    }

    get staticFieldNames() {
        if (!this._staticPropertyNames)
            this.fetchStaticPropertyNames();

        return this._staticFieldNames.slice();
    }

    private _staticMethods : Method<T>[];
    get staticMethods() : Method<T>[] {
        if (this._staticMethods)
            return this._staticMethods;

        this._staticMethods = this.staticMethodNames.map(methodName => new Method<T>(this._class, methodName, true));

        return this._staticMethods;
    }

    private _staticFields : Field<T>[];
    get staticFields() : Field<T>[] {
        if (this._staticFields)
            return this._staticFields;

        this._staticFields = this.staticFieldNames.map(fieldName => new Field<T>(this._class, fieldName, true));

        return this._staticFields;
    }

    private _staticProperties : Property<T>[];
    get staticProperties() {
        if (this._staticProperties)
            return this._staticProperties;

        this._staticProperties = [].concat(this.staticFields, this.staticMethods);

        return this._staticProperties;
    }

    get propertyNames() {
        if (!this._propertyNames)
            this.fetchPropertyNames();

        return this._propertyNames.slice();
    }

    get methodNames() {
        if (!this._propertyNames)
            this.fetchPropertyNames();

        return this._methodNames.slice();
    }

    get fieldNames() {
        if (!this._propertyNames)
            this.fetchPropertyNames();

        return this._fieldNames.slice();
    }

    private _ctor : ConstructorMethod<T>;
    get constructorMethod() {
        if (!this._ctor)
            this._ctor = new ConstructorMethod<T>(this._class);

        return this._ctor;
    }

    private _methods : Method<T>[];
    get methods() {
        if (this._methods)
            return this._methods;

        this._methods = this.methodNames.map(methodName => new Method<T>(this._class, methodName));

        return this._methods;
    }

    private _properties : Property<T>[];

    get properties() {
        if (this._properties)
            return this._properties;

        this._properties = [].concat(this.fields, this.methods);

        return this._properties;
    }

    private _fields : Field<T>[];

    get fields() {
        if (this._fields)
            return this._fields;

        this._fields = this.fieldNames.map(fieldName => new Field<T>(this._class, fieldName));

        return this._fields;
    }

    get base(): Type<any> {
        return new Type<any>(Object.getPrototypeOf(this._class));
    }
}

export class Reflector {
    getTypeFromInstance<T extends Object = any>(instance : T) : Type<T> {
        return this.getTypeFromClass<T>(instance.constructor as any);
    }

    getTypeFromClass<T extends object = any>(typeClass : Constructor<T>): Type<T> {
        return new Type(typeClass);
    }
}