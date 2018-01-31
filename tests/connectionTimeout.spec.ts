import * as net from 'net';
import {expect} from 'chai';

import {ConnectionPool, PoolOptions} from '../lib/Pool';
import {ConnectionError} from '../lib/errors';
import {settings} from './settings';
import {buildLogger} from '../lib/util';

describe('Pool connection timeout;', () => {
    before(done => {
        this.server = net.createServer();

        this.server.listen(() => {
            this.port = this.server.address().port;
            done();
        });

        this.createNewPool = (poolOptions: PoolOptions, defaultPort: boolean = true): ConnectionPool => {
            const logger = buildLogger('test');
            let connectionSettings = settings.connection;

            if (!defaultPort) {
                connectionSettings = Object.assign({}, connectionSettings, {port: this.port});
            }

            return new ConnectionPool(poolOptions, connectionSettings, logger);
        };
    });

    after(done => {
        this.server.close();
        done();
    });

    it('should callback with an error if timeout is passed', done => {
        const pool = this.createNewPool({connectionTimeout: 10}, false);

        pool.acquire((err, client) => {
            expect(err).to.be.an.instanceof(ConnectionError);
            expect(err.message).to.contain('Connection request has timed out');
            expect(pool.idleCount).to.equal(0);
            expect(pool.totalCount).to.equal(0);
            expect(client).to.be.undefined;

            pool.shutdown(done);
        });
    });

    it('should handle multiple timeouts', async done => {
        const pool = this.createNewPool({connectionTimeout: 10}, false);
        const iterations = 15;
        const errors = [];

        try {
            for (let i = 0; i < iterations; i++) {
                await new Promise(resolve => {
                    pool.acquire(err => {
                        expect(err).to.be.an.instanceof(ConnectionError);
                        expect(err.message).to.contain('Connection request has timed out');
                        errors.push(err);
                        resolve();
                    });
                });
            }

            expect(errors).to.have.length(iterations);
            expect(pool.idleCount).to.equal(0);
            expect(pool.totalCount).to.equal(0);

            done();
        } catch (e) {
            done(e);
        }

    });

    it('should timeout on checkout of used connection', done => {
        const pool = this.createNewPool({connectionTimeout: 100, maxSize: 1});

        pool.acquire((err, client) => {
            expect(err).to.be.undefined;
            expect(client).to.not.be.undefined;
            expect(pool.totalCount).to.equal(1);

            pool.acquire((err, client) => {
                expect(err).to.be.an.instanceof(ConnectionError);
                expect(err.message).to.contain('Connection request has timed out');
                expect(client).to.be.undefined;
                expect(pool.totalCount).to.equal(1);

                pool.clients.entries().next().value[0].release();
                pool.shutdown(done);
            });
        });
    });

    it('should timeout on query if all clients are busy', done => {
        const pool = this.createNewPool({connectionTimeout: 100, maxSize: 1});

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
        const pool = this.createNewPool({connectionTimeout: 100, maxSize: 1});

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
