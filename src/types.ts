export type userAttrs = {
    email?: string;
    name?: string;
};

export type sessionUrlCallback = (url: string) => void;

export enum ACTIVITY_TYPES {
    EVENTS = 'EVENTS',
    LOGS = 'LOGS',
    NETWORK = 'NETWORK',
}
