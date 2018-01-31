import {expect} from 'chai';

import {Client} from 'pg';
import {ConnectionPool, PoolOptions} from '../lib/Pool';
import {buildLogger} from '../lib/util';
import {settings} from './settings';

const createNewPool = (): ConnectionPool => {
    return new ConnectionPool(settings.pool, settings.connection, buildLogger('test'));
};

describe('pool ending;', () => {
    it('ends without being used', (done) => {
        const pool = createNewPool();

        pool.shutdown(done);
    });

    it('ends with clients', done => {
        const pool = createNewPool();

        pool.acquire((err, client) => {
            expect(err).to.be.undefined;
            expect(client).to.not.be.undefined;
            expect(client).to.be.an.instanceof(Client);

            client.release();
            pool.shutdown(done);
        });
    });

    it('allows client to finish', done => {
        const pool = createNewPool();
        const name = 'brianc';

        pool.acquire((err, client) => {
            expect(err).to.be.undefined;
            expect(client).to.not.be.undefined;

            const query = client.query('SELECT $1::text as name', [name])
                .then(result => {
                    client.release();
                    return result;
                });

            const ending = new Promise(resolve => pool.shutdown(() => resolve(name)));

            Promise.all([query, ending])
                .then(([queryResult, endingResult]) => {
                    expect((queryResult as any).rows[0].name).to.equal(name);
                    expect(endingResult).to.equal(name);
                    done();
                });
        });
    });
});
