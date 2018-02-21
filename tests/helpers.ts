import * as net from 'net';
import {Client, ConnectionConfig} from 'pg';
import {buildLogger, Logger} from '../lib/util';
import {ConnectionPool, PoolOptions} from '../lib/Pool';
import {settings} from './settings';

export const FAKE_PG_SERVER_PORT = 3001;

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

export function removeAllClientAndShutdownPool(pool: ConnectionPool): Promise<void> {
    const removeClient = (client: Client) => {
        const idleTimeout = (pool as any).idle.get(client);

        if (idleTimeout) {
            clearTimeout(idleTimeout);
            (pool as any).idle.delete(client);
        }

        (pool as any).clients.delete(client);

        if ((client as any).connection) {
            (client as any).connection.stream.destroy();
        } else {
            client.end();
        }
    };

    const shutdownPool = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            pool.shutdown(error => {
                error ? reject(error) : resolve();
            });
        });
    };

    for (let client of (pool as any).clients.keys()) {
        removeClient(client);
    }

    return shutdownPool();
}

export function fakePgServer(cb: Function): net.Server {
    const server = net.createServer();

    server.listen(FAKE_PG_SERVER_PORT, cb);

    return server;
}
