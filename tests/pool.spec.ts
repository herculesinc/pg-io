import {expect} from 'chai';

import {ERROR_EVENT, CLOSED_EVENT} from '../lib/Pool';
import {createNewPool} from './helpers';
import {settings} from './settings';

describe('Pool;', () => {
    it('passes props to clients', done => {
        const pool = createNewPool();

        pool.acquire((err, client) => {
            if (err) return done(err);

            client.release();

            Object.keys(settings.connection).forEach(key => {
                const value = settings.connection[key];

                expect(client[key]).to.eql(value);
            });

            pool.shutdown(done);
        });
    });

    it('passes connection errors to callback', done => {
        const pool = createNewPool({}, {port: 53922});

        pool.acquire(err => {
            expect(err).to.be.an.instanceof(Error);

            pool.shutdown(done);
        });
    });

    it('does not pass client to error callback', done => {
        const pool = createNewPool({}, {port: 8080});

        pool.acquire((err, client) => {
            expect(client).to.be.undefined;

            // a connection error should not pollute the pool with a dead client
            expect(pool.totalCount).to.equal(0);

            pool.shutdown(done);
        });
    });

    it('removes client if it errors in background', done => {
        const pool = createNewPool();
        const errorMessage = 'on purpose';
        let testClient;

        pool.acquire((err, client) => {
            if (err) return done(err);

            testClient = client;

            testClient.release();

            setTimeout(() => {
                testClient.emit('error', new Error(errorMessage));
            }, 10);
        });

        pool.on(ERROR_EVENT, (err, client) => {
            expect(err.message).to.equal(errorMessage);
            expect(client).to.not.be.undefined;
            expect(client).to.equal(testClient);
        });

        pool.on(CLOSED_EVENT, (client) => {
            expect(client).to.equal(testClient);

            expect(pool.totalCount).to.equal(0);

            pool.shutdown(done);
        })
    });

    it('should not change given options', done => {
        const maxSize= 100;
        const options = {maxSize};
        const pool = createNewPool(options);

        pool.acquire((err, client) => {
            if (err) return done(err);

            client.release();

            expect(options).to.deep.equal({maxSize});

            pool.shutdown(done);
        });
    });

    it('never calls callback synchronously', done => {
        const pool = createNewPool();

        pool.acquire((err, client) => {
            if (err) return done(err);

            client.release();

            setImmediate(() => {
                let called = false;

                pool.acquire((err, client) => {
                    if (err) return done(err);

                    called = true;
                    client.release();

                    setImmediate(() => {
                        pool.shutdown(done);
                    })
                });

                expect(called).to.equal(false);
            })
        })
    })
});
