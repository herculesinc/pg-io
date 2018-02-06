import {expect} from 'chai';

import {ConnectionError} from '../lib/errors';
import {createNewPool, pgProxyServer, PROXY_SERVER_PORT} from './helpers';

const connectionOptions = {port: PROXY_SERVER_PORT};

let server;

describe('Pool connection timeout;', () => {
    before(done => {
        server = pgProxyServer(250, done);
    });

    after(done => {
        server.close(done);
    });

    it('should callback with an error if timeout is passed', done => {
        const pool = createNewPool({connectionTimeout: 150}, connectionOptions);

        pool.acquire((err, client) => {
            try {
                expect(err).to.be.an.instanceof(ConnectionError);
                expect(err.message).to.contain('Connection request has timed out');
                expect(pool.idleCount).to.equal(0);
                expect(pool.totalCount).to.equal(1);
                expect(client).to.be.undefined;

                pool.shutdown(done);
            } catch (err) {
                pool.shutdown(() => done(err));
            }
        });
    });

    it('should handle multiple timeouts', async done => {
        const iterations = 15;
        const pool = createNewPool({connectionTimeout: 150, maxSize: iterations}, connectionOptions);
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

            expect(errors).to.have.length(iterations);
            expect(pool.idleCount).to.equal(0);
            expect(pool.totalCount).to.equal(15);

            pool.shutdown(done);
        } catch (err) {
            pool.shutdown(() => done(err));
        }
    });

    it('should timeout on checkout of used connection', done => {
        const pool = createNewPool({connectionTimeout: 400, maxSize: 1}, connectionOptions);
        try {
            pool.acquire((err, client) => {
                expect(err).to.be.undefined;
                expect(client).to.not.be.undefined;
                expect(pool.totalCount).to.equal(1);

                pool.acquire((err, client) => {
                    expect(err).to.be.an.instanceof(ConnectionError);
                    expect(err.message).to.contain('Connection request has timed out');
                    expect(client).to.be.undefined;
                    expect(pool.totalCount).to.equal(1);

                    (pool as any).clients.entries().next().value[0].release();
                    pool.shutdown(done);
                });
            });
        } catch (err) {
            pool.shutdown(() => done(err));
        }
    });

    it('should timeout on query if all clients are busy', done => {
        const pool = createNewPool({connectionTimeout: 400, maxSize: 1}, connectionOptions);

        pool.acquire((err, client) => {
            expect(err).to.be.undefined;
            expect(client).to.not.be.undefined;

            client.query('select now()', () => {
                pool.acquire(err => {
                    expect(err).to.be.an.instanceof(ConnectionError);
                    expect(err.message).to.contain('Connection request has timed out');
                    expect(pool.idleCount).to.equal(0);
                    expect(pool.totalCount).to.equal(1);

                    client.release();
                    pool.shutdown(done);
                });
            });
        });
    });

    it('should recover from timeout errors', done => {
        const pool = createNewPool({connectionTimeout: 400, maxSize: 1}, connectionOptions);

        pool.acquire((err, client) => {
            expect(err).to.be.undefined;
            expect(client).to.not.be.undefined;

            client.query('select now()', () => {
                pool.acquire(err => {
                    expect(err).to.be.an.instanceof(ConnectionError);
                    expect(err.message).to.contain('Connection request has timed out');

                    client.release();

                    pool.acquire((err, client) => {
                        expect(err).to.be.undefined;

                        client.release();
                        pool.shutdown(done);
                    });
                });
            });
        });
    });
});
