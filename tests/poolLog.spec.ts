import {expect} from 'chai';

import {createNewPool, createClient} from './helpers';
import {Logger} from '../lib/util';

const createLogger = (messages: any): Logger => {
    return {
        debug: (message: string) => {
            (messages as any).debug.push(message);
        },
        info: (message: string) => {
            (messages as any).info.push(message);
        },
        warn: (message: string) => {
            (messages as any).warn.push(message);
        },
        trace: (source: string, command: string) => {
            (messages as any).trace.push(command);
        }
    };
};

describe('Pool logging;', () => {
    it('logs to supplied log function if given', async done => {
        const messages = {
            debug: [],
            info: [],
            warn: [],
            trace: []
        };

        const pool = createNewPool({}, {}, createLogger(messages));

        try {
            const client = await createClient(pool);

            client.release();

            expect(messages.debug).to.have.lengthOf.above(0);
            expect(messages.trace).to.have.lengthOf.above(0);

            expect(messages.info).to.have.lengthOf(0);
            expect(messages.warn).to.have.lengthOf(0);

            pool.shutdown(done);
        } catch( err ) {
            done(err);
        }
    });
});
