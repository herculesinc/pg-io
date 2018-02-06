const { execSync } = require('child_process');
const http = require('http');

console.log('Compiling...');
execSync('gulp compile');

const { Database } = require('../bin');

const settings = {
    connection: {
        host    : 'localhost',
        port    : 5432,
        user    : 'postgres',
        password: 'RepT%8&G5l1I',
        database: 'postgres'
    },
    pool: {
        log: console.log.bind(console.log, 'pg-pool:')
    }
};

const database = new Database(settings);

database.on('error', () => {});

process.on('uncaughtException', e => console.log('process.uncaughtException', e.toString()));

let counter = 0;

const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') {
        return res.end();
    }
    if (!counter) {
        console.log('--------------------');
    }

    const start = counter % 4 === 0;
    const stop  = counter % 4 === 2;

    counter++;

    const preAction = start
        ? startPostgresql()
        : Promise.resolve();

    preAction
        .then(() => connectToDatabase(database))
        .then(session => {
            return session.startTransaction()
                .then(() => prepareDatabase(session))
                .then(async () => stop && await stopPostgresql())
                .then(() => {
                    const query = {
                        text: `SELECT * FROM tmp_users WHERE id = ${counter % 5};`,
                        mask: 'list'
                    };

                    return session.execute(query)
                })
                .then(result => session.close('commit').then( () => result))
                .then(sendResult(res))
                .catch(sendResult(res, true));
        })
        .catch(sendResult(res, true));
}).listen(3000);

server.on('listening', () => {
    console.log('server listening...');
});

function sendResult(res, isError) {
    return data => {
        console.log(isError ? 'Sending Error...' : 'Sending results...');
        res.end(isError ? data.toString() : JSON.stringify(data));
        console.log('--------------------');
        showPgPoolData();
    }
}

function showPgPoolData() {
    setTimeout(() => {
        console.log('PgPool info');
        console.log(`All clients     - [${[ ...database.pool.clients ].map(c => c.processID).join(',')}]`);
        console.log(`Idle clients    - [${[ ...database.pool.idle.keys() ].map(c => c.processID).join(',')}]`);
        console.log('--------------------');
    }, 1000);
}

function connectToDatabase(db) {
    console.log('Connecting to database...');
    return db.connect()
}

function startPostgresql () {
    return new Promise(resolve => {
        console.log('Starting \'postgresql\'...');
        execSync('brew services start postgresql');

        setTimeout(() => {
            console.log('Successfully started \'postgresql\'');
            resolve();
        }, 2000);
    });
}

function stopPostgresql () {
    return new Promise(resolve => {
        console.log('Stopping \'postgresql\'...');
        execSync('brew services stop postgresql');

        setTimeout(() => {
            console.log('Successfully stopped \'postgresql\'');
            resolve();
        }, 1000);
    });
}

function prepareDatabase(conn) {
    console.log('Preparing database...');
    console.log('Using client', conn.client.processID);

    return conn.execute([
        {
            text: `DROP TABLE IF EXISTS tmp_users;`
        },
        {
            text: `SELECT * INTO TEMPORARY tmp_users
                FROM (VALUES 
		            (1::int, 'Irakliy'::VARCHAR, '["test","testing"]'::jsonb,   now()::timestamptz, now()::timestamptz),
		            (2::int, 'Yason'::VARCHAR, 	 '["test1","testing1"]'::jsonb, now()::timestamptz, now()::timestamptz),
		            (3::int, 'George'::VARCHAR,  '["test2","testing2"]'::jsonb, now()::timestamptz, now()::timestamptz),
                    (4::int, 'T''est'::VARCHAR,  '["test3","testing3"]'::jsonb, now()::timestamptz, now()::timestamptz)
	            ) AS q (id, username, tags, created_on, updated_on);`
        }
    ]);
}
