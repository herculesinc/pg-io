import {expect} from 'chai';

import {createNewPool, createClient, wait, pgProxyServer, PROXY_SERVER_PORT} from './helpers';

let server;

describe('Pool size of 1;', () => {
    before(done => {
        server = pgProxyServer(250, done);
    });

    after(done => {
        server.close(done);
    });

    it('can create a single client and use it once', async done => {
        const pool = createNewPool({maxSize: 1});

        try {
            expect(pool.totalCount).to.equal(0);

            const client = await createClient(pool);
            const query = await client.query('SELECT $1::text as name', ['hi']);

            expect(query.rows[0].name).to.equal('hi');
            expect(pool.totalCount).to.equal(1);

            client.release();

            expect(pool.totalCount).to.equal(1);

            pool.shutdown(done);
        } catch (err) {
            pool.shutdown(() => done(err));
        }
    });

    it('can create a single client and use it multiple times', async done => {
        const pool = createNewPool({maxSize: 1, connectionTimeout: 300}, {port: PROXY_SERVER_PORT});
        let clientA, clientB;

        try {
            expect(pool.totalCount).to.equal(0);

            clientA = await createClient(pool);

            expect(pool.totalCount).to.equal(1);

            try {
                clientB = await createClient(pool);
            } catch (e) {

            }

            expect(clientA).to.not.be.undefined;
            expect(clientB).to.be.undefined;
            expect(pool.totalCount).to.equal(1);

            clientA.release();

            await wait(100);

            clientB = await createClient(pool);

            expect(clientB).to.not.be.undefined;
            expect(clientB).to.equal(clientA);
            expect(pool.totalCount).to.equal(1);

            clientB.release();

            pool.shutdown(done);
        } catch (err) {
            done(err);
        }
    });
});
