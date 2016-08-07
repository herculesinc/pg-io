﻿// IMPORTS
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
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
                var query: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'object',
                    name: 'getUserById'
                };
                
                return dao.execute(query).then((user) => {
                    assert.strictEqual(user.id, 1);
                    assert.strictEqual(user.username, 'Irakliy');
                    assert.strictEqual(user.tags[0], 'test');
                    assert.strictEqual(user.tags[1], 'testing');
                });
            }).then(() => dao.end());
        });
    });
    
    it('Object query should return undefined on no rows', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
            var query = {
                    text: 'SELECT * FROM tmp_users WHERE id = 0;',
                    mask: 'object',
                    name: 'getUserById'
                };
                
                return dao.execute(query).then((user) => {
                    assert.strictEqual(user, undefined);
                });
            }).then(() => dao.end());
        });
    });
    
    it('Multiple object queries should produce a Map of objects', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
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
                
                return dao.execute([query1, query2]).then((usermap) => {
                    assert.strictEqual(usermap.size, 2);
                    var user1 = usermap.get(query1.name);
                    assert.strictEqual(user1.username, 'Irakliy');    
                    var user2 = usermap.get(query2.name);
                    assert.strictEqual(user2.username, 'Yason');
                });
            }).then(() => dao.end());
        });
    });
    
    it('Multiple object queries with the same name should produce a Map with a single key', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
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
                
                return dao.execute([query1, query2, query3]).then((usermap) => {
                    assert.strictEqual(usermap.size, 1);
                    var users = usermap.get(query1.name);
                    assert.strictEqual(users.length, 3);
                    assert.strictEqual(users[1].id, 2);
                    assert.strictEqual(users[1].username, 'Yason');
                });
            }).then(() => dao.end());
        });
    });
    
    it('Unnamed object queries should aggregate into undefined key', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
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

                return dao.execute([query1, query2, query3]).then((results) => {
                    assert.strictEqual(results.size, 2);
                    var users = results.get(undefined);
                    assert.strictEqual(users.length, 2);
                    assert.strictEqual(users[0].id, 1);
                    assert.strictEqual(users[0].username, 'Irakliy');
                    assert.strictEqual(users[1].id, 3);
                    assert.strictEqual(users[1].username, 'George');
                });
            }).then(() => dao.end());
        });
    });
    
    it('Multiple object queries should not produce an array with holes', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
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
                
                return dao.execute([query1, query2, query3]).then((results) => {
                    assert.strictEqual(results.size, 1);
                    var users = results.get(query1.name);
                    assert.strictEqual(users.length, 2);
                    assert.strictEqual(users[1].id, 3);
                    assert.strictEqual(users[1].username, 'George');
                });
            }).then(() => dao.end());
        });
    });
    
    it('Object query with a handler should be parsed using custom parsing method', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
                var query = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'object',
                    handler: {
                        parse: (row: any) => row.id
                    }
                };

                return dao.execute(query).then((userId) => {
                    assert.strictEqual(userId, 1);
                });
            }).then(() => dao.end());
        });
    });
    
    it('Multiple object queries with a handler should be parsed using custom parsing method', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
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

                return dao.execute([query1, query2]).then((results) => {
                    assert.strictEqual(results.size, 1);
                    var userIds = results.get(undefined);
                    assert.strictEqual(userIds[0], 1);
                    assert.strictEqual(userIds[1], 2);
                });
            }).then(() => dao.end());
        });
    });
});

// LIST QUERY TESTS
// ================================================================================================
describe('List query tests', function () {
    
    it('List query should return an array of objects', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 3);',
                    mask: 'list'
                };
                
                return dao.execute(query).then((users) => {
                    assert.strictEqual(users.length, 2);
                    assert.strictEqual(users[0].id, 1);
                    assert.strictEqual(users[0].username, 'Irakliy');
                    assert.strictEqual(users[1].id, 3);
                    assert.strictEqual(users[1].username, 'George');
                });
            }).then(() => dao.end());
        });
    });

    it('List query should return an empty array on no rows', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (0);',
                    mask: 'list'
                };
                
                return dao.execute(query).then((users) => {
                    assert.strictEqual(users.length, 0);
                });
            }).then(() => dao.end());
        });
    });

    it('Multiple list queries should produce a Map of arrays', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
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
                
                return dao.execute([query1, query2]).then((results) => {
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
            }).then(() => dao.end());
        });
    });
    
    it('Multiple list queries with the same name should produce a Map with a single key', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
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
                
                return dao.execute([query1, query2]).then((results) => {
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
            }).then(() => dao.end());
        });
    });
    
    it('Multiple list queries with the same name should produce an array for every query', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
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
                
                return dao.execute([query1, query2, query3]).then((results) => {
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
            }).then(() => dao.end());
        });
    });

    it('Unnamed list queries should aggregte into undefined key', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
                var query1 = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 2);',
                    mask: 'list'
                };
                
                var query2 = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (3);',
                    mask: 'list'
                };
                
                return dao.execute([query1, query2]).then((results) => {
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
            }).then(() => dao.end());
        });
    });

    it('List query with a handler should be parsed using custom parsing mehtod', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
                var query = {
                    text: 'SELECT id, username FROM tmp_users WHERE id IN (1,2);',
                    mask: 'list',
                    handler: {
                        parse: (row: any) => row.id
                    }
                };

                return dao.execute(query).then((userIds) => {
                    assert.strictEqual(userIds.length, 2);
                    assert.strictEqual(userIds[0], 1);
                    assert.strictEqual(userIds[1], 2);
                });
            }).then(() => dao.end());
        });
    });
});

// NON-RESULT QUERY TESTS
// ================================================================================================
describe('Non-result query tests', function () {

    it('A non-result query should produce no results', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
                var query = {
                    text: `UPDATE tmp_users SET username = 'irakliy' WHERE username = 'irakliy';`
                };
                return dao.execute(query).then((result) => {
                    assert.strictEqual(result, undefined);
                });
            }).then(() => dao.end());
        });
    });

    it('Multiple non-result queries should produce no results', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
                var query = {
                    text: `UPDATE tmp_users SET username = 'irakliy' WHERE username = 'irakliy';`
                };
                return dao.execute([query, query]).then((results) => {
                    assert.strictEqual(results, undefined);
                });
            }).then(() => dao.end());;
        });
    });
});

// MIXED QUERY TESTS
// ================================================================================================
describe('Mixed query tests', function () {

    it('Multiple mixed queries should produce a Map of results', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
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
                return dao.execute([query1, query2]).then((results) => {
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
            }).then(() => dao.end());
        });
    });

    it('Unnamed mixed queries should aggregate into undefined key', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
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

                return dao.execute([query1, query2, query3]).then((results) => {
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
            }).then(() => dao.end());
        });
    });
    
    it('Unnamed non-result queries should not produce holes in result array', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
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

                return dao.execute([query1, query2, query3, query4]).then((results) => {
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
            }).then(() => dao.end());
        });
    });
});

// PARAMETRIZED QUERY TESTS
// ================================================================================================
describe('Parametrized query tests', function () {

    it('Object query parametrized with number should retrive correct row', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id = {{id}};',
                    mask: 'object',
                    params: {
                        id: 2
                    }
                };
                
                return dao.execute(query).then((user) => {
                    assert.strictEqual(user.id, 2);
                    assert.strictEqual(user.username, 'Yason');
                });
            }).then(() => dao.end());
        });
    });

    it('Object query parametrized with string should retrive correct row', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE username = {{username}};',
                    mask: 'object',
                    params: {
                        username: 'Yason'
                    }
                };
                
                return dao.execute(query).then((user) => {
                    assert.strictEqual(user.id, 2);
                    assert.strictEqual(user.username, 'Yason');
                });
            }).then(() => dao.end());
        });
    });

    it('Object query parametrized with unsafe string should retrive correct row', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE username = {{username}};',
                    mask: 'object',
                    params: {
                        username: `T'est`
                    }
                };
                
                return dao.execute(query).then((user) => {
                    assert.strictEqual(user.id, 4);
                    assert.strictEqual(user.username, `T'est`);
                });
            }).then(() => dao.end());
        });
    });
    
    it('Mix of parametrized and non-parametrized queries should return correct result map', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
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
                
                return dao.execute([query1, query2, query3, query4]).then((results) => {
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
            }).then(() => dao.end());
        });
    });
    
    it('Two parametrized queries in a row should produce correct result', () => {
        return new Database(settings).connect().then((dao) => {
            return prepareDatabase(dao).then(() => {
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
                
                return dao.execute([query1, query2, query3, query4]).then((results) => {
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
            }).then(() => dao.end());
        });
    });
});

// CONNECTION LIFECYCLE TESTS
// ================================================================================================
describe('Connection lifecycle tests', function () {

    it('Releasing a connection should return it to the connection pool', () => {
        const database = new Database(settings);
        const poolState = database.getPoolState();
        assert.strictEqual(poolState.size, 0);
        assert.strictEqual(poolState.available, 0);
        
        return database.connect().then((connection) => {
            return prepareDatabase(connection).then(()=> {
                assert.strictEqual(connection.isActive, true);
                const poolState = database.getPoolState();
                assert.strictEqual(poolState.size, 1);
                assert.strictEqual(poolState.available, 0);
                
                return connection.end().then(() => {
                    assert.strictEqual(connection.isActive, false);
                    const poolState = database.getPoolState();
                    assert.strictEqual(poolState.size, 1);
                    assert.strictEqual(poolState.available, 1);
                });  
            });
        });
    });
    
    it('Starting a lazy transaction should put connection into Transaction state', () => {
        var database = new Database(settings);
        return database.connect().then((connection) => {
            assert.strictEqual(connection.inTransaction, false);
            return prepareDatabase(connection).then(()=> {
                return connection.startTransaction().then(() => {
                    assert.strictEqual(connection.isActive, true);
                    assert.strictEqual(connection.inTransaction, true);
                    return connection.end('rollback').then(() => {
                        assert.strictEqual(connection.isActive, false);
                        assert.strictEqual(connection.inTransaction, false);
                    }); 
                });
            });
        });
    });
        
    it('Starting an eager transaction should put connection into Transaction state', () => {
        var database = new Database(settings);
        return database.connect().then((connection) => {
            return prepareDatabase(connection).then(()=> {
                assert.strictEqual(connection.inTransaction, false);
                return connection.startTransaction(false).then(() => {
                    assert.strictEqual(connection.isActive, true);
                    assert.strictEqual(connection.inTransaction, true);
                    return connection.end('rollback').then(() => {
                        assert.strictEqual(connection.isActive, false);
                        assert.strictEqual(connection.inTransaction, false);
                    }); 
                });
            });
        });
    });
    
    it('Commiting a transaction should update the data in the database', () => {
        var database = new Database(settings);
        return database.connect().then((connection) => {
            return prepareDatabase(connection).then(()=> {
                return connection.startTransaction().then(() => {
                    var query = {
                        text: 'UPDATE tmp_users SET username = {{un}} WHERE id = 1;',
                        params: {
                            un: 'Test'
                        }    
                    };
                    
                    return connection.execute(query).then(() => {
                        return connection.end('commit').then(() => {
                            assert.strictEqual(connection.isActive, false);
                            assert.strictEqual(connection.inTransaction, false);
                        });
                    });
                });
            });
        })
        .then(() => {
            return database.connect().then((connection) => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'object'
                };
                return connection.execute(query).then((user) => {
                    assert.strictEqual(user.id, 1);
                    assert.strictEqual(user.username, 'Test');
                }).then(() => connection.end());
            })
        });
    });
    
    it('Rolling back a transaction should not change the data in the database', () => {
        var database = new Database(settings);
        return database.connect().then((connection) => {
            return prepareDatabase(connection).then(()=> {
                return connection.startTransaction().then(() => {
                    var query = {
                        text: 'UPDATE tmp_users SET username = {{un}} WHERE id = 1;',
                        params: {
                            un: 'Test'
                        }    
                    };
                    
                    return connection.execute(query).then(() => {
                        return connection.end('rollback').then(() => {
                            assert.strictEqual(connection.isActive, false);
                            assert.strictEqual(connection.inTransaction, false);
                        });
                    });
                });
            });
        })
        .then(() => {
            return database.connect().then((connection) => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'object'
                };
                
                return connection.execute(query).then((user) => {
                    assert.strictEqual(user.id, 1);
                    assert.strictEqual(user.username, 'Irakliy');
                }).then(() => connection.end());
            })
        });
    });
});

// ERROR CONDITION TESTS
// ================================================================================================
describe('Error condition tests', function () {

    it('Query execution error should end the session and release the connection back to the pool', () => {
        var database = new Database(settings); 
        return database.connect().then((connection) => {
            return prepareDatabase(connection).then(() => {
                var query = {
                    text: undefined    
                };
                
                return connection.execute(query)
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof QueryError);
                        assert.strictEqual(connection.isActive, false);
                        assert.strictEqual(database.getPoolState().size, 1);
                        assert.strictEqual(database.getPoolState().available, 1);
                    });
            });
        });
    });
    
    it('Query execution error should roll back an active transaction', () => {
        var database = new Database(settings);
        return database.connect().then((connection) => {
            return prepareDatabase(connection).then(()=> {
                return connection.startTransaction().then(() => {
                    var query = {
                        text: `UPDATE tmp_users SET username = 'Test' WHERE id = 1;`
                    };
                    
                    return connection.execute(query).then(() => {
                        var errorQuery = {
                            text: undefined    
                        };
                        
                        return connection.execute(errorQuery).then(() => {
                            assert.fail();
                        }).catch((reason) => {
                            assert.ok(reason instanceof Error);
                            assert.ok(reason instanceof QueryError);
                            assert.strictEqual(connection.isActive, false);
                            assert.strictEqual(database.getPoolState().size, 1);
                            assert.strictEqual(database.getPoolState().available, 1);
                        });
                    });
                });
            });
        })
        .then(() => {
            return database.connect().then((connection) => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'object'
                };
                
                return connection.execute(query).then((user) => {
                    assert.strictEqual(user.id, 1);
                    assert.strictEqual(user.username, 'Irakliy');
                }).then(() => connection.end());
            })
        });
    });
    
    it('Starting a transaction on a ended session should throw an error', () => {
        var database = new Database(settings); 
        return database.connect().then((connection) => {
            return connection.end().then(() => {
                return connection.startTransaction()
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof ConnectionError);
                        assert.strictEqual(connection.isActive, false);
                        assert.strictEqual(database.getPoolState().size, 1);
                        assert.strictEqual(database.getPoolState().available, 1);
                    });
            });
        });
    });
    
    it('Starting a transaction when a connection is in transaction should throw an error', () => {
        var database = new Database(settings); 
        return database.connect().then((connection) => {
            return connection.startTransaction().then(() => {
                return connection.startTransaction()
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof TransactionError);
                        assert.strictEqual(connection.isActive, true);
                    });
            }).then(() => connection.end('rollback'));;
        });
    });
    
    it('Ending an already ended connection should throw an error', () => {
        var database = new Database(settings); 
        return database.connect().then((connection) => {
            return connection.end().then(() => {
                return connection.end()
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof ConnectionError);
                        assert.strictEqual(connection.isActive, false);
                    });
            });
        });
    });
    
    it('Releasing a connection with an uncommitted transaction should throw an error', () => {
        var database = new Database(settings); 
        return database.connect().then((connection) => {
            return connection.startTransaction().then(() => {
                return connection.end()
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof TransactionError);
                        assert.strictEqual(connection.isActive, false);
                    });
            });
        });
    });
    
    it('Executing a query on a ended session should throw an error', () => {
        var database = new Database(settings); 
        return database.connect().then((connection) => {
            return prepareDatabase(connection).then(() => {
                return connection.end().then(() => {
                   var query = {
                        text: undefined    
                    };
                
                    return connection.execute(query)
                        .then(() => {
                            assert.fail();
                        })
                        .catch((reason) => {
                            assert.ok(reason instanceof Error);
                            assert.ok(reason instanceof ConnectionError);
                            assert.strictEqual(connection.isActive, false);
                            assert.strictEqual(database.getPoolState().size, 1);
                            assert.strictEqual(database.getPoolState().available, 1);
                        }); 
                });
            });
        });
    });
    
    it('Executing a query with no text should throw an error and end the session', () => {
        var database = new Database(settings); 
        return database.connect().then((connection) => {
            return prepareDatabase(connection).then(() => {
                var query = {
                    text: undefined    
                };
                
                return connection.execute(query)
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof QueryError);
                        assert.strictEqual(connection.isActive, false);
                        assert.strictEqual(database.getPoolState().size, 1);
                        assert.strictEqual(database.getPoolState().available, 1);
                    });
            });
        });
    });
    
    it('Executing a query with invalid SQL should throw an error and end the session', () => {
        var database = new Database(settings); 
        return database.connect().then((connection) => {
            return prepareDatabase(connection).then(() => {
                var query = {
                    text: 'SELLECT * FROM tmp_users;'    
                };
                
                return connection.execute(query)
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof QueryError);
                        assert.strictEqual(connection.isActive, false);
                        assert.strictEqual(database.getPoolState().size, 1);
                        assert.strictEqual(database.getPoolState().available, 1);
                    });
            });
        });
    });
    
    it('Executing a query with invalid result parser should throw an error and end the session', () => {
        var database = new Database(settings); 
        return database.connect().then((connection) => {
            return prepareDatabase(connection).then(() => {
                var query = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'list',
                    handler: {
                        parse: (row: any) => {
                            throw new Error('Parsing error')
                        }
                    }    
                };
                
                return connection.execute(query)
                    .then(() => {
                        assert.fail();
                    })
                    .catch((reason) => {
                        assert.ok(reason instanceof Error);
                        assert.ok(reason instanceof ParseError);
                        assert.strictEqual(connection.isActive, false);
                        assert.strictEqual(database.getPoolState().size, 1);
                        assert.strictEqual(database.getPoolState().available, 1);
                    });
            });
        });
    });
    
    it('Attempt to connection to a non-existing database should throw an error', () => {
        var settings1 = JSON.parse(JSON.stringify(settings));
        settings1.connection.database = 'invalid';
        var database = new Database(settings1);
        return database.connect().then((connection) => {
            assert.fail();
        })
        .catch((reason) => {
            assert.ok(reason instanceof ConnectionError);
            assert.ok(reason instanceof Error);
        });
    });
});