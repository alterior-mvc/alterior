
export interface TSDocGroup {
    title: string;
    children: number[];
}

export enum ReflectionKind {
    Project = 0x1,
    Module = 0x2,
    Namespace = 0x4,
    Enum = 0x8,
    EnumMember = 0x10,
    Variable = 0x20,
    Function = 0x40,
    Class = 0x80,
    Interface = 0x100,
    Constructor = 0x200,
    Property = 0x400,
    Method = 0x800,
    CallSignature = 0x1000,
    IndexSignature = 0x2000,
    ConstructorSignature = 0x4000,
    Parameter = 0x8000,
    TypeLiteral = 0x10000,
    TypeParameter = 0x20000,
    Accessor = 0x40000,
    GetSignature = 0x80000,
    SetSignature = 0x100000,
    TypeAlias = 0x200000,
    Reference = 0x400000,
}

export interface TSDocElement {
    id: number;
    name: string;
    kind: ReflectionKind;
    variant: string;
    flags: {
        isProtected?: boolean;
        isReadonly?: boolean;
        isConst?: boolean;
        isOptional?: boolean;
        isStatic?: boolean;
    }
    children: TSDocElement[];
    groups: TSDocGroup[];
    sources: TSDocSource[];
    comment?: {
        summary: TSDocTextElement[];
    }
}

export interface TSConstructor extends TSDocDeclaration {
    kind: ReflectionKind.Constructor;
    signatures: TSDocCallSignature[];
}

export interface TSFunction extends TSDocDeclaration {
  kind: ReflectionKind.Function;
  signatures: TSDocCallSignature[];
}


export interface TSVariable extends TSDocDeclaration {
    kind: ReflectionKind.Variable;
    type: TSDocType;
    defaultValue: string;
}

export interface TSClass extends TSDocDeclaration {
    kind: ReflectionKind.Class;
    implementedTypes: TSDocType[];
}

export interface TSInterface extends TSDocDeclaration {
    kind: ReflectionKind.Class;
    implementedTypes: TSDocType[];
}

export interface TSAccessor extends TSDocDeclaration {
    kind: ReflectionKind.Accessor;
    getSignature: TSGetSignature;
    setSignature: TSSetSignature;
}

export interface TSGetSignature extends TSDocDeclaration {
    kind: ReflectionKind.GetSignature;
    type: TSDocType;
}

export interface TSSetSignature extends TSDocDeclaration {
    kind: ReflectionKind.SetSignature;
    parameters: TSDocParam[];
    type: TSDocType;
}

export interface TSDocTypeAlias extends TSDocDeclaration {
    kind: ReflectionKind.TypeAlias;
    type: TSDocType;
}

export interface TSDocMethod extends TSDocDeclaration {
    kind: ReflectionKind.Method;
    signatures: TSDocCallSignature[];
}

export interface TSDocCallSignature extends TSDocElement {
    kind: ReflectionKind.CallSignature;
    variant: 'signature';
    parameters: TSDocParam[];
    type: TSDocType;
}

export interface TSDocParam extends TSDocElement {
    kind: ReflectionKind.Parameter;
    variant: 'param';
    type: TSDocType;
}

export interface TSDocProperty extends TSDocDeclaration {
    kind: ReflectionKind.Property;
    type: TSDocType;
}

export interface TSDocType {
    type: 'intrinsic' | 'reference' | 'reflection' | 'array' | 'union' | 'literal';
    name: string;
    typeArguments: TSDocType[];
}

export interface TSLiteralType extends TSDocType {
    type: 'literal';
    value: any;
}

export interface TSUnionType extends TSDocType {
    type: 'union';
    types: TSDocType[];
}

export interface TSArrayType extends TSDocType {
    type: 'array';
    name: string;
    elementType: TSDocType;
}

export interface TSReflectionType extends TSDocType {
    type: 'reflection';
    declaration: TSDocDeclaration;
}
export interface TSDocIntrinsicType extends TSDocType {
    type: 'intrinsic';
}

export interface TSDocTypeRef extends TSDocType {
    type: 'reference';
    target: number | TSDocSymbolRef;
    package: string;
}

export interface TSDocSource {
    fileName: string;
    line: number;
    character: number;
    url: string;
}

export interface TSDocDeclaration extends TSDocElement {
    variant: 'declaration';
}

export interface TSDocProject extends TSDocElement {
    variant: 'project';
    packageName: string;
    readme: TSDocTextElement[];
}

export interface TSDocTextElement {
    kind: 'text' | 'code';
    text: string;
    symbolIdMap: Record<string, TSDocSymbolRef>;
}

export interface TSDocSymbolRef {
    sourceFileName: string;
    qualifiedName: string;
}

export function is<T>(v: any, discrim: () => boolean): v is T {
    return discrim();
}