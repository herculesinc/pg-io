import * as util from 'util';

export class PgError extends Error {
	name: string;
	cause: Error;
	stack: any;
	
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		super(typeof messageOrCause === 'string'? messageOrCause : messageOrCause.message);
		this.name = 'PgError';
		
		if (typeof messageOrCause === 'string') {
			this.message = messageOrCause;
			if (cause) {
				this.cause = cause;
				this.message += ': ' + cause.message;
			}	
		}
		else {
			this.message = messageOrCause.message;
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

export class ConnectionStateError extends PgError {
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		super(messageOrCause as any, cause);
		this.name = 'ConnectionStateError';
		(Error as any).captureStackTrace(this, ConnectionStateError);
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