/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { global, isPresent, stringify } from '../facade/lang';
import { Type, isType } from '../facade/type';

import { PlatformReflectionCapabilities } from './platform_reflection_capabilities';
import { GetterFn, MethodFn, SetterFn } from './types';
import { Annotation, Annotations } from '@alterior/annotations';

/**
 * Attention: This regex has to hold even if the code is minified!
 */
export const DELEGATE_CTOR = /^function\s+\S+\(\)\s*{[\s\S]+\.apply\(this,\s*arguments\)/;

export class ReflectionCapabilities implements PlatformReflectionCapabilities {
  private _reflect: any;

  constructor(reflect?: any) {
    this._reflect = reflect || global['Reflect'];
  }

  isReflectionEnabled(): boolean {
    return true;
  }

  factory<T>(t: Type<T>): (args: any[]) => T {
    return (...args: any[]) => new t(...args);
  }

  /** @internal */
  _zipTypesAndAnnotations(paramTypes: any[], paramAnnotations: any[]): any[][] {
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

  annotations(typeOrFunc: Type<any>): any[] {
    return Annotation.getAllForClass(typeOrFunc);
  }

  private _ownPropMetadata(typeOrFunc: any, parentCtor: any): { [key: string]: any[] } | null {
    // Prefer the direct API.
    if ((<any>typeOrFunc).propMetadata && (<any>typeOrFunc).propMetadata !== parentCtor.propMetadata) {
      let propMetadata = (<any>typeOrFunc).propMetadata;
      if (typeof propMetadata === 'function' && propMetadata.propMetadata) {
        propMetadata = propMetadata.propMetadata;
      }
      return propMetadata;
    }

    // API of tsickle for lowering decorators to properties on the class.
    if ((<any>typeOrFunc).propDecorators && (<any>typeOrFunc).propDecorators !== parentCtor.propDecorators) {
      const propDecorators = (<any>typeOrFunc).propDecorators;
      const propMetadata = <{ [key: string]: any[] }>{};
      Object.keys(propDecorators).forEach(prop => {
        propMetadata[prop] = convertTsickleDecoratorIntoMetadata(propDecorators[prop]);
      });
      return propMetadata;
    }

    // API for metadata created by invoking the decorators.
    if (this._reflect && this._reflect.getOwnMetadata) {
      return this._reflect.getOwnMetadata('propMetadata', typeOrFunc);
    }
    return null;
  }

  propMetadata(typeOrFunc: any): { [key: string]: any[] } {
    if (!isType(typeOrFunc)) {
      return {};
    }

    return Annotations.getMapForClassProperties(typeOrFunc.prototype);

    const parentCtor = getParentCtor(typeOrFunc);
    const propMetadata: { [key: string]: any[] } = {};
    if (parentCtor !== Object) {
      const parentPropMetadata = this.propMetadata(parentCtor);
      Object.keys(parentPropMetadata).forEach(propName => {
        propMetadata[propName] = parentPropMetadata[propName];
      });
    }
    const ownPropMetadata = this._ownPropMetadata(typeOrFunc, parentCtor);
    if (ownPropMetadata) {
      Object.keys(ownPropMetadata).forEach(propName => {
        const decorators: any[] = [];
        if (propMetadata.hasOwnProperty(propName)) {
          decorators.push(...propMetadata[propName]);
        }
        decorators.push(...ownPropMetadata[propName]);
        propMetadata[propName] = decorators;
      });
    }
    return propMetadata;
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

  // There is not a concept of import uri in Js, but this is useful in developing Dart applications.
  importUri(type: any): string {
    // StaticSymbol
    if (typeof type === 'object' && type['filePath']) {
      return type['filePath'];
    }
    // Runtime type
    return `./${stringify(type)}`;
  }

  resourceUri(type: any): string {
    return `./${stringify(type)}`;
  }

  resolveIdentifier(name: string, moduleUrl: string, members: string[], runtime: any): any {
    return runtime;
  }
  resolveEnum(enumIdentifier: any, name: string): any {
    return enumIdentifier[name];
  }
}

function convertTsickleDecoratorIntoMetadata(decoratorInvocations: any[]): any[] {
  if (!decoratorInvocations) {
    return [];
  }
  return decoratorInvocations.map(decoratorInvocation => {
    const decoratorType = decoratorInvocation.type;
    const annotationCls = decoratorType.annotationCls;
    const annotationArgs = decoratorInvocation.args ? decoratorInvocation.args : [];
    return new annotationCls(...annotationArgs);
  });
}

function getParentCtor(ctor: Function): Type<any> {
  const parentProto = Object.getPrototypeOf(ctor.prototype);
  const parentCtor = parentProto ? parentProto.constructor : null;
  // Note: We always use `Object` as the null value
  // to simplify checking later on.
  return parentCtor || Object;
}
