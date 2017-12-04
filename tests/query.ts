// IMPORTS
// ================================================================================================
import * as assert from 'assert';
import { Query, toPgQuery } from './../lib/Query'
import { QueryError } from './../lib/errors'

// TESTS
// ================================================================================================
describe('Query parameterization tests', function() {
    
    it('Numbers, booleans, and safe strings should be inlined', () => {
		const template = Query.template('SELECT * FROM users WHERE id = {{id}} AND is_active = {{isActive}} AND type = {{type}};');
		const query = new template({
			id: 1,
			isActive: true,
			type: 'personal'
		});
		
		const pgQuery = toPgQuery(query);
		assert.equal(pgQuery.text, `SELECT * FROM users WHERE id = 1 AND is_active = true AND type = 'personal';\n`);
		assert.strictEqual(pgQuery.values, undefined);
    });
   
	it('Dates should be inlined', () => {
		const activationDate = new Date();
		const template = Query.template('SELECT * FROM users WHERE activated_on = {{activatedOn}};');
		const query = new template({
			activatedOn: activationDate
		});
		
		const pgQuery = toPgQuery(query);
		assert.equal(pgQuery.text, `SELECT * FROM users WHERE activated_on = '${activationDate.toISOString()}';\n`);
		assert.strictEqual(pgQuery.values, undefined);
    });
    
	it('Queries with unsafe strings should be converted to parametrized queries', () => {
		const template = Query.template('SELECT * FROM users WHERE firstName={{firstName}} AND lastName={{lastName}};');
		const query = new template({
			firstName: `F'irst`,
			lastName: `L'ast`
		});
		
		const pgQuery = toPgQuery(query);
		assert.equal(pgQuery.text, `SELECT * FROM users WHERE firstName=$1 AND lastName=$2;\n`);
		assert.strictEqual(pgQuery.values.length, 2);
		assert.strictEqual(pgQuery.values[0], `F'irst`);
		assert.strictEqual(pgQuery.values[1], `L'ast`);
    });
	
	it('Number array parameters should be inlined', () => {
		const template = Query.template('SELECT * FROM users WHERE id IN ([[ids]]);');
		const query = new template({
			ids: [1, 2]
		});
		
		const pgQuery = toPgQuery(query);
		assert.equal(pgQuery.text, `SELECT * FROM users WHERE id IN (1,2);\n`);
		assert.strictEqual(pgQuery.values, undefined);
    });
	
	it('Parametrizing arrays as objects should work correctly', () => {
		const template = Query.template('UPDATE users SET tags={{tags}} WHERE id={{id}};');
		const query = new template({
			id: 1,
			tags: ['test', 'testing']
		});
		
		const pgQuery = toPgQuery(query);
		assert.equal(pgQuery.text, `UPDATE users SET tags='["test","testing"]' WHERE id=1;\n`);
		assert.strictEqual(pgQuery.values, undefined);
    });
	
	it('Safe string array parameters should be inlined', () => {
		const template = Query.template('SELECT * FROM users WHERE type IN ([[types]]);');
		const query = new template({
			types: ['personal', 'business']
		});

		const pgQuery = toPgQuery(query);
		assert.equal(pgQuery.text, `SELECT * FROM users WHERE type IN ('personal','business');\n`);
		assert.strictEqual(pgQuery.values, undefined);
    });
	
	it('Unsafe string array parameters should be converted to parametrized queries', () => {
		const template = Query.template('SELECT * FROM users WHERE firstName IN ([[names]]);');
		const query = new template({
			names: [
				'Irakliy',
				`T'est`,
				'Yason',
				`Te'st`,
				`Tes't`
			]
		});
		
		const pgQuery = toPgQuery(query);
		assert.equal(pgQuery.text, `SELECT * FROM users WHERE firstName IN ('Irakliy',$1,'Yason',$2,$3);\n`);
		assert.strictEqual(pgQuery.values.length, 3);
		assert.strictEqual(pgQuery.values[0], `T'est`);
		assert.strictEqual(pgQuery.values[1], `Te'st`);
		assert.strictEqual(pgQuery.values[2], `Tes't`);
    });
	
	it('Parameterization should rely on valueOf() method when available', () => {
		const template = Query.template('SELECT * FROM users WHERE status = {{status}};');
		const query = new template({
			status: {
				valueOf: function () {
					return 1;
				}
			}
		});

		const pgQuery = toPgQuery(query);
		assert.equal(pgQuery.text, `SELECT * FROM users WHERE status = 1;\n`);
		assert.strictEqual(pgQuery.values, undefined);
    });
	
	it('Parameterization of object with unsefe results for valueOf() should result in parametrized query', () => {
		const template = Query.template('SELECT * FROM users WHERE status = {{status}};');
		const query = new template({
			status: {
				valueOf: function () {
					return `Te'st`;
				}
			}
		});
		
		const pgQuery = toPgQuery(query);
		assert.equal(pgQuery.text, `SELECT * FROM users WHERE status = $1;\n`);
		assert.strictEqual(pgQuery.values.length, 1);
		assert.strictEqual(pgQuery.values[0], `Te'st`);
    });
	
	it('Parameterization of safe objects should be inlined', () => {
		const template = Query.template('SELECT * FROM users WHERE profile = {{profile}};');
		const query = new template({
			profile: {
				firstName: 'Test',
				lastName: 'Testing'
			}
		});
				
		const pgQuery = toPgQuery(query);
		assert.equal(pgQuery.text, `SELECT * FROM users WHERE profile = '{"firstName":"Test","lastName":"Testing"}';\n`);
		assert.strictEqual(pgQuery.values, undefined);
    });
	
	it('Parameterization of unsafe objects should result in a parametrized query', () => {
		const template = Query.template('SELECT * FROM users WHERE profile = {{profile}};');
		const query = new template({
			profile: {
				firstName: `T'est`,
				lastName: `T'esting`
			}
		});
		
		const pgQuery = toPgQuery(query);
		assert.equal(pgQuery.text, `SELECT * FROM users WHERE profile = $1;\n`);
		assert.strictEqual(pgQuery.values.length, 1);
		assert.strictEqual(pgQuery.values[0], `{"firstName":"T'est","lastName":"T'esting"}`)
    });
	
	it('Parameterization with functions should throw an error', () => {
		const template = Query.template('SELECT * FROM users WHERE activated_on = {{activatedOn}};');
		const query = new template({
			activatedOn: function (){ return new Date(); }
		});
		
		assert.throws(() => {
			const pgQuery = toPgQuery(query);	
		}, QueryError);
    });
	
	it('Parameterization with arrays of mixed type should throw an error', () => {
		const template = Query.template('SELECT * FROM users WHERE activated_on = [[activatedOn]];');
		const query = new template({
			activatedOn: [ 1, 'test' ]
		});
		
		assert.throws(() => {
			const pgQuery = toPgQuery(query);	
		}, QueryError);
    });
	
	it('Parameterization with arrays of objects should throw an error', () => {
		const template = Query.template('SELECT * FROM users WHERE activated_on = [[activatedOn]];');
		const query = new template({
			activatedOn: [ {
				test: 'test'
			} ]
		});
		
		assert.throws(() => {
			const pgQuery = toPgQuery(query);	
		}, QueryError);
    });
	
	it('Parameterization of objects as arrays should throw an error', () => {
		const template = Query.template('SELECT * FROM users WHERE activated_on = [[activatedOn]];');
		const query = new template({
			activatedOn: {
				test: 'test'
			}
		});
		
		assert.throws(() => {
			const pgQuery = toPgQuery(query);	
		}, QueryError);
    });
});