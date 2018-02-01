import {Client, ConnectionConfig} from 'pg';
import {buildLogger, Logger} from '../lib/util';
import {ConnectionPool, PoolOptions} from '../lib/Pool';
import {settings} from './settings';

export function createNewPool(poolOptions: PoolOptions = {}, connectionOptions: ConnectionConfig = {}, logger?: Logger): ConnectionPool {
    const poolSettings = Object.assign({}, settings.pool, poolOptions);
    const connectionSettings = Object.assign({}, settings.connection, connectionOptions);
    const dbLogger = buildLogger('test', logger);

    return new ConnectionPool(poolSettings, connectionSettings, dbLogger);
}

export function wait(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

export function createClient(pool: ConnectionPool): Promise<Client> {
    return new Promise((resolve, reject) => pool.acquire((err, client) => err ? reject(err) : resolve(client)));
}
