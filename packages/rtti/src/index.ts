/**
 * RTTI Transformer
 * 
 * This Typescript transformer does two things:
 * 1. Emits Typescript's "design:*" metadata on all syntactic elements processed during a compilation,
 *    regardless of whether a decorator is originally present on the element
 * 2. Emits an "rt:f" metadata on each syntactic element which describes compile-time semantics of an element,
 *    including element type, public, private, protected, abstract, readonly
 * 
 * The meaning of "rt:f" is as follows:
 * - The value is a string which is a set of "flags" that describe the element. A flag is set if its corresponding
 *   character is present in the string.
 *       $: public (properties, methods)
 *       @: protected (properties, methods)
 *       #: private (properties, methods)
 *       R: readonly (properties)
 *       A: abstract (classes, methods)
 *       P: element is a property
 *       C: element is a class
 *       M: element is a method
 * 
 */

import * as ts from 'typescript';

interface TypeImport {
    importDeclaration : ts.ImportDeclaration;
    refName : string;
    isNamespace : boolean;
    referenced? : boolean;
    name : string;
    localName : string;
}

const transformer: (program : ts.Program) => ts.TransformerFactory<ts.SourceFile> = (program : ts.Program) => {

    let emitStandardMetadata = program.getCompilerOptions().emitDecoratorMetadata;
    program.getCompilerOptions().emitDecoratorMetadata = false;

    const rttiTransformer: ts.TransformerFactory<ts.SourceFile> = (context : ts.TransformationContext) => {
        function literalNode(node : ts.Node) {
            return { $__isTSNode: true, node };
        }

        function serialize(object : any): ts.Expression {
            if (object === null)
                return ts.factory.createNull();
            if (object === undefined)
                return ts.factory.createVoidZero();
            
            if (object instanceof Array)
                return ts.factory.createArrayLiteralExpression(object.map(x => serialize(x)));
            if (typeof object === 'string')
                return ts.factory.createStringLiteral(object);
            if (typeof object === 'number')
                return ts.factory.createNumericLiteral(object);
            if (typeof object === 'boolean')
                return object ? ts.factory.createTrue() : ts.factory.createFalse();
            if (typeof object === 'function')
                throw new Error(`Cannot serialize a function`);
            if (object.$__isTSNode)
                return object.node;
            
            let props : ts.ObjectLiteralElementLike[] = [];
            for (let key of Object.keys(object))
                props.push(ts.factory.createPropertyAssignment(key, serialize(object[key])));

            return ts.factory.createObjectLiteralExpression(props, false);
        }

        function nothingDecorator() {
            return [ts.factory.createDecorator(
                ts.factory.createCallExpression(
                    ts.factory.createParenthesizedExpression(
                        ts.factory.createArrowFunction(
                            [], [], [], null, 
                            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), 
                            ts.factory.createBlock([]))
                    ), [], []
                )
            )]
        }

        function forwardRef(expr : ts.Expression) {
            if (!expr)
                throw new Error(`Cannot make forwardRef without an expression`);
            return ts.factory.createArrowFunction(
                [], [], [], null, 
                ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), 
                expr
            );
        }

        function metadataDecorator(key : string, object : any) {
            let metadataFuncExpr : ts.Expression = ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier('Reflect'),
                ts.factory.createIdentifier('metadata')
            );

            return ts.factory.createDecorator(
                ts.factory.createCallExpression(
                    metadataFuncExpr, [],
                    [
                        ts.factory.createStringLiteral(key),
                        serialize(object)
                    ]
                )
            )
        }

        function getVisibility(modifiers : ts.ModifiersArray) {
            if (modifiers) {
                if (modifiers.some(x => x.kind === ts.SyntaxKind.PublicKeyword))
                    return '$';
                if (modifiers.some(x => x.kind === ts.SyntaxKind.PrivateKeyword))
                    return '#';
                if (modifiers.some(x => x.kind === ts.SyntaxKind.ProtectedKeyword))
                    return '@';
            }

            return '$';
        }

        function isReadOnly(modifiers : ts.ModifiersArray) {
            if (!modifiers)
                return '';
            
            return modifiers.some(x => x.kind === ts.SyntaxKind.ReadonlyKeyword) ? 'R' : '';
        }

        function isAbstract(modifiers : ts.ModifiersArray) {
            if (!modifiers)
                return '';
            
            return modifiers.some(x => x.kind === ts.SyntaxKind.AbstractKeyword) ? 'A' : '';
        }


        let trace = false;

        return sourceFile => {
            let importMap = new Map<string,TypeImport>();
        
            function extractPropertyMetadata(property : ts.PropertyDeclaration) {
                return [
                    metadataDecorator('rt:f', `P${getVisibility(property.modifiers)}${isReadOnly(property.modifiers)}`)
                ];
            }
        
            function getRootNameOfQualifiedName(qualifiedName : ts.QualifiedName) {
                if (ts.isQualifiedName(qualifiedName.left))
                    return getRootNameOfQualifiedName(qualifiedName.left);
                else if (ts.isIdentifier(qualifiedName.left))
                    return qualifiedName.left.text;
            }

            function getRootNameOfEntityName(entityName : ts.EntityName) {
                if (ts.isQualifiedName(entityName)) {
                    return getRootNameOfQualifiedName(entityName);
                } else if (ts.isIdentifier(entityName)) {
                    return entityName.text;
                }
            }

            function assureTypeAvailable(entityName : ts.EntityName) {
                let rootName = getRootNameOfEntityName(entityName);
                let impo = importMap.get(rootName);
                if (impo) {
                    impo.referenced = true;
                    return impo.localName;
                }

                return null;
            }

            function cloneQualifiedName(qualifiedName : ts.QualifiedName, rootName? : string) {
                let left : ts.Expression;
                if (ts.isIdentifier(qualifiedName.left)) {
                    left = ts.factory.createIdentifier(rootName);
                } else {
                    left = cloneEntityNameAsExpr(qualifiedName.left, rootName)   
                }
                return ts.factory.createPropertyAccessExpression(left, cloneEntityNameAsExpr(qualifiedName.right));
            }

            function cloneEntityNameAsExpr(entityName : ts.EntityName, rootName? : string) {
                if (ts.isQualifiedName(entityName))
                    return cloneQualifiedName(entityName, rootName);
                else if (ts.isIdentifier(entityName))
                    return ts.factory.createIdentifier(entityName.text);
            }

            function serializeTypeRef(typeNode : ts.Node): ts.Expression {
                if (!typeNode)
                    return ts.factory.createVoidZero();
                
                if (ts.isTypeReferenceNode(typeNode)) {
                    return cloneEntityNameAsExpr(typeNode.typeName, assureTypeAvailable(typeNode.typeName));
                }

                throw new Error(`Failed to serializeTypeRef for kind ${ts.SyntaxKind[typeNode.kind]}!`);
            }

            function extractClassMetadata(klass : ts.ClassDeclaration) {
                let decs : ts.Decorator[] = [];

                let constructor = klass.members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;
                
                if (constructor) {
                    let serializedParamTypes : ts.Expression[] = [];
                    for (let param of constructor.parameters) {
                        let paramType = serializeTypeRef(param.type);
                        if (!paramType) {
                            console.error(`Failed to serialize parameter type for param ${param.name.getText()}:`)
                            console.dir(param.type);
                            throw new Error(`Could not serialize parameter type`);
                        }
                        serializedParamTypes.push(paramType);
                    }

                    decs.push(metadataDecorator('rt:t', serializedParamTypes.map(t => literalNode(forwardRef(t)))));
                    if (emitStandardMetadata) {
                        decs.push(metadataDecorator('design:paramtypes', serializedParamTypes.map(t => literalNode(t))));
                    }
                }

                decs.push(metadataDecorator('rt:f', `C${getVisibility(klass.modifiers)}${isAbstract(klass.modifiers)}`));

                return decs;
            }
        
            function extractMethodMetadata(method : ts.MethodDeclaration) {
                let decs : ts.Decorator[] = [];
                
                let typeRef = serializeTypeRef(method.type);
                if (typeRef) {
                    decs.push(metadataDecorator('rt:t', literalNode(forwardRef(typeRef))));
                    if (emitStandardMetadata)
                        decs.push(metadataDecorator('design:returntype', literalNode(typeRef)));
                }
                
                decs.push(metadataDecorator('rt:f', `M${getVisibility(method.modifiers)}${isAbstract(method.modifiers)}`));

                return decs;
            }
            
            const visitor = (node : ts.Node) => {
                if (!node)
                    return;

                if (ts.isImportDeclaration(node)) {
                    if (node.importClause) {
                        let bindings = node.importClause.namedBindings;
                        if (ts.isNamedImports(bindings)) {
                            for (let binding of bindings.elements) {
                                importMap.set(binding.name.text, {
                                    name: binding.name.text,
                                    localName: `${binding.propertyName?.text ?? binding.name.text}Φ`,
                                    refName: binding.name.text,
                                    isNamespace: false,
                                    importDeclaration: node
                                });
                            }
                        } else if (ts.isNamespaceImport(bindings)) {
                            importMap.set(bindings.name.text, {
                                name: bindings.name.text,
                                localName: `${bindings.name.text}Φ`,
                                refName: bindings.name.text,
                                isNamespace: true,
                                importDeclaration: node
                            })
                            bindings.name
                        }
                    }
                }
                 
                if (ts.isPropertyDeclaration(node)) {
                    if (trace)
                        console.log(`Decorating property ${node.parent.name.text}#${node.name.getText()}`);
                    node = ts.factory.updatePropertyDeclaration(
                        node, 
                        [ ...(node.decorators || []), ...extractPropertyMetadata(node) ], 
                        node.modifiers, 
                        node.name, 
                        node.questionToken || node.exclamationToken, 
                        node.type,
                        node.initializer
                    )
                } else if (ts.isClassDeclaration(node)) {
                    if (trace)
                        console.log(`Decorating class ${node.name.text}`);
                    node = ts.factory.updateClassDeclaration(
                        node, 
                        [ ...(node.decorators || []), ...extractClassMetadata(node) ],
                        node.modifiers,
                        node.name,
                        node.typeParameters,
                        node.heritageClauses,
                        node.members
                    );
                } else if (ts.isMethodDeclaration(node)) {
                    if (trace)
                        console.log(`Decorating method ${ts.isClassDeclaration(node.parent) ? node.parent.name.text : '<anon>'}#${node.name.getText()}`);
                    node = ts.factory.updateMethodDeclaration(
                        node,
                        [ ...(node.decorators || []), ...extractMethodMetadata(node) ],
                        node.modifiers,
                        node.asteriskToken,
                        node.name,
                        node.questionToken,
                        node.typeParameters,
                        node.parameters,
                        node.type,
                        node.body
                    );
                }

                return ts.visitEachChild(node, visitor, context);
            };

            function generateImports(statements : ts.Statement[]): ts.Statement[] {
                let imports : ts.ImportDeclaration[] = [];
                for (let impo of importMap.values()) {
                    if (!impo.referenced)
                        continue;
                       
                    let ownedImpo = ts.factory.createImportDeclaration(
                        undefined, 
                        undefined, 
                        ts.factory.createImportClause(
                            false, undefined, 

                            impo.isNamespace 
                                ? ts.factory.createNamespaceImport(ts.factory.createIdentifier(impo.localName))
                                : ts.factory.createNamedImports(
                                    [
                                        ts.factory.createImportSpecifier(
                                            ts.factory.createIdentifier(impo.refName),
                                            ts.factory.createIdentifier(impo.localName)
                                        )
                                    ]
                                )
                        ),
                        ts.factory.createStringLiteral(
                            (<ts.StringLiteral>impo.importDeclaration.moduleSpecifier).text
                        )
                    );

                    let impoIndex = statements.indexOf(impo.importDeclaration);
                    if (impoIndex >= 0) {
                        statements.splice(impoIndex, 0, ownedImpo);
                    } else {
                        statements.splice(0, 0, ownedImpo);
                    }
                }

                return statements;
            }

            sourceFile = ts.visitNode(sourceFile, visitor);

            sourceFile = ts.factory.updateSourceFile(
                sourceFile, 
                generateImports(Array.from(sourceFile.statements)), 
                sourceFile.isDeclarationFile, 
                sourceFile.referencedFiles,
                sourceFile.typeReferenceDirectives,
                sourceFile.hasNoDefaultLib,
                sourceFile.libReferenceDirectives
            );

            return sourceFile;
        };
    }

    return rttiTransformer;
};

export default transformer;