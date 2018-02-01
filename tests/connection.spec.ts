// IMPORTS
// ================================================================================================
import * as assert from 'assert';
import {Database} from './../index';
import {Query, ListResultQuery, SingleResultQuery} from '../lib/Query';
import {ConnectionError, TransactionError, QueryError, ParseError} from '../lib/errors';
import {User, prepareDatabase} from './setup';
import {settings} from './settings';

// OBJECT QUERY TESTS
// ================================================================================================
describe('Object query tests;', function () {

    it('Object query should return a single object', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                const query: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'single',
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
                const query: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 0;',
                    mask: 'single',
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
                const query1: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'single',
                    name: 'query1'
                };

                const query2: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 2;',
                    mask: 'single',
                    name: 'query2'
                };

                return session.execute([query1, query2]).then((usermap) => {
                    assert.strictEqual(usermap.size, 2);
                    const user1 = usermap.get(query1.name);
                    assert.strictEqual(user1.username, 'Irakliy');
                    const user2 = usermap.get(query2.name);
                    assert.strictEqual(user2.username, 'Yason');
                });
            }).then(() => session.close());
        });
    });

    it('Multiple object queries with the same name should produce a Map with a single key', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                const query1: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'single',
                    name: 'getUserById'
                };

                const query2: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 2;',
                    mask: 'single',
                    name: 'getUserById'
                };

                const query3: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 3;',
                    mask: 'single',
                    name: 'getUserById'
                };

                return session.execute([query1, query2, query3]).then((usermap) => {
                    assert.strictEqual(usermap.size, 1);
                    const users = usermap.get(query1.name);
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
                const query1: SingleResultQuery<User> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'single'
                };

                const query2: SingleResultQuery<User> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 3;',
                    mask: 'single'
                };

                const query3: SingleResultQuery<User> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 3;',
                    mask: 'single',
                    name: 'test'
                };

                return session.execute([query1, query2, query3]).then((results) => {
                    assert.strictEqual(results.size, 2);
                    const users = results.get(undefined);
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
                const query1: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'single',
                    name: 'getUserById'
                };

                const query2: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 0;',
                    mask: 'single',
                    name: 'getUserById'
                };

                const query3: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 3;',
                    mask: 'single',
                    name: 'getUserById'
                };

                return session.execute([query1, query2, query3]).then((results) => {
                    assert.strictEqual(results.size, 1);
                    const users = results.get(query1.name);
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
                const query: SingleResultQuery<number> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'single',
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
                const query1: SingleResultQuery<number> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'single',
                    handler: {
                        parse: (row: any) => row.id
                    }
                };

                const query2: SingleResultQuery<number> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 2;',
                    mask: 'single',
                    handler: {
                        parse: (row: any) => row.id
                    }
                };

                return session.execute([query1, query2]).then((results) => {
                    assert.strictEqual(results.size, 1);
                    const userIds = results.get(undefined);
                    assert.strictEqual(userIds[0], 1);
                    assert.strictEqual(userIds[1], 2);
                });
            }).then(() => session.close());
        });
    });
});

// LIST QUERY TESTS
// ================================================================================================
describe('List query tests;', function () {

    it('List query should return an array of objects', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                const query: ListResultQuery<User> = {
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
                const query: ListResultQuery<User> = {
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
                const query1: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 2);',
                    mask: 'list',
                    name: 'query1'
                };

                const query2: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (3);',
                    mask: 'list',
                    name: 'query2'
                };

                return session.execute([query1, query2]).then((results) => {
                    assert.strictEqual(results.size, 2);

                    const users1: User[] = results.get(query1.name);
                    assert.strictEqual(users1.length, 2);
                    assert.strictEqual(users1[1].id, 2);
                    assert.strictEqual(users1[1].username, 'Yason');

                    const users2: User[] = results.get(query2.name);
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
                const query1: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 2);',
                    mask: 'list',
                    name: 'query'
                };

                const query2: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (3);',
                    mask: 'list',
                    name: 'query'
                };

                return session.execute([query1, query2]).then((results) => {
                    assert.strictEqual(results.size, 1);

                    const users1: User[] = results.get(query1.name)[0];
                    assert.strictEqual(users1.length, 2);
                    assert.strictEqual(users1[1].id, 2);
                    assert.strictEqual(users1[1].username, 'Yason');

                    const users2: User[] = results.get(query1.name)[1];
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
                const query1: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 2);',
                    mask: 'list',
                    name: 'query'
                };

                const query2: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (0);',
                    mask: 'list',
                    name: 'query'
                };

                const query3: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (3);',
                    mask: 'list',
                    name: 'query'
                };

                return session.execute([query1, query2, query3]).then((results) => {
                    assert.strictEqual(results.size, 1);

                    const users1: User[] = results.get(query1.name)[0];
                    assert.strictEqual(users1.length, 2);
                    assert.strictEqual(users1[1].id, 2);
                    assert.strictEqual(users1[1].username, 'Yason');

                    assert.strictEqual(results.get(query1.name)[1].length, 0);

                    const users3: User[] = results.get(query1.name)[2];
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
                const query1: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 2);',
                    mask: 'list'
                };

                const query2: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (3);',
                    mask: 'list'
                };

                return session.execute([query1, query2]).then((results) => {
                    assert.strictEqual(results.size, 1);

                    const users1: User[] = results.get(undefined)[0];
                    assert.strictEqual(users1.length, 2);
                    assert.strictEqual(users1[1].id, 2);
                    assert.strictEqual(users1[1].username, 'Yason');

                    const users2: User[] = results.get(undefined)[1];
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
                const query: ListResultQuery<number> = {
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
describe('Non-result query tests;', function () {

    it('A non-result query should produce no results', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                const query: Query = {
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
                const query: Query = {
                    text: `UPDATE tmp_users SET username = 'irakliy' WHERE username = 'irakliy';`
                };
                return session.execute([query, query]).then((results) => {
                    assert.strictEqual(results, undefined);
                });
            }).then(() => session.close());
        });
    });
});

// MIXED QUERY TESTS
// ================================================================================================
describe('Mixed query tests;', function () {

    it('Multiple mixed queries should produce a Map of results', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                const query1: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 2;',
                    mask: 'single',
                    name: 'query1'
                };

                const query2: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 3);',
                    mask: 'list',
                    name: 'query2'
                };
                return session.execute([query1, query2]).then((results) => {
                    assert.strictEqual(results.size, 2);

                    const user = results.get(query1.name);
                    assert.strictEqual(user.id, 2);
                    assert.strictEqual(user.username, 'Yason');

                    const users = results.get(query2.name);
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
                const query1: SingleResultQuery<{ id: number, username: string }> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'single'
                };

                const query2: ListResultQuery<{ id: number, username: string }> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id IN (2, 3);',
                    mask: 'list'
                };

                const query3: ListResultQuery<{ id: number, username: string }> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id IN (2, 3);',
                    mask: 'list',
                    name: 'test'
                };

                return session.execute([query1, query2, query3]).then((results) => {
                    assert.strictEqual(results.size, 2);
                    const result = results.get(undefined);
                    const user = result[0];
                    assert.strictEqual(user.id, 1);
                    assert.strictEqual(user.username, 'Irakliy');

                    const users = result[1];
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
                const query1: SingleResultQuery<{ id: number, username: string }> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'single'
                };

                const query2: Query = {
                    text: `UPDATE tmp_users SET username = 'irakliy' WHERE username = 'irakliy';`
                };

                const query3: ListResultQuery<{ id: number, username: string }> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id IN (2, 3);',
                    mask: 'list'
                };

                const query4: ListResultQuery<{ id: number, username: string }> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id IN (2, 3);',
                    mask: 'list',
                    name: 'test'
                };

                return session.execute([query1, query2, query3, query4]).then((results) => {
                    assert.strictEqual(results.size, 2);
                    const result = results.get(undefined);
                    const user = result[0];
                    assert.strictEqual(user.id, 1);
                    assert.strictEqual(user.username, 'Irakliy');

                    const users = result[1];
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
describe('Parametrized query tests;', function () {

    it('Object query parametrized with number should retrive correct row', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                const query: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = {{id}};',
                    mask: 'single',
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
                const query: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE username = {{username}};',
                    mask: 'single',
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
                const query: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE username = {{username}};',
                    mask: 'single',
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
                const query1: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'single',
                    name: 'query1'
                };

                const query2: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 2;',
                    mask: 'single',
                    name: 'query2'
                };

                const query3: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE username = {{username}};',
                    mask: 'single',
                    name: 'query3',
                    params: {
                        username: `T'est`
                    }
                };

                const query4: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 3;',
                    mask: 'single',
                    name: 'query4'
                };

                return session.execute([query1, query2, query3, query4]).then((results) => {
                    assert.strictEqual(results.size, 4);

                    const user1 = results.get(query1.name);
                    assert.strictEqual(user1.id, 1);
                    assert.strictEqual(user1.username, 'Irakliy');

                    const user2 = results.get(query2.name);
                    assert.strictEqual(user2.id, 2);
                    assert.strictEqual(user2.username, 'Yason');

                    const user3 = results.get(query3.name);
                    assert.strictEqual(user3.id, 4);
                    assert.strictEqual(user3.username, `T'est`);

                    const user4 = results.get(query4.name);
                    assert.strictEqual(user4.id, 3);
                    assert.strictEqual(user4.username, `George`);
                });
            }).then(() => session.close());
        });
    });

    it('Two parametrized queries in a row should produce correct result', () => {
        return new Database(settings).connect().then((session) => {
            return prepareDatabase(session).then(() => {
                const query1: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'single',
                    name: 'query1'
                };

                const query2: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE username = {{username}};',
                    mask: 'single',
                    name: 'query2',
                    params: {
                        username: `T'est`
                    }
                };

                const query3: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = {{id}};',
                    mask: 'single',
                    name: 'query3',
                    params: {
                        id: 2
                    }
                };

                const query4: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 3;',
                    mask: 'single',
                    name: 'query4'
                };

                return session.execute([query1, query2, query3, query4]).then((results) => {
                    assert.strictEqual(results.size, 4);

                    const user1 = results.get(query1.name);
                    assert.strictEqual(user1.id, 1);
                    assert.strictEqual(user1.username, 'Irakliy');

                    const user2 = results.get(query2.name);
                    assert.strictEqual(user2.id, 4);
                    assert.strictEqual(user2.username, `T'est`);

                    const user3 = results.get(query3.name);
                    assert.strictEqual(user3.id, 2);
                    assert.strictEqual(user3.username, 'Yason');

                    const user4 = results.get(query4.name);
                    assert.strictEqual(user4.id, 3);
                    assert.strictEqual(user4.username, `George`);
                });
            }).then(() => session.close());
        });
    });
});

// SESSION LIFECYCLE TESTS
// ================================================================================================
describe('Session lifecycle tests;', function () {

    it('Closing a session should return a connection back to the pool', () => {
        const database = new Database(settings);
        const poolState = database.getPoolState();
        assert.strictEqual(poolState.size, 0);
        assert.strictEqual(poolState.idle, 0);

        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                assert.strictEqual(session.isActive, true);
                const poolState = database.getPoolState();
                assert.strictEqual(poolState.size, 1);
                assert.strictEqual(poolState.idle, 0);

                return session.close().then(() => {
                    assert.strictEqual(session.isActive, false);
                    const poolState = database.getPoolState();
                    assert.strictEqual(poolState.size, 1);
                    assert.strictEqual(poolState.idle, 1);
                });
            });
        });
    });

    it('Starting a lazy transaction should put session into Transaction state', () => {
        const database = new Database(settings);
        return database.connect().then((session) => {
            assert.strictEqual(session.inTransaction, false);
            return prepareDatabase(session).then(() => {
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
        const database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
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
        const database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                return session.startTransaction().then(() => {
                    const query: Query = {
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
                    const query: SingleResultQuery<User> = {
                        text: 'SELECT * FROM tmp_users WHERE id = 1;',
                        mask: 'single'
                    };
                    return session.execute(query).then((user) => {
                        assert.strictEqual(user.id, 1);
                        assert.strictEqual(user.username, 'Test');
                    }).then(() => session.close());
                })
            });
    });

    it('Rolling back a transaction should not change the data in the database', () => {
        const database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                return session.startTransaction().then(() => {
                    const query: Query = {
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
                    const query: SingleResultQuery<User> = {
                        text: 'SELECT * FROM tmp_users WHERE id = 1;',
                        mask: 'single'
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
describe('Error condition tests;', function () {

    it('Query execution error should close the session and release the connection back to the pool', () => {
        const database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                const query = {
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
                        assert.strictEqual(database.getPoolState().idle, 1);
                    });
            });
        });
    });

    it('Query execution error should roll back an active transaction', () => {
        const database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                return session.startTransaction().then(() => {
                    const query: Query = {
                        text: `UPDATE tmp_users SET username = 'Test' WHERE id = 1;`
                    };

                    return session.execute(query).then(() => {
                        const errorQuery = {
                            text: undefined
                        };

                        return session.execute(errorQuery).then(() => {
                            assert.fail();
                        }).catch((reason) => {
                            assert.ok(reason instanceof Error);
                            assert.ok(reason instanceof QueryError);
                            assert.strictEqual(session.isActive, false);
                            assert.strictEqual(database.getPoolState().size, 1);
                            assert.strictEqual(database.getPoolState().idle, 1);
                        });
                    });
                });
            });
        })
            .then(() => {
                return database.connect().then((session) => {
                    const query: SingleResultQuery<User> = {
                        text: 'SELECT * FROM tmp_users WHERE id = 1;',
                        mask: 'single'
                    };

                    return session.execute(query).then((user) => {
                        assert.strictEqual(user.id, 1);
                        assert.strictEqual(user.username, 'Irakliy');
                    }).then(() => session.close());
                })
            });
    });

    it('Starting a transaction on a closed session should throw an error', () => {
        const database = new Database(settings);
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
                        assert.strictEqual(database.getPoolState().idle, 1);
                    });
            });
        });
    });

    it('Starting a transaction when a session is in transaction should throw an error', () => {
        const database = new Database(settings);
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
            }).then(() => session.close('rollback'));
        });
    });

    it('Closing an already closed session should throw an error', () => {
        const database = new Database(settings);
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
        const database = new Database(settings);
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
        const database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                return session.close().then(() => {
                    const query: Query = {
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
                            assert.strictEqual(database.getPoolState().idle, 1);
                        });
                });
            });
        });
    });

    it('Executing a query with no text should throw an error and close the session', () => {
        const database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                const query: Query = {
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
                        assert.strictEqual(database.getPoolState().idle, 1);
                    });
            });
        });
    });

    it('Executing a query with invalid SQL should throw an error and close the session', () => {
        const database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                const query: Query = {
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
                        assert.strictEqual(database.getPoolState().idle, 1);
                    });
            });
        });
    });

    it('Executing a query with invalid result parser should throw an error and close the session', () => {
        const database = new Database(settings);
        return database.connect().then((session) => {
            return prepareDatabase(session).then(() => {
                const query: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'list',
                    handler: {
                        parse: () => {
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
                        assert.strictEqual(database.getPoolState().idle, 1);
                    });
            });
        });
    });

    it('Attempt to connect to a non-existing database should throw an error', () => {
        const settings1 = JSON.parse(JSON.stringify(settings));
        settings1.connection.database = 'invalid';
        const database = new Database(settings1);
        return database.connect()
            .catch((reason) => {
                assert.ok(reason instanceof ConnectionError);
                assert.ok(reason instanceof Error);
            });
    });

    it('Executing two queries with errors should not crush the system', () => {
        const database = new Database(settings);

        return database.connect({startTransaction: true}).then((session) => {
            return prepareDatabase(session).then(() => {
                const query: ListResultQuery<User> = {
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

        return database.connect({startTransaction: true}).then((session) => {
            return prepareDatabase(session).then(() => {
                const query: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'list'
                };

                return session.execute(query).then(() => {

                    return session.close('commit')
                        .then(() => session.execute(query))
                        .then(() => {
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

        return database.connect({startTransaction: true}).then((session) => {
            return prepareDatabase(session).then(() => {
                const query: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'list'
                };

                return session.execute(query).then(() => {

                    return session.close('rollback')
                        .then(() => session.execute(query))
                        .then(() => {
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
