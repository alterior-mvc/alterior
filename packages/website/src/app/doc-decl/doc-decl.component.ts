import { Component, Input } from '@angular/core';
import { ReflectionKind, TSAccessor, TSArrayType, TSClass, TSConstructor, TSDocCallSignature, TSDocElement, TSDocMethod, TSDocParam, TSDocProject, TSDocProperty, TSDocTextElement, TSDocType, TSDocTypeAlias, TSDocTypeRef, TSFunction, TSInterface, TSLiteralType, TSReflectionType, TSUnionType, TSVariable, is } from '../tsdoc';
import { SyntaxElement } from '../doc-syntax/doc-syntax.component';

@Component({
    selector: 'alt-doc-decl',
    templateUrl: './doc-decl.component.html',
    styleUrl: './doc-decl.component.scss'
})
export class DocDeclComponent {

    syntax: SyntaxElement[] = [];
    children: TSDocElement[] = [];
    comment: string;

    private _decl: TSDocElement;
    @Input() get decl() { return this._decl; }
    set decl(decl) {
        this._decl = decl;

        if (is<TSDocMethod>(decl, () => decl.kind === ReflectionKind.Method)) {
            this.children = decl.signatures;
        } else {
            this.syntax = this.emitDecl(decl);
        }
        if (is<TSDocProject>(decl, () => decl.kind === ReflectionKind.Project)) {
            this.comment = this.getMarkdown(decl.readme);
        } else if (decl.comment) {
            this.comment = this.getMarkdown(decl.comment?.summary);
        }
    }

    readonly branch = '4.x';

    getUrl() {
        return this.decl.sources[0].url;
        //return `https://github.com/alterior-mvc/alterior/blob/${this.branch}/${this.decl.sources[0].fileName}#L${this.decl.sources[0].line}`;
    }

    getMarkdown(elem: TSDocTextElement[]) {
        if (!elem)
            return undefined;
        return elem.map(x => x.text).join('');
    }

    private emitDecl(decl: TSDocElement) {
        let syntax: SyntaxElement[] = [];

        if (this.decl.flags.isProtected)
            this.addKeyword('protected');
        if (this.decl.flags.isStatic)
            this.addKeyword('static');
        if (this.decl.flags.isReadonly)
            this.addKeyword('readonly');

        console.log(`Decl:`);
        console.dir(decl);

        if (is<TSAccessor>(decl, () => decl.kind === ReflectionKind.Accessor)) {
            // this and also TODO TypeLiteral
            
            if (decl.getSignature) {
                syntax.push({ text: 'get ', keyword: true });
                syntax.push({ text: decl.name, keyword: true });
                syntax.push({ text: '(): ' });
                syntax.push(...this.formatType(decl.getSignature.type));
                syntax.push({ text: ';\n' });
            }

            if (decl.setSignature) {
                syntax.push({ text: 'set ', keyword: true });
                syntax.push({ text: decl.name, keyword: true });
                syntax.push({ text: '(' });
                syntax.push(...this.emitParams(decl.setSignature.parameters));
                syntax.push({ text: ')' });
            }
        } else if (is<TSVariable>(decl, () => decl.kind === ReflectionKind.Variable)) {

            if (decl.flags.isConst) {
                syntax.push({ text: 'const ', keyword: true });
            } else {
                syntax.push({ text: 'let ', keyword: true });
            }

            syntax.push({ text: decl.name });

            if (decl.type) {
                syntax.push({ text: ': '});
                syntax.push(...this.formatType(decl.type));
            }

            if (decl.defaultValue) {
                syntax.push({ text: ` = ${decl.defaultValue}` });
            }

            syntax.push({ text: ';' });

        } else if (is<TSClass>(decl, () => decl.kind === ReflectionKind.Class)) {
            syntax.push({ text: 'class ', keyword: true });
            syntax.push({ text: decl.name });
            if (decl.implementedTypes?.length > 0) {
                syntax.push({ text: ' extends ', keyword: true });
                for (let i = 0, max = decl.implementedTypes.length; i < max; ++i) {
                    syntax.push(...this.formatType(decl.implementedTypes[i]));
                    if (i + 1 < max)
                        syntax.push({ text: ', ' });
                }
            }

            syntax.push({ text: ' {\n    // ...\n}' });
        } else if (is<TSInterface>(decl, () => decl.kind === ReflectionKind.Interface)) {
            syntax.push({ text: 'interface ', keyword: true });
            syntax.push({ text: decl.name });
            if (decl.implementedTypes?.length > 0) {
                syntax.push({ text: ' extends ', keyword: true });
                for (let i = 0, max = decl.implementedTypes.length; i < max; ++i) {
                    syntax.push(...this.formatType(decl.implementedTypes[i]));
                    if (i + 1 < max)
                        syntax.push({ text: ', ' });
                }
            }

            syntax.push({ text: ' {\n    // ...\n}' });
        } else if (is<TSDocProperty>(decl, () => decl.kind === ReflectionKind.Property)) {
            syntax.push({ text: decl.name });
            if (this.decl.flags.isOptional)
                syntax.push({ text: '?' });
            syntax.push({ text: ': ' });
            syntax.push(...this.formatType(decl.type));
        } else if (is<TSConstructor>(decl, () => decl.kind === ReflectionKind.Constructor)) {
            for (let sig of decl.signatures) {
                syntax.push(...this.formatConstructorSignature(sig, decl.name))
                syntax.push({ text: '\n' });
            }
        } else if (is<TSDocTypeAlias>(decl, () => decl.kind === ReflectionKind.TypeAlias)) {
            syntax.push({ text: 'type ' });
            syntax.push({ text: decl.name });
            syntax.push({ text: ' = ' });
            syntax.push(...this.formatType(decl.type));
            syntax.push({ text: ': ' });
            syntax.push(...this.formatType(decl.type));
        } else if (is<TSDocMethod>(decl, () => decl.kind === ReflectionKind.Method)) {
            for (let sig of decl.signatures) {
                syntax.push(...this.formatMethodSignature(sig, decl.name))
                syntax.push({ text: '\n' });
            }
        } else if (is<TSDocCallSignature>(decl, () => decl.kind === ReflectionKind.CallSignature)) {
            syntax.push(...this.formatMethodSignature(decl, decl.name));
        } else if (is<TSDocCallSignature>(decl, () => decl.kind === ReflectionKind.ConstructorSignature)) {
            syntax.push(...this.formatConstructorSignature(decl, decl.name));
        }

        console.dir(syntax);

        return syntax;
    }

    private formatConstructorSignature(sig: TSDocCallSignature, name: string) {
        let syntax: SyntaxElement[] = [];

        syntax.push({ text: 'new ' });
        syntax.push({ text: sig.type.name });
        syntax.push({ text: '(' });
        syntax.push(...this.emitParams(sig.parameters));
        syntax.push({ text: ');' });

        return syntax;
    }

    private emitParams(params: TSDocParam[]) {
        if (!params)
            return [];

        let syntax: SyntaxElement[] = [];

        for (let i = 0, max = params.length; i < max; ++i) {
            let param = params[i];
            let last = i + 1 >= params.length;

            syntax.push({ text: param.name });
            syntax.push({ text: ': ' });
            syntax.push(...this.formatType(param.type));

            if (!last)
                syntax.push({ text: ', ' });
        }

        return syntax;
    }

    private formatFunctionSignature(sig: TSDocCallSignature, name: string) {
        let syntax: SyntaxElement[] = [];

        syntax.push({ text: name });
        syntax.push({ text: '(' });
        
        syntax.push(...this.emitParams(sig.parameters));
        
        syntax.push({ text: '): ' });
        syntax.push(...this.formatType(sig.type));
        syntax.push({ text: ';' });

        return syntax;
    }

    private formatMethodSignature(sig: TSDocCallSignature, name: string) {
        let syntax: SyntaxElement[] = [];

        syntax.push({ text: name });
        syntax.push({ text: '(' });
        
        syntax.push(...this.emitParams(sig.parameters));
        
        syntax.push({ text: '): ' });
        syntax.push(...this.formatType(sig.type));
        syntax.push({ text: ';' });

        return syntax;
    }

    private formatType(type: TSDocType) {
        let syntax: SyntaxElement[] = [];

        if (!type) {
            console.warn(`No doc type presented!`);
            syntax.push({ text: 'unknown' });
            return syntax;
        }

        if (is<TSReflectionType>(type, () => type.type === 'reflection')) {
            syntax.push(...this.emitDecl(type.declaration));
            //syntax.push({ text: '(reflection type)' });
        } else if (type.type === 'intrinsic') {
            syntax.push({ text: type.name, intrinsic: true });
        } else if (is<TSLiteralType>(type, () => type.type === 'literal')) {
            syntax.push({ text: JSON.stringify(type.value, undefined, 2) });
        } else if (type.type === 'reference') {
            syntax.push({
                text: type.name,
                link: this.getUrlForType(type),
                externalLink: this.getUrlForType(type)?.startsWith('https:')
            });
        } else if (is<TSArrayType>(type, () => type.type === 'array')) {
            syntax.push(...this.formatType(type.elementType));
            syntax.push({ text: `[]` });
        } else if (is<TSUnionType>(type, () => type.type === 'union')) {
            for (let i = 0, max = type.types.length; i < max; ++i) {
                syntax.push(...this.formatType(type.types[i]));
                if (i + 1 < max)
                    syntax.push({ text: ' | ' });
            }
        } else {
            syntax.push({ text: `(${type.type} ${type.name})` })
        }

        if (type.typeArguments?.length > 0) {
            syntax.push({ text: '<' });
            for (let arg of type.typeArguments) {
                syntax.push(...this.formatType(arg));
            }
            syntax.push({ text: '>' });
        }

        return syntax;
    }

    getUrlForType(type: TSDocType) {
        if (is<TSDocTypeRef>(type, () => type.type === 'reference')) {

            if (type.package === 'typescript' && typeof type.target === 'object') {
                let filename = type.target.sourceFileName.replace(/.*\//, '');

                if (filename.startsWith('lib.es') || filename.startsWith('lib.dom')) {
                    return `https://developer.mozilla.org/en-US/docs/Web/API/${type.name}`;
                }

                if (filename === `lib.decorators.legacy.d.ts`) {
                    if (type.name === 'ParameterDecorator')
                        return `https://www.typescriptlang.org/docs/handbook/decorators.html#parameter-decorators`;
                    else if (type.name === 'MethodDecorator')
                        return `https://www.typescriptlang.org/docs/handbook/decorators.html#method-decorators`;
                    else if (type.name === 'ClassDecorator')
                        return `https://www.typescriptlang.org/docs/handbook/decorators.html#class-decorators`;
                    return `https://www.typescriptlang.org/docs/handbook/decorators.html`;
                }

                return `https://www.typescriptlang.org/docs/handbook`;
            }

            return `/packages/${type.package.replace(/.*\//, '')}/${type.name}`;
        }

        return undefined;
    }

    private addKeyword(keyword: string) {
        this.syntax.push({ text: keyword, keyword: true });
        this.syntax.push({ text: ' ' });
    }

    isKind<T extends TSDocElement>(element: TSDocElement, kind: ReflectionKind): element is T {
        return element.kind === kind;
    }

    isProperty(element: TSDocElement): element is TSDocProperty {
        return element.kind === ReflectionKind.Property;
    }

    isMethod(element: TSDocElement): element is TSDocMethod {
        return element.kind === ReflectionKind.Method;
    }
}
