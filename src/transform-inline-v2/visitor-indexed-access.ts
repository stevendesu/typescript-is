import * as ts from 'typescript';
import * as tsutils from 'tsutils';
import { VisitorContext } from './visitor-context';
import * as VisitorUtils from './visitor-utils';

function visitRegularObjectType(type: ts.ObjectType, indexType: ts.Type, visitorContext: VisitorContext) {
    // TODO: { ... }[I]
    throw new Error('Not yet implemented.');
}

function visitTupleObjectType(type: ts.ObjectType, indexType: ts.Type, visitorContext: VisitorContext) {
    // TODO: [T, U][I]
    type Foo = [number, string];
    type Bar = Foo[2];
    type Baz = Foo[any];
    return VisitorUtils.getNumberFunction(visitorContext);
}

function visitArrayObjectType(type: ts.ObjectType, indexType: ts.Type, visitorContext: VisitorContext) {
    // TODO: Array<T>[I]
    return VisitorUtils.getNumberFunction(visitorContext);
}

function visitObjectType(type: ts.ObjectType, indexType: ts.Type, visitorContext: VisitorContext) {
    if (tsutils.isTupleType(type)) {
        // Tuple with finite length.
        return visitTupleObjectType(type, indexType, visitorContext);
    } else if (visitorContext.checker.getIndexTypeOfType(type, ts.IndexKind.Number)) {
        // Index type is number -> array type.
        return visitArrayObjectType(type, indexType, visitorContext);
    } else {
        // Index type is string -> regular object type.
        return visitRegularObjectType(type, indexType, visitorContext);
    }
}

function visitUnionOrIntersectionType(type: ts.UnionOrIntersectionType, indexType: ts.Type, visitorContext: VisitorContext) {
    const name = VisitorUtils.getFullTypeName(type, visitorContext, 'keyof');
    if (!visitorContext.functionMap.has(name)) {
        const functionDeclarations = type.types.map((type) => visitType(type, indexType, visitorContext));

        if (tsutils.isUnionType(type)) {
            // (T | U)[I] = T[I] & U[I]
            visitorContext.functionMap.set(
                name,
                VisitorUtils.createConjunctionFunction(functionDeclarations, name)
            );
        } else {
            // (T & U)[I] = T[I] | U[I]
            visitorContext.functionMap.set(
                name,
                VisitorUtils.createDisjunctionFunction(functionDeclarations, name)
            );
        }
    }
    return visitorContext.functionMap.get(name)!;
}

function visitIndexType(): ts.FunctionDeclaration {
    // (keyof U)[T] is an error (actually it can be String.toString or String.valueOf but we don't support this edge case)
    throw new Error('Index types cannot be used as indexed types.');
}

function visitNonPrimitiveType(): ts.FunctionDeclaration {
    // object[T] is an error
    throw new Error('Non-primitive object cannot be used as an indexed type.');
}

function visitLiteralType(): ts.FunctionDeclaration {
    // 'string'[T] or 0xFF[T] is an error
    throw new Error('Literal strings/numbers cannot be used as an indexed type.');
}

function visitTypeReference(type: ts.TypeReference, indexType: ts.Type, visitorContext: VisitorContext) {
    const mapping: Map<ts.Type, ts.Type> = VisitorUtils.getTypeReferenceMapping(type, visitorContext);
    const previousTypeReference = visitorContext.previousTypeReference;
    visitorContext.typeMapperStack.push(mapping);
    visitorContext.previousTypeReference = type;
    const result = visitType(type.target, indexType, visitorContext);
    visitorContext.previousTypeReference = previousTypeReference;
    visitorContext.typeMapperStack.pop();
    return result;
}

function visitTypeParameter(type: ts.Type, indexType: ts.Type, visitorContext: VisitorContext) {
    const mappedType = VisitorUtils.getResolvedTypeParameter(type, visitorContext);
    if (mappedType === undefined) {
        throw new Error('Unbound type parameter, missing type node.');
    }
    return visitType(mappedType, indexType, visitorContext);
}

function visitBigInt(): ts.FunctionDeclaration {
    // bigint[T] is an error
    throw new Error('BigInt cannot be used as an indexed type.');
}

function visitBoolean(): ts.FunctionDeclaration {
    // boolean[T] is an error
    throw new Error('Boolean cannot be used as an indexed type.');
}

function visitString(): ts.FunctionDeclaration {
    // string[T] is an error
    throw new Error('String cannot be used as an indexed type.');
}

function visitBooleanLiteral(): ts.FunctionDeclaration {
    // true[T] or false[T] is an error
    throw new Error('True/false cannot be used as an indexed type.');
}

function visitNumber(): ts.FunctionDeclaration {
    // number[T] is an error
    throw new Error('Number cannot be used as an indexed type.');
}

function visitUndefined(): ts.FunctionDeclaration {
    // undefined[T] is an error
    throw new Error('Undefined cannot be used as an indexed type.');
}

function visitNull(): ts.FunctionDeclaration {
    // null[T] is an error
    throw new Error('Null cannot be used as an indexed type.');
}

function visitNever(visitorContext: VisitorContext) {
    // never[T] = never
    return VisitorUtils.getNeverFunction(visitorContext);
}

function visitUnknown(visitorContext: VisitorContext) {
    // unknown[T] = unknown
    return VisitorUtils.getUnknownFunction(visitorContext);
}

function visitAny(visitorContext: VisitorContext) {
    // any[T] = any
    return VisitorUtils.getAnyFunction(visitorContext);
}

export function visitType(type: ts.Type, indexType: ts.Type, visitorContext: VisitorContext): ts.FunctionDeclaration {
    if ((ts.TypeFlags.Any & type.flags) !== 0) {
        // Any
        return visitAny(visitorContext);
    } else if ((ts.TypeFlags.Unknown & type.flags) !== 0) {
        // Unknown
        return visitUnknown(visitorContext);
    } else if ((ts.TypeFlags.Never & type.flags) !== 0) {
        // Never
        return visitNever(visitorContext);
    } else if ((ts.TypeFlags.Null & type.flags) !== 0) {
        // Null
        return visitNull();
    } else if ((ts.TypeFlags.Undefined & type.flags) !== 0) {
        // Undefined
        return visitUndefined();
    } else if ((ts.TypeFlags.Number & type.flags) !== 0) {
        // Number
        return visitNumber();
    } else if ((ts.TypeFlags.BigInt & type.flags) !== 0) {
        // BigInt
        return visitBigInt();
    } else if ((ts.TypeFlags.Boolean & type.flags) !== 0) {
        // Boolean
        return visitBoolean();
    } else if ((ts.TypeFlags.String & type.flags) !== 0) {
        // String
        return visitString();
    } else if ((ts.TypeFlags.BooleanLiteral & type.flags) !== 0) {
        // Boolean literal (true/false)
        return visitBooleanLiteral();
    } else if (tsutils.isTypeReference(type) && visitorContext.previousTypeReference !== type) {
        // Type references.
        return visitTypeReference(type, indexType, visitorContext);
    } else if ((ts.TypeFlags.TypeParameter & type.flags) !== 0) {
        // Type parameter
        return visitTypeParameter(type, indexType, visitorContext);
    } else if (tsutils.isObjectType(type)) {
        // Object type (including interfaces, arrays, tuples)
        if ((ts.ObjectFlags.Class & type.objectFlags) !== 0) {
            throw new Error('Classes cannot be validated. Please check the README.');
        } else {
            return visitObjectType(type, indexType, visitorContext);
        }
    } else if (tsutils.isLiteralType(type)) {
        // Literal string/number types ('foo')
        return visitLiteralType();
    } else if (tsutils.isUnionOrIntersectionType(type)) {
        // Union or intersection type (| or &)
        return visitUnionOrIntersectionType(type, indexType, visitorContext);
    } else if ((ts.TypeFlags.NonPrimitive & type.flags) !== 0) {
        // Non-primitive such as object
        return visitNonPrimitiveType();
    } else if ((ts.TypeFlags.Index & type.flags) !== 0) {
        // Index type: keyof T
        return visitIndexType();
    } else if (tsutils.isIndexedAccessType(type)) {
        // Indexed access type: T[U]
        // return visitIndexedAccessType(type, visitorContext);
        // TODO:
        throw new Error('Not yet implemented.');
    } else {
        throw new Error('Could not generate type-check; unsupported type with flags: ' + type.flags);
    }
}