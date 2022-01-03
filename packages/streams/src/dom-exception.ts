export const AltErrorNamesTable = {
    "IndexSizeError": 1,
    "HierarchyRequestError": 3,
    "WrongDocumentError": 4,
    "InvalidCharacterError": 5,
    "NoModificationAllowedError": 7,
    "NotFoundError": 8,
    "NotSupportedError": 9,
    "InUseAttributeError": 10,
    "InvalidStateError": 11,
    "SyntaxError": 12,
    "InvalidModificationError": 13,
    "NamespaceError": 14,
    "InvalidAccessError": 15,
    "TypeMismatchError": 17,
    "SecurityError": 18,
    "NetworkError": 19,
    "AbortError": 20,
    "URLMismatchError": 21,
    "QuotaExceededError": 22,
    "TimeoutError": 23,
    "InvalidNodeTypeError": 24,
    "DataCloneError": 25,
    "EncodingError": undefined,
    "NotReadableError": undefined,
    "UnknownError": undefined,
    "ConstraintError": undefined,
    "DataError": undefined,
    "TransactionInactiveError": undefined,
    "ReadOnlyError": undefined,
    "VersionError": undefined,
    "OperationError": undefined,
    "NotAllowedError": undefined
};

export class AltDOMException extends Error implements DOMException {
    constructor(message : string, name : string) {
        super(message);
        this.#name = name;
    }

    get code() {
        return AltErrorNamesTable[this.#name];
    }
    
    INDEX_SIZE_ERR = 1; static INDEX_SIZE_ERR = 1;
    DOMSTRING_SIZE_ERR = 2; static DOMSTRING_SIZE_ERR = 2;
    HIERARCHY_REQUEST_ERR = 3; static HIERARCHY_REQUEST_ERR = 3;
    WRONG_DOCUMENT_ERR = 4; static WRONG_DOCUMENT_ERR = 4;
    INVALID_CHARACTER_ERR = 5; static INVALID_CHARACTER_ERR = 5;
    NO_DATA_ALLOWED_ERR = 6; static NO_DATA_ALLOWED_ERR = 6;
    NO_MODIFICATION_ALLOWED_ERR = 7; static NO_MODIFICATION_ALLOWED_ERR = 7;
    NOT_FOUND_ERR = 8; static NOT_FOUND_ERR = 8;
    NOT_SUPPORTED_ERR = 9; static NOT_SUPPORTED_ERR = 9;
    INUSE_ATTRIBUTE_ERR = 10; static INUSE_ATTRIBUTE_ERR = 10;
    INVALID_STATE_ERR = 11; static INVALID_STATE_ERR = 11;
    SYNTAX_ERR = 12; static SYNTAX_ERR = 12;
    INVALID_MODIFICATION_ERR = 13; static INVALID_MODIFICATION_ERR = 13;
    NAMESPACE_ERR = 14; static NAMESPACE_ERR = 14;
    INVALID_ACCESS_ERR = 15; static INVALID_ACCESS_ERR = 15;
    VALIDATION_ERR = 16; static VALIDATION_ERR = 16;
    TYPE_MISMATCH_ERR = 17; static TYPE_MISMATCH_ERR = 17;
    SECURITY_ERR = 18; static SECURITY_ERR = 18;
    NETWORK_ERR = 19; static NETWORK_ERR = 19;
    ABORT_ERR = 20; static ABORT_ERR = 20;
    URL_MISMATCH_ERR = 21; static URL_MISMATCH_ERR = 21;
    QUOTA_EXCEEDED_ERR = 22; static QUOTA_EXCEEDED_ERR = 22;
    TIMEOUT_ERR = 23; static TIMEOUT_ERR = 23;
    INVALID_NODE_TYPE_ERR = 24; static INVALID_NODE_TYPE_ERR = 24;
    DATA_CLONE_ERR = 25; static DATA_CLONE_ERR = 25;

    #name : string;

    get name() { return this.#name; }
}
