export type BaseError = BaseErrorT | Error;

export class BaseErrorT {
    constructor(message : string) {
        this._message = message;
    }

    private _message : string;
    private _innerError : BaseError;

    private causedBy(error : BaseError): this {
        this._innerError = error;
        return this;
    }

    get message(): string {
        return this._message;
    }

    get innerError(): BaseError {
        return this._innerError;
    }
}

export class SystemError extends BaseErrorT {
}

export class ApplicationError extends BaseErrorT {
}

export class ArgumentError<ValueT = any> extends SystemError {
    constructor(argumentName : string, message? : string) {
        super(message || `Invalid value for argument ${argumentName}`);
        this._argumentName = argumentName;
    }

    private _argumentName : string;
    private _value : ValueT;

    /**
     * The invalid value passed for the given argument
     */
    get value(): ValueT {
        return this._value;
    }

    withValue(value : ValueT): this {
        this._value = value;
        return this;
    }

    /**
     * The name of the argument
     */
    get argumentName() {
        return this._argumentName;
    }
}

export class ArgumentNullError<ValueT = any> extends ArgumentError<ValueT> {
    constructor(argumentName : string, message? : string) {
        super(argumentName, message || `Argument ${argumentName} cannot be null`);
    }
}

export class ArgumentOutOfRangeError<ValueT = any> extends ArgumentError<ValueT> {
    constructor(argumentName : string, message? : string) {
        super(argumentName, message || `Argument ${argumentName} is out of range`);
    }
}

export class NotSupportedError extends SystemError {
    constructor(message? : string) {
        super(message || `The requested operation is not supported.`);
    }
}

export class NotImplementedException extends SystemError {
    constructor(message? : string) {
        super(message || `The requested operation is not implemented.`);
    }
}

export class OperationCanceledException extends SystemError {
    constructor(message? : string) {
        super(message || `The requested operation is not implemented.`);
    }
}

export class TimeoutError extends SystemError {
    constructor(message? : string) {
        super(message || `The operation has timed out.`);
    }
}

export class IOError extends SystemError {
    constructor(message? : string) {
        super(message || `An I/O error has occurred.`);
    }
}

export class FormatError extends SystemError {
    constructor(message? : string) {
        super(message || `Invalid format.`);
    }
}

export class HttpError {
	constructor(public statusCode : number, public headers : string[][], public body : any) {
	}
}