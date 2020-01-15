import * as rrweb from 'rrweb';

import { userAttrs, sessionUrlCallback, ACTIVITY_TYPES } from './types';
import { eventWithTime } from 'rrweb/typings/types';

const UI_DOMAIN = 'http://54.91.108.246:1234';
const DOMAIN = `https://track.vidcrunch.com`;

const getSessionUrl = (sessionId: string): string => `${UI_DOMAIN}/session/${sessionId}`;

const PATHES: { [key in ACTIVITY_TYPES]: string } = {
    [ACTIVITY_TYPES.EVENTS]: `${DOMAIN}/event`,
    [ACTIVITY_TYPES.LOGS]: `${DOMAIN}/log`,
    [ACTIVITY_TYPES.NETWORK]: `${DOMAIN}/network`,
};

const IDENTIFY_URL = `${DOMAIN}/session/identify`;
const INIT_URL = `${DOMAIN}/session/init`;

class RrWebLogger {
    constructor() {
        this.initNetworkStore();
    }
    private appID = '';
    private sessionId = '';
    private events: eventWithTime[] = [];
    public async init(appID: string, sessionId: string): Promise<void> {
        await this.initSession(appID, sessionId);
        this.appID = appID;
        this.sessionId = sessionId;
        this.initEventsStore();
        this.initLogStore();
        this.initNetworkStore();
    }
    public async identify(id: string, { name, email }: userAttrs): Promise<void> {
        await fetch(IDENTIFY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: { id, name, email }, sessionId: this.sessionId, appID: this.appID }),
        });
    }

    public captureException(error: Error): void {
        this.sendActivity(ACTIVITY_TYPES.LOGS, { timestamp: Date.now(), error });
    }

    public getSessionURL(callback: sessionUrlCallback): void {
        callback(getSessionUrl(this.sessionId));
    }

    private async initSession(appID: string, sessionId: string): Promise<void> {
        await fetch(INIT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId: sessionId, appID: appID }),
        });
    }
    private initEventsStore(): void {
        rrweb.record({
            emit: event => {
                this.events.push(event);
            },
        });

        window.addEventListener('beforeunload', () => {
            this.sendActivity(ACTIVITY_TYPES.EVENTS, this.events);
        });

        setInterval(() => {
            if (this.events.length) {
                this.sendActivity(ACTIVITY_TYPES.EVENTS, this.events);
            }
            this.events = [];
        }, 10 * 1000);
    }

    private initLogStore(): void {
        const onerror = window.onerror;
        window.onerror = (...args): void => {
            if (onerror) {
                onerror(...args);
            }
            this.sendActivity(ACTIVITY_TYPES.LOGS, { timestamp: Date.now(), error: args[0] });
        };
    }

    private initNetworkStore(): void {
        const fetch = window.fetch;
        window.fetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
            const request = new Request(input, init);
            const response = await fetch(input, init);
            if (this.sessionId && !request.url.includes(DOMAIN)) {
                const requestContentType = request.headers.get('Content-Type');
                const responseContentType = response.headers.get('Content-Type');
                this.sendActivity(ACTIVITY_TYPES.NETWORK, {
                    timestamp: Date.now(),
                    request: {
                        url: request.url,
                        method: request.method,
                        contentType: requestContentType,
                        playload:
                            requestContentType &&
                            ['application/json'].includes(requestContentType) &&
                            (await request.clone().text()),
                    },
                    response: {
                        json:
                            responseContentType &&
                            ['application/json'].includes(responseContentType) &&
                            (await response.clone().text()),
                        status: response.status,
                        contentType: responseContentType,
                        statusText: response.statusText,
                    },
                });
            }
            return response;
        };
    }

    private sendActivity(activity: ACTIVITY_TYPES, data: object | object[]): Promise<Response> {
        return fetch(PATHES[activity], {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data, sessionId: this.sessionId, appID: this.appID }),
        });
    }
}

export default new RrWebLogger();
