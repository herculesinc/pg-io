import * as util from 'util';

export class PgError {
	message: string;
	
	constructor(message: string) {
		Error.call(this);
		this.message = message;
	}
}

util.inherits(PgError, Error);