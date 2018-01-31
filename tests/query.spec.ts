// IMPORTS
// ================================================================================================
import * as assert from 'assert';
import { Query, toDbQuery } from './../lib/Query'
import { QueryError } from './../lib/errors'

// TESTS
// ================================================================================================
describe('Query parameterization tests', function() {
    
    it('Numbers, booleans, and safe strings should be inlined', () => {
		var query: Query = {
			text: 'SELECT * FROM users WHERE id = {{id}} AND is_active = {{isActive}} AND type = {{type}};',
			params: {
				id: 1,
				isActive: true,
				type: 'personal'
			}
		};
		
		var dbQuery = toDbQuery(query);
		assert.equal(dbQuery.text, `SELECT * FROM users WHERE id = 1 AND is_active = true AND type = 'personal';\n`);
		assert.strictEqual(dbQuery.values, undefined);
    });
   
	it('Dates should be inlined', () => {
		var activationDate = new Date();
		var query: Query = {
			text: 'SELECT * FROM users WHERE activated_on = {{activatedOn}};',
			params: {
				activatedOn: activationDate
			}
		};
		
		var dbQuery = toDbQuery(query);
		assert.equal(dbQuery.text, `SELECT * FROM users WHERE activated_on = '${activationDate.toISOString()}';\n`);
		assert.strictEqual(dbQuery.values, undefined);
    });
    
	it('Queries with unsafe strings should be converted to parametrized queries', () => {
		var query: Query = {
			text: 'SELECT * FROM users WHERE firstName={{firstName}} AND lastName={{lastName}};',
			params: {
				firstName: `F'irst`,
				lastName: `L'ast`
			}
		};
		
		var dbQuery = toDbQuery(query);
		assert.equal(dbQuery.text, `SELECT * FROM users WHERE firstName=$1 AND lastName=$2;\n`);
		assert.strictEqual(dbQuery.values.length, 2);
		assert.strictEqual(dbQuery.values[0], `F'irst`);
		assert.strictEqual(dbQuery.values[1], `L'ast`);
    });
	
	it('Number array parameters should be inlined', () => {
		var query: Query = {
			text: 'SELECT * FROM users WHERE id IN ([[ids]]);',
			params: {
				ids: [1, 2]
			}
		};
		
		var dbQuery = toDbQuery(query);
		assert.equal(dbQuery.text, `SELECT * FROM users WHERE id IN (1,2);\n`);
		assert.strictEqual(dbQuery.values, undefined);
    });
	
	it('Parametrizing arrays as objects should work correctly', () => {
		var query: Query = {
			text: 'UPDATE users SET tags={{tags}} WHERE id={{id}};',
			params: {
				id: 1,
				tags: ['test', 'testing']
			}
		};
		
		var dbQuery = toDbQuery(query);
		assert.equal(dbQuery.text, `UPDATE users SET tags='["test","testing"]' WHERE id=1;\n`);
		assert.strictEqual(dbQuery.values, undefined);
    });
	
	it('Safe string array parameters should be inlined', () => {
		var query: Query = {
			text: 'SELECT * FROM users WHERE type IN ([[types]]);',
			params: {
				types: ['personal', 'business']
			}
		};
		
		var dbQuery = toDbQuery(query);
		assert.equal(dbQuery.text, `SELECT * FROM users WHERE type IN ('personal','business');\n`);
		assert.strictEqual(dbQuery.values, undefined);
    });
	
	it('Unsafe string array parameters should be converted to parametrized queries', () => {
		var query: Query = {
			text: 'SELECT * FROM users WHERE firstName IN ([[names]]);',
			params: {
				names: [
					'Irakliy',
					`T'est`,
					'Yason',
					`Te'st`,
					`Tes't`
				]
			}
		};
		
		var dbQuery = toDbQuery(query);
		assert.equal(dbQuery.text, `SELECT * FROM users WHERE firstName IN ('Irakliy',$1,'Yason',$2,$3);\n`);
		assert.strictEqual(dbQuery.values.length, 3);
		assert.strictEqual(dbQuery.values[0], `T'est`);
		assert.strictEqual(dbQuery.values[1], `Te'st`);
		assert.strictEqual(dbQuery.values[2], `Tes't`);
    });
	
	it('Parameterization should rely on valueOf() method when available', () => {
		
		var userStatus = {
			valueOf: function () {
				return 1;
			}
		}
		var query: Query = {
			text: 'SELECT * FROM users WHERE status = {{status}};',
			params: {
				status: userStatus
			}
		};
		
		var dbQuery = toDbQuery(query);
		assert.equal(dbQuery.text, `SELECT * FROM users WHERE status = 1;\n`);
		assert.strictEqual(dbQuery.values, undefined);
    });
	
	it('Parameterization of object with unsefe results for valueOf() should result in parametrized query', () => {
		
		var userStatus = {
			valueOf: function () {
				return `Te'st`;
			}
		}
		var query: Query = {
			text: 'SELECT * FROM users WHERE status = {{status}};',
			params: {
				status: userStatus
			}
		};
		
		var dbQuery = toDbQuery(query);
		assert.equal(dbQuery.text, `SELECT * FROM users WHERE status = $1;\n`);
		assert.strictEqual(dbQuery.values.length, 1);
		assert.strictEqual(dbQuery.values[0], `Te'st`);
    });
	
	it('Parameterization of safe objects should be inlined', () => {
		var query: Query = {
			text: 'SELECT * FROM users WHERE profile = {{profile}};',
			params: {
				profile: {
					firstName: 'Test',
					lastName: 'Testing'
				}
			}
		};
		
		var dbQuery = toDbQuery(query);
		assert.equal(dbQuery.text, `SELECT * FROM users WHERE profile = '{"firstName":"Test","lastName":"Testing"}';\n`);
		assert.strictEqual(dbQuery.values, undefined);
    });
	
	it('Parameterization of unsafe objects should result in a parametrized query', () => {
		var query: Query = {
			text: 'SELECT * FROM users WHERE profile = {{profile}};',
			params: {
				profile: {
					firstName: `T'est`,
					lastName: `T'esting`
				}
			}
		};
		
		var dbQuery = toDbQuery(query);
		assert.equal(dbQuery.text, `SELECT * FROM users WHERE profile = $1;\n`);
		assert.strictEqual(dbQuery.values.length, 1);
		assert.strictEqual(dbQuery.values[0], `{"firstName":"T'est","lastName":"T'esting"}`)
    });
	
	it('Parameterization with functions should throw an error', () => {
		var activationDate = new Date();
		var query: Query = {
			text: 'SELECT * FROM users WHERE activated_on = {{activatedOn}};',
			params: {
				activatedOn: function (){ return new Date(); }
			}
		};
		
		assert.throws(() => {
			var dbQuery = toDbQuery(query);	
		}, QueryError);
    });
	
	it('Parameterization with arrays of mixed type should throw an error', () => {
		var activationDate = new Date();
		var query: Query = {
			text: 'SELECT * FROM users WHERE activated_on = [[activatedOn]];',
			params: {
				activatedOn: [ 1, 'test' ]
			}
		};
		
		assert.throws(() => {
			var dbQuery = toDbQuery(query);	
		}, QueryError);
    });
	
	it('Parameterization with arrays of objects should throw an error', () => {
		var activationDate = new Date();
		var query: Query = {
			text: 'SELECT * FROM users WHERE activated_on = [[activatedOn]];',
			params: {
				activatedOn: [ {
					test: 'test'
				} ]
			}
		};
		
		assert.throws(() => {
			var dbQuery = toDbQuery(query);	
		}, QueryError);
    });
	
	it('Parameterization of objects as arrays should throw an error', () => {
		var activationDate = new Date();
		var query: Query = {
			text: 'SELECT * FROM users WHERE activated_on = [[activatedOn]];',
			params: {
				activatedOn: {
					test: 'test'
				}
			}
		};
		
		assert.throws(() => {
			var dbQuery = toDbQuery(query);	
		}, QueryError);
    });
});