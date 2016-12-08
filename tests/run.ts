// IMPORTS
// ================================================================================================
import * as assert from 'assert';
import { Database } from './../index';
import { ListResultQuery, SingleResultQuery } from './../lib/Query';
import { User, prepareDatabase, qFetchUserById, qFetchRawUserById, qFetchUsersByIdList } from './setup';
import { MockLogger } from './mocks/Logger';

// OPTIONS
// ================================================================================================
const dbOptions = {
    name        : 'dbTest',
    pool: {
        maxSize : 10
    },
    connection: {
        host    : 'localhost',
        port    : 5432,
        user    : 'postgres',
        password: 'RepT%8&G5l1I',
        database: 'postgres'
    }
};

const sessionOpts = {
    logQueryText: true
}

// SETUP
// ================================================================================================
const logger = new MockLogger();
const database = new Database(dbOptions, logger);

// TESTS
// ================================================================================================
async function runTests() {
    const session = await database.connect(sessionOpts);
    await prepareDatabase(session);

    //const result = await session.execute(new qFetchUserById(1));
    //const results = await session.execute(new qFetchUsersByIdList([1, 2]));

    const rawResult = await session.execute(new qFetchRawUserById(1));
    console.log(rawResult);

    await session.close();
}

//runTests();