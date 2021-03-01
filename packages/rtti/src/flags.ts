import ts from 'typescript';

export const F_READONLY = 'R';
export const F_ABSTRACT = 'A';
export const F_PUBLIC = '$';
export const F_PRIVATE = '#';
export const F_PROTECTED = '@';
export const F_PROPERTY = 'P';
export const F_METHOD = 'M';
export const F_CLASS = 'C';
export const F_OPTIONAL = '?';


export function getVisibility(modifiers : ts.ModifiersArray) {
    if (modifiers) {
        if (modifiers.some(x => x.kind === ts.SyntaxKind.PublicKeyword))
            return F_PUBLIC;
        if (modifiers.some(x => x.kind === ts.SyntaxKind.PrivateKeyword))
            return F_PRIVATE;
        if (modifiers.some(x => x.kind === ts.SyntaxKind.ProtectedKeyword))
            return F_PROTECTED;
    }

    return F_PUBLIC;
}

export function isReadOnly(modifiers : ts.ModifiersArray) {
    if (!modifiers)
        return '';
    
    return modifiers.some(x => x.kind === ts.SyntaxKind.ReadonlyKeyword) ? F_READONLY : '';
}

export function isAbstract(modifiers : ts.ModifiersArray) {
    if (!modifiers)
        return '';
    
    return modifiers.some(x => x.kind === ts.SyntaxKind.AbstractKeyword) ? F_ABSTRACT : '';
}