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

export const rttiTransformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    function literalNode(node : ts.Node) {
        return { $__isTSNode: true, node };
    }

    function serialize(object : any): ts.Expression {
        if (object === null)
            return ts.factory.createNull();
        if (object === undefined)
            return ts.factory.createVoidZero();
        
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

    function metadataDecorator(key : string, object : any) {
        return ts.factory.createDecorator(
            ts.factory.createCallExpression(
                ts.factory.createIdentifier('__metadata'), [],
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

    function extractPropertyMetadata(property : ts.PropertyDeclaration) {
        return [
            metadataDecorator('rt:f', `P${getVisibility(property.modifiers)}${isReadOnly(property.modifiers)}`)
        ];
    }

    function extractClassMetadata(klass : ts.ClassDeclaration) {
        return [
            metadataDecorator('rt:f', `C${getVisibility(klass.modifiers)}${isAbstract(klass.modifiers)}`)
        ];
    }

    function extractMethodMetadata(method : ts.MethodDeclaration) {
        return [
            metadataDecorator('rt:f', `M${getVisibility(method.modifiers)}${isAbstract(method.modifiers)}`),
        ];
    }

    let trace = false;

    return sourceFile => {
        const visitor = (node : ts.Node) => {
            if (!node)
                return;
             
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

        return ts.visitNode(sourceFile, visitor);
    };
}