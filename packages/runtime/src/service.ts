import { MetadataName, Annotation } from '@alterior/annotations';
import { Type } from '@alterior/di';

export interface MethodShimParam {
    name : string;
    type : Type;
}

export interface MethodShim {
    name : string;
    params : MethodShimParam[];
    target : Type;
    body : string;
}

export abstract class ServiceCompiler {
    abstract compileMethod(method : MethodShim) : void;
}

export interface ServiceOptions {
    compiler: Type<ServiceCompiler>;
}

@MetadataName('@alterior/runtime:Service')
export class ServiceAnnotation extends Annotation implements ServiceOptions {
    constructor(options? : ServiceOptions) {
        super(options);
    }

    compiler : Type<ServiceCompiler>;
}

export const Service = ServiceAnnotation.decorator();