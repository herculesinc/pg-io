import * as os from 'os';
import {exec} from 'child_process';
import {expect} from 'chai';

import {Database, ERROR_EVENT} from '../lib/Database';
import {Session} from '../lib/Session';
import {PoolState} from '../lib/Pool';
import {wait} from './helpers';

import {prepareDatabase} from './setup';
import {settings} from './settings';

const isWin = os.type().search('Windows') > -1;

let database, pool;
const pgServiceName = process.env.PG_SERVICE_NAME;

describe('Database;', function () {
    this.timeout(45000);

    before(async done => {
        try {
            database = new Database(settings);
            pool = database.pool;
            done();
        } catch (err) {
            done(err);
        }
    });

    after(async done => {
        try {
            await database.close();
            done();
        } catch (err) {
            done(err);
        }
    });

    describe('Loss connection;', () => {

        it('db pool should be empty', async done => {
            try {
                checkPoolState(0, 0, PoolState.active);

                done();

            } catch (err) {
                done(err);
            }
        });

        it('should return result without an error', async done => {
            try {
                const session = await connectToDatabase(database);
                await session.startTransaction();
                const user = await getUsers(session, 1);

                expect(user).to.not.be.undefined;
                expect(user.id).to.equal(1);

                checkPoolState(1, 0, PoolState.active);

                await session.close('commit');

                done();
            } catch (err) {
                done(err);
            }
        });

        it('db pool should be empty after idleTimeout time', async done => {
            try {
                await wait(settings.pool.idleTimeout);

                checkPoolState(0, 0, PoolState.active);

                done();

            } catch (err) {
                done(err);
            }
        });

        it('should return an error when connection is terminated', async done => {
            process.on('uncaughtException', done);

            database.on(ERROR_EVENT, function dbErrorHandler(err) {
                try {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.include('terminating connection');

                    checkPoolState(0, 0, PoolState.active);

                    done();
                } catch (error) {
                    done(error);
                } finally {
                    process.removeListener('uncaughtException', done);
                    database.removeListener('error', dbErrorHandler);
                }
            });

            try {
                const session = await connectToDatabase(database);
                await session.startTransaction();

                checkPoolState(1, 0, PoolState.active);

                await stopPostgresql();
            } catch (err) {
                done(err);
            }
        });

        it('should return ECONNREFUSED error', async done => {
            let session;

            try {
                checkPoolState(0, 0, PoolState.active);

                session = await connectToDatabase(database);
            } catch (err) {
                try {
                    expect(session).to.be.undefined;
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.include(isWin ? 'shutting down' : 'ECONNREFUSED');

                    checkPoolState(0, 0, PoolState.active);

                    done();
                } catch (error) {
                    done(error);
                }
            }
        });

        if (isWin) {
            it('waiting of pg service', async done => {
                await wait(20000);
                done();
            });
        }

        it('should return result without an error', async done => {
            try {
                await startPostgresql();
                const session = await connectToDatabase(database);
                await session.startTransaction();
                const user = await getUsers(session, 1);

                expect(user).to.not.be.undefined;
                expect(user.id).to.equal(1);

                checkPoolState(1, 0, PoolState.active);

                await session.close('commit');

                done();
            } catch (err) {
                done(err);
            }
        });

        it('db pool should be empty after idleTimeout time', async done => {
            try {
                await wait(settings.pool.idleTimeout);

                checkPoolState(0, 0, PoolState.active);

                done();

            } catch (err) {
                done(err);
            }
        });
    });
});

// helpers
function checkPoolState(totalCount, idleCount, state) {
    expect(pool.idleCount).to.equal(idleCount);
    expect(pool.totalCount).to.equal(totalCount);
    expect(pool.state).to.equal(state);
}

function connectToDatabase(db: Database): Promise<Session> {
    return db.connect();
}

async function getUsers(session: Session, userId: number): Promise<any> {
    await prepareDatabase(session);

    const query = {
        text: `SELECT * FROM tmp_users WHERE id=${userId};`,
        mask: 'single'
    };

    return await session.execute(query);
}

function execCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            const error = err || stderr;

            error ? reject(error) : resolve();
        });
    });
}

async function startPostgresql(): Promise<void> {
    const command = isWin
        ? `NET START "${pgServiceName}"`
        : 'brew services start postgresql';

    await execCommand(command);
    await wait(2000);
}

async function stopPostgresql(): Promise<void> {
    const command = isWin
        ? `NET STOP ${pgServiceName}`
        : 'brew services stop postgresql';

    await execCommand(command);
    await wait(2000);
}
