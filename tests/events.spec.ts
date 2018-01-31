import {expect} from 'chai';
import {EventEmitter} from 'events';

import {Client, QueryResult} from 'pg';
import {ConnectionPool, PoolOptions, ERROR_EVENT, CREATED_EVENT, CLOSED_EVENT} from '../lib/Pool';
import {ConnectionError} from '../lib/errors';
import {settings} from './settings';
import {buildLogger} from '../lib/util';

const createNewPool = (): ConnectionPool => {
    return new ConnectionPool(settings.pool, settings.connection, buildLogger('test'));
};

describe('events;', () => {
    it('emits acquire before callback', done => {
        const pool = createNewPool();
        let emittedClient;

        pool.on(CREATED_EVENT, client => {
            emittedClient = client;
        });

        pool.acquire((err, client) => {
            if (err) return done(err);
            client.release();
            expect(client).to.equal(emittedClient);
            pool.shutdown(done);
        });
    });

    it('emits closed after callback', done => {
        const pool = createNewPool();
        let poolClient;

        pool.on(CLOSED_EVENT, client => {
            expect(client).to.equal(poolClient);
            done();
        });

        pool.acquire((err, client) => {
            if (err) return done(err);
            poolClient = client;
            client.release();

            pool.shutdown(err => {
                if (err) {
                    done(err);
                }
            });
        });
    });

    it('emits acquire every time a client is acquired', done => {
        const iterations = 10;
        const pool = createNewPool();
        let acquireCount = 0;

        pool.on(CREATED_EVENT, client => {
            expect(client).to.not.be.undefined;
            acquireCount++;
        });

        for (let i = 0; i < iterations; i++) {
            pool.acquire((err, client) => {
                if (err) return done(err);

                client.query('SELECT now()')
                    .then(() => client.release())
                    .catch(done);
            })

        }

        setTimeout(() => {
            expect(acquireCount).to.equal(iterations);
            pool.shutdown(done);
        }, 1000);
    });

    it('emits error and client if an idle client in the pool hits an error', function (done) {
        const pool = createNewPool();

        pool.acquire((err, client) => {
            expect(err).to.be.undefined;

            client.release();

            setImmediate(function () {
                client.emit('error', new Error('problem'));
            });

            pool.once(ERROR_EVENT, function (err, errClient) {
                expect(err.message).to.equal('problem');
                expect(errClient).to.equal(client);
                done();
            });
        });
    });
});
