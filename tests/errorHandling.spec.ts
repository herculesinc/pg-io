import {expect} from 'chai';

import {Client, QueryResult} from 'pg';
import {ConnectionPool, PoolOptions} from '../lib/Pool';
import {settings} from './settings';
import {buildLogger} from '../lib/util';

const createNewPool = (options?: PoolOptions): ConnectionPool => {
    const poolSettings = Object.assign({}, settings.pool, options || {});

    return new ConnectionPool(poolSettings, settings.connection, buildLogger('test'));
};

describe('Pool error handling;', () => {
    it('Should complete these queries without dying', done => {
        const iterations = 5;
        const pool = createNewPool();
        const ps = [];
        let errors = 0;
        let shouldGet = 0;

        const runErrorQuery = (client: Client): Promise<QueryResult> => {
            shouldGet++;

            return new Promise(resolve => {
                client.query('SELECT \'asd\'+1 ')
                    .catch(err => {
                        errors++;
                        resolve(err);
                    });
            });
        };

        pool.acquire((err, client) => {
            for (let i = 0; i < iterations; i++) {
                ps.push(runErrorQuery(client));
            }

            Promise.all(ps).then(() => {
                expect(shouldGet).to.equal(errors);
                expect(shouldGet).to.equal(iterations);
                expect(pool.totalCount).to.equal(1);
                client.release();
                pool.shutdown(done);
            });
        });
    });

    it('calling release more than once should throw each time', done => {
        const pool = createNewPool();

        pool.acquire((err, client) => {
            client.release();

            for (let i = 0; i < 5; i++) {
                expect(() => client.release()).to.throw();
            }

            pool.shutdown(done);
        });
    });

    it('calling connect after end should return an error', done => {
        const pool = createNewPool();

        pool.acquire((err, client) => {
            client.query('SELECT $1::text as name', ['hi'])
                .then(result => {
                    expect(pool.totalCount).to.equal(1);
                    expect(result.rows[0].name).to.equal('hi');

                    client.release();

                    pool.shutdown(() => {
                        expect(pool.totalCount).to.equal(0);

                        client.query('select now()',)
                            .catch(err => {
                                expect(err).to.be.an.instanceof(Error);
                                expect(err.message).to.contain('Connection terminated');
                                done();
                            });
                    });
                });
        });
    });

    it('using an ended pool returns an error on all additional callbacks', (done) => {
        const pool = createNewPool();

        pool.shutdown(() => {
            pool.acquire(err => {
                expect(err).to.be.an.instanceof(Error);
                expect(err.message).to.contain('Cannot acquire a connection from the pool: the pool is not active');

                pool.shutdown(err => {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.contain('Cannot shut down connection pool: the pool is not active');

                    done();
                });
            });
        });
    });

    it('error from idle client removes client from pool', done => {
        const pool = createNewPool();
        const errorText = 'expected error';

        pool.acquire((err, client) => {
            expect(pool.totalCount).to.equal(1);
            expect(pool.idleCount).to.equal(0);

            client.release();

            new Promise((resolve, reject) => {
                process.nextTick(() => {
                    pool.once('error', (err) => {
                        expect(err.message).to.equal(errorText);
                        expect(pool.idleCount).to.equal(0);
                        expect(pool.totalCount).to.equal(0);

                        pool.shutdown(err => {
                            err ? reject(err) : resolve();
                        });
                    });

                    client.emit('error', new Error(errorText));
                })
            })
                .then(done)
                .catch(done);
        });
    });

    it('pool with lots of errors continues to work and provide new clients', done => {
        const iterations = 20;
        const queryValue = 'brianc';
        const pool = createNewPool({maxSize: 1});
        const errors = [];

        const errorHandler = (err, cb: Function): void => {
            if (err && err instanceof Error) {
                errors.push(err);
                cb();
            }
        };

        const query = (client: Client): Promise<QueryResult> => {
            return new Promise(resolve => {
                client.query('invalid sql').catch(err => errorHandler(err, resolve));
            });
        };

        pool.acquire(async (err, client) => {
            for (let i = 0; i < iterations; i++) {
                await query(client);
            }

            expect(errors).to.have.length(iterations);
            expect(pool.idleCount).to.equal(0);

            client.query('SELECT $1::text as name', [queryValue])
                .then(result => {
                    expect(result.rows).to.have.length(1);
                    expect(result.rows[0].name).to.equal(queryValue);

                    client.release();
                    pool.shutdown(done);
                })
                .catch(done);
        });
    });
});
