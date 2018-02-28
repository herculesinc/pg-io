import {expect} from 'chai';

import {ConnectionPool, PoolState} from '../lib/Pool';
import {createNewPool} from './helpers';

describe('Pool State;', () => {
    it('should return valid state', done => {
        const pool = createNewPool();

        checkState(pool, PoolState.active);

        pool.acquire((err, client) => {
            checkState(pool, PoolState.active);

            pool.shutdown(() => {
                checkState(pool, PoolState.closed);
                done();
            });

            checkState(pool, PoolState.closing);

            client.release();
        });
    });

    it('should return valid state', done => {
        const pool = createNewPool();

        checkState(pool, PoolState.active);

        pool.shutdown(() => {
            checkState(pool, PoolState.closed);
            done();
        });

        checkState(pool, PoolState.closed);
    });
});

// helpers
function checkState(pool: ConnectionPool, shouldBeState: PoolState): void {
    expect((pool as any).state).to.equal(shouldBeState);
}
