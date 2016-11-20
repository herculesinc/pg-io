// IMPORTS
// ================================================================================================
import * as assert from 'assert';
import { Database } from './../index';
import { ListResultQuery, SingleResultQuery } from './../lib/Query';
import { PgError, ConnectionError, TransactionError, QueryError, ParseError } from './../lib/errors';
import { User, prepareDatabase, qFetchUserById, qFetchUsersByIdList } from './setup';
import { settings } from './settings';

// OBJECT QUERY TESTS
// ================================================================================================
describe('Object query tests', function() {
    
    it('Object query should return a single object', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'object',
                    name: 'getUserById'
                };
                
                return session.execute(query).then((user) => {
                    assert.strictEqual(user.id, 1);
                    assert.strictEqual(user.username, 'Irakliy');
                    assert.strictEqual(user.tags[0], 'test');
                    assert.strictEqual(user.tags[1], 'testing');
                });
            }).then(() => session.close());
        });
    });
    
    it('Object query should return undefined on no rows', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
            var query = {
                    text: 'SELECT * FROM tmp_users WHERE id = 0;',
                    mask: 'object',
                    name: 'getUserById'
                };
                
                return session.execute(query).then((user) => {
                    assert.strictEqual(user, undefined);
                });
            }).then(() => session.close());
        });
    });
    
    it('Multiple object queries should produce a Map of objects', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'object',
                    name: 'query1'
                };
                
                var query2 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 2;',
                    mask: 'object',
                    name: 'query2'
                };
                
                return session.execute([query1, query2]).then((usermap) => {
                    assert.strictEqual(usermap.size, 2);
                    var user1 = usermap.get(query1.name);
                    assert.strictEqual(user1.username, 'Irakliy');    
                    var user2 = usermap.get(query2.name);
                    assert.strictEqual(user2.username, 'Yason');
                });
            }).then(() => session.close());
        });
    });
    
    it('Multiple object queries with the same name should produce a Map with a single key', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'object',
                    name: 'getUserById'
                };
                
                var query2 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 2;',
                    mask: 'object',
                    name: 'getUserById'
                };
                
                var query3 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 3;',
                    mask: 'object',
                    name: 'getUserById'
                };
                
                return session.execute([query1, query2, query3]).then((usermap) => {
                    assert.strictEqual(usermap.size, 1);
                    var users = usermap.get(query1.name);
                    assert.strictEqual(users.length, 3);
                    assert.strictEqual(users[1].id, 2);
                    assert.strictEqual(users[1].username, 'Yason');
                });
            }).then(() => session.close());
        });
    });
    
    it('Unnamed object queries should aggregate into undefined key', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'object'
                };

                var query2 = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 3;',
                    mask: 'object'
                };
                
                var query3 = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 3;',
                    mask: 'object',
                    name: 'test'
                };

                return session.execute([query1, query2, query3]).then((results) => {
                    assert.strictEqual(results.size, 2);
                    var users = results.get(undefined);
                    assert.strictEqual(users.length, 2);
                    assert.strictEqual(users[0].id, 1);
                    assert.strictEqual(users[0].username, 'Irakliy');
                    assert.strictEqual(users[1].id, 3);
                    assert.strictEqual(users[1].username, 'George');
                });
            }).then(() => session.close());
        });
    });
    
    it('Multiple object queries should not produce an array with holes', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'object',
                    name: 'getUserById'
                };
                
                var query2 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 0;',
                    mask: 'object',
                    name: 'getUserById'
                };
                
                var query3 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 3;',
                    mask: 'object',
                    name: 'getUserById'
                };
                
                return session.execute([query1, query2, query3]).then((results) => {
                    assert.strictEqual(results.size, 1);
                    var users = results.get(query1.name);
                    assert.strictEqual(users.length, 2);
                    assert.strictEqual(users[1].id, 3);
                    assert.strictEqual(users[1].username, 'George');
                });
            }).then(() => session.close());
        });
    });
    
    it('Object query with a handler should be parsed using custom parsing method', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'object',
                    handler: {
                        parse: (row: any) => row.id
                    }
                };

                return session.execute(query).then((userId) => {
                    assert.strictEqual(userId, 1);
                });
            }).then(() => session.close());
        });
    });
    
    it('Multiple object queries with a handler should be parsed using custom parsing method', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'object',
                    handler: {
                        parse: (row: any) => row.id
                    }
                };
                
                var query2 = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 2;',
                    mask: 'object',
                    handler: {
                        parse: (row: any) => row.id
                    }
                };

                return session.execute([query1, query2]).then((results) => {
                    assert.strictEqual(results.size, 1);
                    var userIds = results.get(undefined);
                    assert.strictEqual(userIds[0], 1);
                    assert.strictEqual(userIds[1], 2);
                });
            }).then(() => session.close());
        });
    });
});

// LIST QUERY TESTS
// ================================================================================================
describe('List query tests', function () {
    
    it('List query should return an array of objects', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 3);',
                    mask: 'list'
                };
                
                return session.execute(query).then((users) => {
                    assert.strictEqual(users.length, 2);
                    assert.strictEqual(users[0].id, 1);
                    assert.strictEqual(users[0].username, 'Irakliy');
                    assert.strictEqual(users[1].id, 3);
                    assert.strictEqual(users[1].username, 'George');
                });
            }).then(() => session.close());
        });
    });

    it('List query should return an empty array on no rows', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (0);',
                    mask: 'list'
                };
                
                return session.execute(query).then((users) => {
                    assert.strictEqual(users.length, 0);
                });
            }).then(() => session.close());
        });
    });

    it('Multiple list queries should produce a Map of arrays', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 2);',
                    mask: 'list',
                    name: 'query1'
                };
                
                var query2 = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (3);',
                    mask: 'list',
                    name: 'query2'
                };
                
                return session.execute([query1, query2]).then((results) => {
                    assert.strictEqual(results.size, 2);

                    var users1: User[] = results.get(query1.name);
                    assert.strictEqual(users1.length, 2);
                    assert.strictEqual(users1[1].id, 2);
                    assert.strictEqual(users1[1].username, 'Yason');

                    var users2: User[] = results.get(query2.name);
                    assert.strictEqual(users2.length, 1);
                    assert.strictEqual(users2[0].id, 3);
                    assert.strictEqual(users2[0].username, 'George');
                });
            }).then(() => session.close());
        });
    });
    
    it('Multiple list queries with the same name should produce a Map with a single key', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 2);',
                    mask: 'list',
                    name: 'query'
                };
                
                var query2 = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (3);',
                    mask: 'list',
                    name: 'query'
                };
                
                return session.execute([query1, query2]).then((results) => {
                    assert.strictEqual(results.size, 1);

                    var users1: User[] = results.get(query1.name)[0];
                    assert.strictEqual(users1.length, 2);
                    assert.strictEqual(users1[1].id, 2);
                    assert.strictEqual(users1[1].username, 'Yason');

                    var users2: User[] = results.get(query1.name)[1];
                    assert.strictEqual(users2.length, 1);
                    assert.strictEqual(users2[0].id, 3);
                    assert.strictEqual(users2[0].username, 'George');
                });
            }).then(() => session.close());
        });
    });
    
    it('Multiple list queries with the same name should produce an array for every query', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 2);',
                    mask: 'list',
                    name: 'query'
                };
                
                var query2 = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (0);',
                    mask: 'list',
                    name: 'query'
                };
                
                var query3 = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (3);',
                    mask: 'list',
                    name: 'query'
                };
                
                return session.execute([query1, query2, query3]).then((results) => {
                    assert.strictEqual(results.size, 1);

                    var users1: User[] = results.get(query1.name)[0];
                    assert.strictEqual(users1.length, 2);
                    assert.strictEqual(users1[1].id, 2);
                    assert.strictEqual(users1[1].username, 'Yason');

                    assert.strictEqual(results.get(query1.name)[1].length, 0);

                    var users3: User[] = results.get(query1.name)[2];
                    assert.strictEqual(users3.length, 1);
                    assert.strictEqual(users3[0].id, 3);
                    assert.strictEqual(users3[0].username, 'George');
                });
            }).then(() => session.close());
        });
    });

    it('Unnamed list queries should aggregte into undefined key', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 2);',
                    mask: 'list'
                };
                
                var query2 = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (3);',
                    mask: 'list'
                };
                
                return session.execute([query1, query2]).then((results) => {
                    assert.strictEqual(results.size, 1);

                    var users1: User[] = results.get(undefined)[0];
                    assert.strictEqual(users1.length, 2);
                    assert.strictEqual(users1[1].id, 2);
                    assert.strictEqual(users1[1].username, 'Yason');

                    var users2: User[] = results.get(undefined)[1];
                    assert.strictEqual(users2.length, 1);
                    assert.strictEqual(users2[0].id, 3);
                    assert.strictEqual(users2[0].username, 'George');
                });
            }).then(() => session.close());
        });
    });

    it('List query with a handler should be parsed using custom parsing mehtod', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query = {
                    text: 'SELECT id, username FROM tmp_users WHERE id IN (1,2);',
                    mask: 'list',
                    handler: {
                        parse: (row: any) => row.id
                    }
                };

                return session.execute(query).then((userIds) => {
                    assert.strictEqual(userIds.length, 2);
                    assert.strictEqual(userIds[0], 1);
                    assert.strictEqual(userIds[1], 2);
                });
            }).then(() => session.close());
        });
    });
});

// NON-RESULT QUERY TESTS
// ================================================================================================
describe('Non-result query tests', function () {

    it('A non-result query should produce no results', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query = {
                    text: `UPDATE tmp_users SET username = 'irakliy' WHERE username = 'irakliy';`
                };
                return session.execute(query).then((result) => {
                    assert.strictEqual(result, undefined);
                });
            }).then(() => session.close());
        });
    });

    it('Multiple non-result queries should produce no results', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query = {
                    text: `UPDATE tmp_users SET username = 'irakliy' WHERE username = 'irakliy';`
                };
                return session.execute([query, query]).then((results) => {
                    assert.strictEqual(results, undefined);
                });
            }).then(() => session.close());;
        });
    });
});

// MIXED QUERY TESTS
// ================================================================================================
describe('Mixed query tests', function () {

    it('Multiple mixed queries should produce a Map of results', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 2;',
                    mask: 'object',
                    name: 'query1'
                };
                
                var query2 = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 3);',
                    mask: 'list',
                    name: 'query2'
                };
                return session.execute([query1, query2]).then((results) => {
                    assert.strictEqual(results.size, 2);
                    
                    var user = results.get(query1.name);
                    assert.strictEqual(user.id, 2);
                    assert.strictEqual(user.username, 'Yason');

                    var users = results.get(query2.name);
                    assert.strictEqual(users.length, 2);
                    assert.strictEqual(users[0].id, 1);
                    assert.strictEqual(users[0].username, 'Irakliy');
                    assert.strictEqual(users[1].id, 3);
                    assert.strictEqual(users[1].username, 'George');
                });
            }).then(() => session.close());
        });
    });

    it('Unnamed mixed queries should aggregate into undefined key', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'object'
                };

                var query2 = {
                    text: 'SELECT id, username FROM tmp_users WHERE id IN (2, 3);',
                    mask: 'list'
                };

                var query3 = {
                    text: 'SELECT id, username FROM tmp_users WHERE id IN (2, 3);',
                    mask: 'list',
                    name: 'test'
                };

                return session.execute([query1, query2, query3]).then((results) => {
                    assert.strictEqual(results.size, 2);
                    var result = results.get(undefined);
                    var user = result[0];
                    assert.strictEqual(user.id, 1);
                    assert.strictEqual(user.username, 'Irakliy');

                    var users = result[1];
                    assert.strictEqual(users.length, 2);
                    assert.strictEqual(users[0].id, 2);
                    assert.strictEqual(users[0].username, 'Yason');
                    assert.strictEqual(users[1].id, 3);
                    assert.strictEqual(users[1].username, 'George');
                });
            }).then(() => session.close());
        });
    });
    
    it('Unnamed non-result queries should not produce holes in result array', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'object'
                };

                var query2 = {
                    text: `UPDATE tmp_users SET username = 'irakliy' WHERE username = 'irakliy';`
                };

                var query3 = {
                    text: 'SELECT id, username FROM tmp_users WHERE id IN (2, 3);',
                    mask: 'list'
                };
                
                var query4 = {
                    text: 'SELECT id, username FROM tmp_users WHERE id IN (2, 3);',
                    mask: 'list',
                    name: 'test'
                };

                return session.execute([query1, query2, query3, query4]).then((results) => {
                    assert.strictEqual(results.size, 2);
                    var result = results.get(undefined);
                    var user = result[0];
                    assert.strictEqual(user.id, 1);
                    assert.strictEqual(user.username, 'Irakliy');

                    var users = result[1];
                    assert.strictEqual(users.length, 2);
                    assert.strictEqual(users[0].id, 2);
                    assert.strictEqual(users[0].username, 'Yason');
                    assert.strictEqual(users[1].id, 3);
                    assert.strictEqual(users[1].username, 'George');
                });
            }).then(() => session.close());
        });
    });
});

// PARAMETRIZED QUERY TESTS
// ================================================================================================
describe('Parametrized query tests', function () {

    it('Object query parametrized with number should retrive correct row', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id = {{id}};',
                    mask: 'object',
                    params: {
                        id: 2
                    }
                };
                
                return session.execute(query).then((user) => {
                    assert.strictEqual(user.id, 2);
                    assert.strictEqual(user.username, 'Yason');
                });
            }).then(() => session.close());
        });
    });

    it('Object query parametrized with string should retrive correct row', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE username = {{username}};',
                    mask: 'object',
                    params: {
                        username: 'Yason'
                    }
                };
                
                return session.execute(query).then((user) => {
                    assert.strictEqual(user.id, 2);
                    assert.strictEqual(user.username, 'Yason');
                });
            }).then(() => session.close());
        });
    });

    it('Object query parametrized with unsafe string should retrive correct row', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE username = {{username}};',
                    mask: 'object',
                    params: {
                        username: `T'est`
                    }
                };
                
                return session.execute(query).then((user) => {
                    assert.strictEqual(user.id, 4);
                    assert.strictEqual(user.username, `T'est`);
                });
            }).then(() => session.close());
        });
    });
    
    it('Mix of parametrized and non-parametrized queries should return correct result map', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'object',
                    name: 'query1'
                };
                
                var query2 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 2;',
                    mask: 'object',
                    name: 'query2'
                };
                
                var query3 = {
                    text: 'SELECT * FROM tmp_users WHERE username = {{username}};',
                    mask: 'object',
                    name: 'query3',
                    params: {
                        username: `T'est`
                    }
                };
                
                var query4 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 3;',
                    mask: 'object',
                    name: 'query4'
                };
                
                return session.execute([query1, query2, query3, query4]).then((results) => {
                    assert.strictEqual(results.size, 4);
                    
                    var user1 = results.get(query1.name);
                    assert.strictEqual(user1.id, 1);
                    assert.strictEqual(user1.username, 'Irakliy');
                    
                    var user2 = results.get(query2.name);
                    assert.strictEqual(user2.id, 2);
                    assert.strictEqual(user2.username, 'Yason');
                    
                    var user3 = results.get(query3.name);
                    assert.strictEqual(user3.id, 4);
                    assert.strictEqual(user3.username, `T'est`);
                    
                    var user4 = results.get(query4.name);
                    assert.strictEqual(user4.id, 3);
                    assert.strictEqual(user4.username, `George`);
                });
            }).then(() => session.close());
        });
    });
    
    it('Two parametrized queries in a row should produce correct result', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query1 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'object',
                    name: 'query1'
                };
                
                var query2 = {
                    text: 'SELECT * FROM tmp_users WHERE username = {{username}};',
                    mask: 'object',
                    name: 'query2',
                    params: {
                        username: `T'est`
                    }
                };
                
                var query3 = {
                    text: 'SELECT * FROM tmp_users WHERE id = {{id}};',
                    mask: 'object',
                    name: 'query3',
                    params: {
                        id: 2
                    }
                };
                
                var query4 = {
                    text: 'SELECT * FROM tmp_users WHERE id = 3;',
                    mask: 'object',
                    name: 'query4'
                };
                
                return session.execute([query1, query2, query3, query4]).then((results) => {
                    assert.strictEqual(results.size, 4);
                    
                    var user1 = results.get(query1.name);
                    assert.strictEqual(user1.id, 1);
                    assert.strictEqual(user1.username, 'Irakliy');
                    
                    var user2 = results.get(query2.name);
                    assert.strictEqual(user2.id, 4);
                    assert.strictEqual(user2.username, `T'est`);
                    
                    var user3 = results.get(query3.name);
                    assert.strictEqual(user3.id, 2);
                    assert.strictEqual(user3.username, 'Yason');
                    
                    var user4 = results.get(query4.name);
                    assert.strictEqual(user4.id, 3);
                    assert.strictEqual(user4.username, `George`);
                });
            }).then(() => session.close());
        });
    });
});

// SESSION LIFECYCLE TESTS
// ================================================================================================
describe('Session lifecycle tests', function () {

    it('Closing a session should return a connection back to the pool', () => {
        const database = new Database(settings);
        const poolState = database.getPoolState();
        assert.strictEqual(poolState.size, 0);
        assert.strictEqual(poolState.available, 0);
        
        return database.connect().then((session) => {
            return prepareDatabase(session).then(()=> {
                assert.strictEqual(session.isActive, true);
                const poolState = database.getPoolState();
                assert.strictEqual(poolState.size, 1);
                assert.strictEqual(poolState.available, 0);
                
                return session.close().then(() => {
                    assert.strictEqual(session.isActive, false);
                    const poolState = database.getPoolState();
                    assert.strictEqual(poolState.size, 1);
                    assert.strictEqual(poolState.available, 1);
                });  
            });
        });
    });
    
    it('Starting a lazy transaction should put session into Transaction state', () => {
        var database = new Database(settings);
        return database.connect().then((session) => {
            assert.strictEqual(session.inTransaction, false);
            return prepareDatabase(session).then(()=> {
                return session.startTransaction().then(() => {
                    assert.strictEqual(session.isActive, true);
                    assert.strictEqual(session.inTransaction, true);
                    return session.close('rollback').then(() => {
                        assert.strictEqual(session.isActive, false);
                        assert.strictEqual(session.inTransaction, false);
                    }); 
                });
            });
        });
    });
        
    it('Starting an eager transaction should put a session into Transaction state', () => {
        var database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(()=> {
                assert.strictEqual(session.inTransaction, false);
                return session.startTransaction(false).then(() => {
                    assert.strictEqual(session.isActive, true);
                    assert.strictEqual(session.inTransaction, true);
                    return session.close('rollback').then(() => {
                        assert.strictEqual(session.isActive, false);
                        assert.strictEqual(session.inTransaction, false);
                    }); 
                });
            });
        });
    });
    
    it('Commiting a transaction should update the data in the database', () => {
        var database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(()=> {
                return session.startTransaction().then(() => {
                    var query = {
                        text: 'UPDATE tmp_users SET username = {{un}} WHERE id = 1;',
                        params: {
                            un: 'Test'
                        }    
                    };
                    
                    return session.execute(query).then(() => {
                        return session.close('commit').then(() => {
                            assert.strictEqual(session.isActive, false);
                            assert.strictEqual(session.inTransaction, false);
                        });
                    });
                });
            });
        })
        .then(() => {
            return database.connect().then((session) => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'object'
                };
                return session.execute(query).then((user) => {
                    assert.strictEqual(user.id, 1);
                    assert.strictEqual(user.username, 'Test');
                }).then(() => session.close());
            })
        });
    });
    
    it('Rolling back a transaction should not change the data in the database', () => {
        var database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(()=> {
                return session.startTransaction().then(() => {
                    var query = {
                        text: 'UPDATE tmp_users SET username = {{un}} WHERE id = 1;',
                        params: {
                            un: 'Test'
                        }    
                    };
                    
                    return session.execute(query).then(() => {
                        return session.close('rollback').then(() => {
                            assert.strictEqual(session.isActive, false);
                            assert.strictEqual(session.inTransaction, false);
                        });
                    });
                });
            });
        })
        .then(() => {
            return database.connect().then((session) => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'object'
                };
                
                return session.execute(query).then((user) => {
                    assert.strictEqual(user.id, 1);
                    assert.strictEqual(user.username, 'Irakliy');
                }).then(() => session.close());
            })
        });
    });
});

// ERROR CONDITION TESTS
// ================================================================================================
describe('Error condition tests', function () {

    it('Query execution error should close the session and release the connection back to the pool', () => {
        var database = new Database(settings); 
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query = {
                    text: undefined    
                };
                
                return session.execute(query)
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof QueryError);
                        assert.strictEqual(session.isActive, false);
                        assert.strictEqual(database.getPoolState().size, 1);
                        assert.strictEqual(database.getPoolState().available, 1);
                    });
            });
        });
    });
    
    it('Query execution error should roll back an active transaction', () => {
        var database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(()=> {
                return session.startTransaction().then(() => {
                    var query = {
                        text: `UPDATE tmp_users SET username = 'Test' WHERE id = 1;`
                    };
                    
                    return session.execute(query).then(() => {
                        var errorQuery = {
                            text: undefined    
                        };
                        
                        return session.execute(errorQuery).then(() => {
                            assert.fail();
                        }).catch((reason) => {
                            assert.ok(reason instanceof Error);
                            assert.ok(reason instanceof QueryError);
                            assert.strictEqual(session.isActive, false);
                            assert.strictEqual(database.getPoolState().size, 1);
                            assert.strictEqual(database.getPoolState().available, 1);
                        });
                    });
                });
            });
        })
        .then(() => {
            return database.connect().then((session) => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'object'
                };
                
                return session.execute(query).then((user) => {
                    assert.strictEqual(user.id, 1);
                    assert.strictEqual(user.username, 'Irakliy');
                }).then(() => session.close());
            })
        });
    });
    
    it('Starting a transaction on a closed session should throw an error', () => {
        var database = new Database(settings); 
        return database.connect().then((session) => {
            return session.close().then(() => {
                return session.startTransaction()
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof ConnectionError);
                        assert.strictEqual(session.isActive, false);
                        assert.strictEqual(database.getPoolState().size, 1);
                        assert.strictEqual(database.getPoolState().available, 1);
                    });
            });
        });
    });
    
    it('Starting a transaction when a session is in transaction should throw an error', () => {
        var database = new Database(settings); 
        return database.connect().then((session) => {
            return session.startTransaction().then(() => {
                return session.startTransaction()
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof TransactionError);
                        assert.strictEqual(session.isActive, true);
                    });
            }).then(() => session.close('rollback'));;
        });
    });
    
    it('Closing an already closed session should throw an error', () => {
        var database = new Database(settings); 
        return database.connect().then((session) => {
            return session.close().then(() => {
                return session.close()
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof ConnectionError);
                        assert.strictEqual(session.isActive, false);
                    });
            });
        });
    });
    
    it('Closing a session with an uncommitted transaction should throw an error', () => {
        var database = new Database(settings); 
        return database.connect().then((session) => {
            return session.startTransaction().then(() => {
                return session.close()
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof TransactionError);
                        assert.strictEqual(session.isActive, false);
                    });
            });
        });
    });
    
    it('Executing a query on a closed session should throw an error', () => {
        var database = new Database(settings); 
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                return session.close().then(() => {
                   var query = {
                        text: undefined    
                    };
                
                    return session.execute(query)
                        .then(() => {
                            assert.fail();
                        })
                        .catch((reason) => {
                            assert.ok(reason instanceof Error);
                            assert.ok(reason instanceof ConnectionError);
                            assert.strictEqual(session.isActive, false);
                            assert.strictEqual(database.getPoolState().size, 1);
                            assert.strictEqual(database.getPoolState().available, 1);
                        }); 
                });
            });
        });
    });
    
    it('Executing a query with no text should throw an error and close the session', () => {
        var database = new Database(settings); 
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query = {
                    text: undefined    
                };
                
                return session.execute(query)
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof QueryError);
                        assert.strictEqual(session.isActive, false);
                        assert.strictEqual(database.getPoolState().size, 1);
                        assert.strictEqual(database.getPoolState().available, 1);
                    });
            });
        });
    });
    
    it('Executing a query with invalid SQL should throw an error and close the session', () => {
        var database = new Database(settings); 
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query = {
                    text: 'SELLECT * FROM tmp_users;'    
                };
                
                return session.execute(query)
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof QueryError);
                        assert.strictEqual(session.isActive, false);
                        assert.strictEqual(database.getPoolState().size, 1);
                        assert.strictEqual(database.getPoolState().available, 1);
                    });
            });
        });
    });
    
    it('Executing a query with invalid result parser should throw an error and close the session', () => {
        var database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'list',
                    handler: {
                        parse: (row: any) => {
                            throw new Error('Parsing error')
                        }
                    }    
                };
                
                return session.execute(query)
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof ParseError);
                        assert.strictEqual(session.isActive, false);
                        assert.strictEqual(database.getPoolState().size, 1);
                        assert.strictEqual(database.getPoolState().available, 1);
                    });
            });
        });
    });
    
    it('Attempt to connect to a non-existing database should throw an error', () => {
        var settings1 = JSON.parse(JSON.stringify(settings));
        settings1.connection.database = 'invalid';
        var database = new Database(settings1);
        return database.connect().then((session) => {
            assert.fail();
        })
        .catch((reason) => {
            assert.ok(reason instanceof ConnectionError);
            assert.ok(reason instanceof Error);
        });
    });

    it('Executing two queries with errors should not crush the system', () => {
        const database = new Database(settings);

        return database.connect({ startTransaction: true}).then((session) => {
            return prepareDatabase(session).then(() => {
                const query = {
                    text: 'SELECT * FROM tmp_users WHERE id = abc;',
                    mask: 'list'
                };

                session.execute(query).catch((error) => {
                    assert.strictEqual(error.message, 'column "abc" does not exist');
                });
                return session.execute(query).catch((error) => {
                    assert.strictEqual(error.message, 'current transaction is aborted, commands ignored until end of transaction block');
                });
            });
        });
    });

    it('Executing a query after commiting a transaction should throw an error', () => {
        const database = new Database(settings);

        return database.connect({ startTransaction: true}).then((session) => {
            return prepareDatabase(session).then(() => {
                const query = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'list'
                };

                return session.execute(query).then((result) => {

                    session.close('commit');
                    return session.execute(query)
                    .then(result => {
                        assert.fail('Error was not thrown');
                    })
                    .catch((error) => {
                        assert.strictEqual(error.message, 'Cannot execute queries: the session is closed');
                    });
                });
            });
        });
    });

    it('Executing a query after rolling back a transaction should throw an error', () => {
        const database = new Database(settings);

        return database.connect({ startTransaction: true}).then((session) => {
            return prepareDatabase(session).then(() => {
                const query = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'list'
                };

                return session.execute(query).then((result) => {

                    session.close('rollback');
                    return session.execute(query)
                    .then(result => {
                        assert.fail('Error was not thrown');
                    })
                    .catch((error) => {
                        assert.strictEqual(error.message, 'Cannot execute queries: the session is closed');
                    });
                });
            });
        });
    });

});