import {expect} from 'chai';

import {createNewPool, createClient, wait} from './helpers';

describe('Pool size of 1;', () => {
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
        const pool = createNewPool({maxSize: 1, connectionTimeout: 400});
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
