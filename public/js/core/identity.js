import { client } from './client.js';

client.actions.uuidv4 = function uuidv4() {
    return Math.random().toString(36).substring(2, 10);
};

export function initialize() {

}
