import { timingSafeEqual } from 'crypto';
import * as Flags from '../common/flags';

function Flag(value : string) {
    return (target, propertyKey) => {
        target.flagToProperty[value] = propertyKey;
        target.propertyToFlag[propertyKey] = value;
    };
}

export class ReflectedFlags {
    constructor(flags : string) {
        Object.keys(this.flagToProperty)
            .forEach(flag => this[this.flagToProperty[flag]] = flags.includes(flag));
    }
    
    private flagToProperty : Record<string, string>;
    private propertyToFlag : Record<string, string>;

    @Flag(Flags.F_READONLY) isReadonly : boolean;
    @Flag(Flags.F_ABSTRACT) isAbstract : boolean;
    @Flag(Flags.F_PUBLIC) isPublic : boolean;
    @Flag(Flags.F_PRIVATE) isPrivate : boolean;
    @Flag(Flags.F_PROTECTED) isProtected : boolean;
    @Flag(Flags.F_PROPERTY) isProperty : boolean;
    @Flag(Flags.F_METHOD) isMethod : boolean;
    @Flag(Flags.F_CLASS) isClass : boolean;
    @Flag(Flags.F_OPTIONAL) isOptional : boolean;
    @Flag(Flags.F_ASYNC) isAsync : boolean;

    toString() {
        return Object.keys(this.propertyToFlag)
            .map(property => this[property] ? this.propertyToFlag[property] : '')
            .join('');
    }

}

export type Visibility = 'public' | 'private' | 'protected';

export class ReflectedMethod {
    constructor(
        reflectedClass : ReflectedClass,
        readonly name : string
    ) {
        this._flags = new ReflectedFlags(Reflect.getMetadata('rt:f', reflectedClass.class.prototype, name));
    }

    private _class : ReflectedClass;
    private _flags : ReflectedFlags;

    get flags(): Readonly<ReflectedFlags> {
        return this._flags;
    }

    get class() {
        return this._class;
    }

    get isReadonly() {
        return this.flags.isReadonly;
    }

    get isAbstract() {
        return this.flags.isAbstract;
    }

    get isAsync() {
        return this.flags.isAsync;
    }

    get isPrivate() {
        return this.flags.isPrivate;
    }

    get isPublic() {
        return this.flags.isPublic;
    }

    get isProtected() {
        return this.flags.isProtected;
    }

    get visibility(): Visibility {
        return this.isPublic ? 'public' 
             : this.isProtected ? 'protected' 
             : this.isPrivate ? 'private' 
             : 'public';
    }

    get isOptional() {
        return this._flags.isOptional;
    }
}

export interface Constructor<T> extends Function {
    new(...args) : T;
}

export class ReflectedProperty {
    constructor(
        reflectedClass : ReflectedClass,
        readonly name : string
    ) {
    }

    private _flags : ReflectedFlags;
    private _class : ReflectedClass;
    private _type : Function;

    get type(): Function {
        if (this._type)
            return this._type;

        return this._type = Reflect.getMetadata('rt:t', this.class.class.prototype, this.name);
    }

    get flags(): Readonly<ReflectedFlags> {
        if (this._flags)
            return this._flags;
        return this._flags = new ReflectedFlags(Reflect.getMetadata('rt:f', this.class.class.prototype, this.name));
    }

    get class() {
        return this._class;
    }

    get isAbstract() {
        return this.flags.isAbstract;
    }

    get isReadonly() {
        return this.flags.isReadonly;
    }

    get isPrivate() {
        return this.flags.isPrivate;
    }

    get isPublic() {
        return this.flags.isPublic;
    }

    get isProtected() {
        return this.flags.isProtected;
    }

    get visibility(): Visibility {
        return this.isPublic ? 'public' 
             : this.isProtected ? 'protected' 
             : this.isPrivate ? 'private' 
             : 'public';
    }
}

export class ReflectedClass<ClassT = Function> {
    constructor(
        klass : Constructor<ClassT>
    ) {

    }

    _class : Constructor<ClassT>;
    _isAbstract : boolean;

    get class() {
        return this._class;
    }

    get isAbstract() {
        return this._isAbstract;
    }

    private _super : ReflectedClass;

    get super() : ReflectedClass {
        if (this._super !== undefined)
            return this._super;

        let parentClass = Object.getPrototypeOf(this.class.prototype).constructor;
        if (parentClass === Object)
            return this._super = null;
        else
            return this._super = new ReflectedClass(parentClass);
    }

    private _methods : ReflectedMethod[];
    private _ownPropertyNames : string[];
    private _ownMethodNames : string[];

    get ownPropertyNames(): string[] {
        if (this._ownPropertyNames)
            return this._ownPropertyNames;
        
        return this._ownPropertyNames = Reflect.getMetadata('rt:p', this.class);
    }

    get ownMethodNames(): string[] {
        if (this._ownMethodNames)
            return this._ownMethodNames;
        
        return this._ownMethodNames = Reflect.getMetadata('rt:m', this.class);
    }

    private _methodNames : string[];

    get methodNames(): string[] {
        if (this._methodNames)
            return this._methodNames;
           
        if (this.super) {
            return this._methodNames = this.super.methodNames.concat(this.ownMethodNames);
        } else {
            return this._methodNames = this.ownMethodNames;
        }
    }

    private _propertyNames : string[];

    get propertyNames(): string[] {
        if (this._propertyNames)
            return this._propertyNames;

        if (this.super) {
            return this._propertyNames = this.super.propertyNames.concat(this.ownPropertyNames);
        } else {
            return this._propertyNames = this.ownPropertyNames;
        }
    }

    private _ownMethods : ReflectedMethod[];

    get ownMethods(): ReflectedMethod[] {
        if (this._ownMethods)
            return this._ownMethods;

        return this._ownMethods = this.ownMethodNames.map(name => new ReflectedMethod(<any>this, name));
    }

    get methods(): ReflectedMethod[] {
        if (this._methods)
            return this._methods;
        
        if (this.super)
            return this._methods = this.super.methods.concat(this.methods);
        else
            return this._methods = this.ownMethods;
    }
}
