// IMPORTS
// ================================================================================================
import * as assert from 'assert';
import * as pg from './../index';
import { ListResultQuery, SingleResultQuery } from './../lib/Query';
import { PgError, ConnectionError, TransactionError, QueryError, ParseError } from './../lib/errors';
import { User, prepareDatabase, qFetchUserById, qFetchUsersByIdList } from './setup';

// CONNECTION SETTINGS
// ================================================================================================
const settings = {
    host    : 'localhost',
    port    : 5432,
    user    : 'postgres',
    password: 'RepT%8&G5l1I',
    database: 'postgres'
};

// TESTS
// ================================================================================================