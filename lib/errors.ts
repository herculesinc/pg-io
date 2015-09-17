export class PgError extends Error {
	name: string;
	cause: Error;
	stack: any;
	
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
	}
}

export class ConnectionError extends PgError {
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		super(messageOrCause as any, cause);
		this.name = 'ConnectionError';
		(Error as any).captureStackTrace(this, ConnectionError);
	}
}

export class TransactionError extends PgError {
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		super(messageOrCause as any, cause);
		this.name = 'TransactionError';
		(Error as any).captureStackTrace(this, TransactionError);
	}
}

export class QueryError extends PgError {
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		super(messageOrCause as any, cause);
		this.name = 'QueryError';
		(Error as any).captureStackTrace(this, QueryError);
	}
}

export class ParseError extends PgError {
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		super(messageOrCause as any, cause);
		this.name = 'ParseError';
		(Error as any).captureStackTrace(this, ParseError);
	}
}