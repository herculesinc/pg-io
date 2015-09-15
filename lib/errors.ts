import * as util from 'util';

// TODO: create more specialized errors

export class PgError {
	message: string;
	
	constructor(message: string) {
		Error.call(this);
		this.message = message;
	}
}

util.inherits(PgError, Error);