import {expect} from 'chai';

import {CLOSED_EVENT} from '../lib/Pool';
import {ConnectionError} from '../lib/errors';
import {createNewPool, createClient, wait} from './helpers';

describe('Pool idle timeout;', () => {
    it('should timeout and remove the client', done => {
        const pool = createNewPool({idleTimeout: 10});

        pool.acquire((err, client) => {
            expect(pool.idleCount).to.equal(0);
            expect(pool.totalCount).to.equal(1);

            client.query('select now()')
                .then(() => {
                    expect(pool.idleCount).to.equal(0);
                    expect(pool.totalCount).to.equal(1);
                    client.release();
                });

            pool.on(CLOSED_EVENT, () => {
                expect(pool.idleCount).to.equal(0);
                expect(pool.totalCount).to.equal(0);

                pool.shutdown(done);
            });
        });
    });

    it('can remove idle clients and recreate them', async done => {
        const iterations = 20;
        const pool = createNewPool({idleTimeout: 1});
        const results = [];

        try {
            for (let i = 0; i < iterations; i++) {
                const client = await createClient(pool);
                const query = await client.query('select now()');

                expect(pool.idleCount).to.equal(0);
                expect(pool.totalCount).to.equal(1);

                client.release();

                expect(pool.idleCount).to.equal(1);
                expect(pool.totalCount).to.equal(1);

                results.push(query);

                await wait(2);

                expect(pool.idleCount).to.equal(0);
                expect(pool.totalCount).to.equal(0);
            }

            expect(results).to.have.lengthOf(iterations);

            pool.shutdown(done);
        } catch (err) {
            done(err);
        }
    });

    it('does not time out clients which are used', async done => {
        const iterations = 20;
        const pool = createNewPool({idleTimeout: 1});
        const results = [];

        try {
            for (let i = 0; i < iterations; i++) {
                const client = await createClient(pool);

                expect(pool.idleCount).to.equal(0);
                expect(pool.totalCount).to.equal(1);

                await wait(10);

                results.push(await client.query('select now()'));
                client.release();

                expect(pool.idleCount).to.equal(1);
                expect(pool.totalCount).to.equal(1);

                await wait(5);

                expect(pool.idleCount).to.equal(0);
                expect(pool.totalCount).to.equal(0);
            }

            expect(results).to.have.length(iterations);

            pool.shutdown(done);
        } catch (err) {
            done(err);
        }
    });

    it('should removes client after timeout error', async done => {
        const idleTimeout = 400;
        const pool = createNewPool({connectionTimeout: 1, idleTimeout});
        let client, timeoutError;

        try {
            client = await createClient(pool);
        } catch (err) {
            timeoutError = err;
        }

        try {
            expect(timeoutError).to.be.an.instanceof(ConnectionError);
            expect(timeoutError.message).to.contain('Connection request has timed out');
            expect(client).to.be.undefined;

            expect(pool.idleCount).to.equal(0);
            expect(pool.totalCount).to.equal(1);

            await wait(200);

            expect(pool.idleCount).to.equal(1);
            expect(pool.totalCount).to.equal(1);

            await wait(idleTimeout);

            expect(pool.idleCount).to.equal(0);
            expect(pool.totalCount).to.equal(0);

            pool.shutdown(done);
        } catch (err) {
            pool.shutdown(() => done(err));
        }
    });

    it('should removes client after multiple timeout errors', async done => {
        const idleTimeout = 400;
        const iterations = 15;
        const pool = createNewPool({connectionTimeout: 1, idleTimeout, maxSize: iterations});
        const errors = [];

        try {
            const promises = [];

            for (let i = 0; i < iterations; i++) {
                promises.push(new Promise(resolve => {
                    pool.acquire(err => {
                        expect(err).to.be.an.instanceof(ConnectionError);
                        expect(err.message).to.contain('Connection request has timed out');
                        errors.push(err);
                        resolve();
                    });
                }));
            }

            await Promise.all(promises);

            expect(errors).to.have.lengthOf(iterations);

            expect(pool.idleCount).to.equal(0);
            expect(pool.totalCount).to.equal(iterations);

            await wait(250);

            expect(pool.idleCount).to.equal(iterations);
            expect(pool.totalCount).to.equal(iterations);

            await wait(idleTimeout);

            expect(pool.idleCount).to.equal(0);
            expect(pool.totalCount).to.equal(0);

            pool.shutdown(done);
        } catch (err) {
            pool.shutdown(() => done(err));
        }
    });
});
