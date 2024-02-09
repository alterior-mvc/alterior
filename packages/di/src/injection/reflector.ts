import { Annotation, Annotations } from '@alterior/annotations';
import { stringify } from 'querystring';
import { ConcreteType, GetterFn, MethodFn, SetterFn, Type, isType } from './type';

/**
 * Provides access to reflection data about symbols.
 * @internal
 */
export class Reflector {
  static readonly instance = new Reflector();

  factory(type: ConcreteType<any>): Function {
    return (...args: any[]) => new type(...args);
  }

  parameters(type: Type<any>): any[][] {
    const paramAnnotations = Annotation.getAllForConstructorParameters(type);
    const paramTypes = Reflect.getOwnMetadata('design:paramtypes', type);
    if (paramTypes || paramAnnotations) {
      return this._zipTypesAndAnnotations(paramTypes, paramAnnotations);
    }
    
    // If a class has no decorators, at least create metadata
    // based on function.length.
    // Note: We know that this is a real constructor as we checked
    // the content of the constructor above.
    return new Array(<any>type.length).fill(undefined);
  }

  private _zipTypesAndAnnotations(paramTypes: any[], paramAnnotations: any[]): any[][] {
    let result: any[][];

    if (typeof paramTypes === 'undefined') {
      result = new Array(paramAnnotations.length);
    } else {
      result = new Array(paramTypes.length);
    }

    for (let i = 0; i < result.length; i++) {
      // TS outputs Object for parameters without types, while Traceur omits
      // the annotations. For now we preserve the Traceur behavior to aid
      // migration, but this can be revisited.
      if (typeof paramTypes === 'undefined') {
        result[i] = [];
        // tslint:disable-next-line:triple-equals
      } else if (paramTypes[i] != Object) {
        result[i] = [paramTypes[i]];
      } else {
        result[i] = [];
      }
      if (paramAnnotations && paramAnnotations[i] != null) {
        result[i] = result[i].concat(paramAnnotations[i]);
      }
    }
    return result;
  }

  annotations(typeOrFunc: Type<any>): any[] {
    return Annotation.getAllForClass(typeOrFunc);
  }

  propMetadata(typeOrFunc: Type<any>): { [key: string]: any[] } {
    if (!isType(typeOrFunc)) {
      return {};
    }

    return Annotations.getMapForClassProperties(typeOrFunc.prototype);
  }

  hasLifecycleHook(type: any, lcProperty: string): boolean {
    return type instanceof Type && lcProperty in type.prototype;
  }

  getter(name: string): GetterFn {
    return <GetterFn>new Function('o', 'return o.' + name + ';');
  }

  setter(name: string): SetterFn {
    return <SetterFn>new Function('o', 'v', 'return o.' + name + ' = v;');
  }

  method(name: string): MethodFn {
    const functionBody = `if (!o.${name}) throw new Error('"${name}" is undefined');
        return o.${name}.apply(o, args);`;
    return <MethodFn>new Function('o', 'args', functionBody);
  }

  resourceUri(type: any): string {
    return `./${stringify(type)}`;
  }

  resolveIdentifier(name: string, moduleUrl: string, members: string[] | null, runtime: any): any {
    return runtime;
  }

  resolveEnum(enumIdentifier: any, name: string): any {
    return enumIdentifier[name];
  }
}
