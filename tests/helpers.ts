import * as net from 'net';
import {Client, ConnectionConfig} from 'pg';
import {buildLogger, Logger} from '../lib/util';
import {ConnectionPool, PoolOptions} from '../lib/Pool';
import {settings} from './settings';

export const PROXY_SERVER_PORT = 3000;

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

export function pgProxyServer(timeout: number, cb): net.Server {
    const server = net.createServer(proxySocket => {
        const pgSocket = new net.Socket();

        pgSocket.connect(settings.connection.port, settings.connection.host);

        proxySocket.on('data', data => {
            setTimeout(() => {
                const flushed = pgSocket.write(data);

                !flushed && proxySocket.pause();
            }, timeout);
        });

        pgSocket.on('data', data => {
            const flushed = proxySocket.write(data);

            !flushed && pgSocket.pause();
        });

        proxySocket.on('drain', () => pgSocket.resume());

        pgSocket.on('drain', () => proxySocket.resume());

        proxySocket.on('close', () => pgSocket.end());

        pgSocket.on('close', () => proxySocket.end());

    });

    server.listen(PROXY_SERVER_PORT, cb);

    return server;
}
