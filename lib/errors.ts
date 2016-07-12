export class PgError extends Error {
	name: string;
	cause: Error;
	
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		if (typeof messageOrCause === 'string'){
			super(messageOrCause);
			this.cause = cause;
		}
		else {
			super(messageOrCause.message);
			this.cause = messageOrCause;
		}
		Error.captureStackTrace(this, this.constructor);
	}
}

export class ConnectionError extends PgError {
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		super(messageOrCause as any, cause);
		this.name = 'Connection Error';
	}
}

export class TransactionError extends PgError {
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		super(messageOrCause as any, cause);
		this.name = 'Transaction Error';
	}
}

export class QueryError extends PgError {
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		super(messageOrCause as any, cause);
		this.name = 'Query Error';
	}
}

export class ParseError extends PgError {
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		super(messageOrCause as any, cause);
		this.name = 'Parse Error';
	}
}