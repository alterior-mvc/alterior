export class BaseError extends Error {
    constructor(message: string, options?: any) {
        super(message, options);
    }

    static serializer: (instance: any) => any;
    static setJSONSerializer(serializer: (instance: any) => any) {
        this.serializer = serializer;
    }

    asJSON() {
        if (BaseError.serializer)
            return BaseError.serializer(this);
        
        let ownKeys = Object.getOwnPropertyNames(this);
        let repr = {
            $type: this.constructor.name,
            error: true,
            message: this.message,
            stack: this['stack']
        };
        
        let includedData = ownKeys
            .filter(x => !x.startsWith('_'))
            .filter(x => typeof (this as any)[x] !== 'function')
            .map(x => [x, (this as any)[x]])
            .reduce((pv, cv) => pv[cv[0]] = cv[1], <Record<string, unknown>>{})
        ;

        return Object.assign({}, repr, includedData);
    }
}

/**
 * Base class for errors thrown by the system or framework
 */
export class SystemError extends BaseError {
}

/**
 * Base class for errors thrown by your application
 */
export class ApplicationError extends BaseError {
}

export class ArgumentError<ValueT = any> extends SystemError {
    constructor(argumentName: string, message?: string) {
        super(message || `Invalid value for argument ${argumentName}`);
        this._argumentName = argumentName;
    }

    private _argumentName: string;
    private _value?: ValueT;

    /**
     * The invalid value passed for the given argument
     */
    get value(): ValueT | undefined {
        return this._value;
    }

    withValue(value: ValueT): this {
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
    constructor(argumentName: string, message?: string) {
        super(argumentName, message || `Argument ${argumentName} cannot be null`);
    }
}

export class ArgumentOutOfRangeError<ValueT = any> extends ArgumentError<ValueT> {
    constructor(argumentName: string, message?: string) {
        super(argumentName, message || `Argument ${argumentName} is out of range`);
    }
}

export class NotSupportedError extends SystemError {
    constructor(message?: string) {
        super(message || `The requested operation is not supported.`);
    }
}

export class NotImplementedError extends SystemError {
    constructor(message?: string) {
        super(message || `The requested operation is not implemented.`);
    }
}

export class OperationCanceledError extends SystemError {
    constructor(message?: string) {
        super(message || `The requested operation is not implemented.`);
    }
}

export class TimeoutError extends SystemError {
    constructor(message?: string) {
        super(message || `The operation has timed out.`);
    }
}

export class IOError extends SystemError {
    constructor(message?: string) {
        super(message || `An I/O error has occurred.`);
    }
}

export class FormatError extends SystemError {
    constructor(message?: string) {
        super(message || `Invalid format.`);
    }
}

export class InvalidOperationError extends SystemError {
    constructor(message?: string) {
        super(message || `Invalid format.`);
    }
}

export class AccessDeniedError extends SystemError {
    constructor(message?: string) {
        super(message || `Invalid format.`);
    }
}

export class HttpError extends Error {
	constructor(
        public statusCode: number, 
        public body: any, 
        public headers: string[][] = []
    ) {
        super(`HttpError statusCode=${statusCode} [are you sure you meant to catch this?]`);
	}
}