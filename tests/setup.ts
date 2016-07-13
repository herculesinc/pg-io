// IMPORTS
// ================================================================================================
import { Connection } from './../lib/Connection';
import { Query, ResultQuery, SingleResultQuery, ListResultQuery } from './../lib/Query';

// INTERFACES
// ================================================================================================
export interface User {
    id          : number;
    username    : string;
    tags        : string[],
    createdOn   : Date;
    updatedOn   : Date;
}

// QUERIES
// ================================================================================================
class AbstractQuery implements Query {
    text: string;
    get name(): string { return (<any> this).constructor.name; }
}

class qInsertUser extends AbstractQuery {
    constructor(user: User) {
        super();
        this.text = `INSERT INTO tmp_users (id, username, created_on, updated_on)
            SELECT ${user.id}, '${user.username}', '${user.createdOn.toISOString() }', '${user.updatedOn.toISOString() }';`;
    }
}

class qDeleteUser extends AbstractQuery {
    constructor(user: User) {
        super();
        this.text = `DELETE FROM tmp_users WHERE id = ${user.id};`;
    }
}

class qUpdateUser extends AbstractQuery {
    constructor(user: User) {
        super();
        this.text = `UPDATE tmp_users SET
                        username = '${user.username}',
                        updated_on = '${user.updatedOn.toISOString() }'
                        WHERE id = ${user.id};`;
    }
}

export class qFetchUserById implements SingleResultQuery<User> {
    text: string;
    mask: 'object' = 'object';

    constructor(userId: number) {
        this.text = `
            SELECT id, username, created_on AS "createdOn", updated_on AS "updatedOn"
            FROM tmp_users WHERE id = ${userId};`;
    }

    get name(): string { return (<any> this).constructor.name; }
}

export class qFetchUsersByIdList implements ListResultQuery<User> {
    text: string;
    mask: 'list' = 'list';

    constructor(userIdList: number[]) {
        this.text = `
            SELECT id, username, created_on AS "createdOn", updated_on AS "updatedOn"
            FROM tmp_users WHERE id in (${userIdList.join(',') })
            ORDER BY id;`;
    }

    get name(): string { return (<any> this).constructor.name; }
}

export function prepareDatabase(conn: Connection): Promise<any> {
    return conn.execute([{ text: `DROP TABLE IF EXISTS tmp_users;` },
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