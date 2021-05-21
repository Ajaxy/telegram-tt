const MessageContainer = require('../tl/core/MessageContainer');
const TLMessage = require('../tl/core/TLMessage');
const BinaryWriter = require('../extensions/BinaryWriter');

class MessagePacker {
    constructor(state, logger) {
        this._state = state;
        this._queue = [];
        this._pendingStates = [];
        this._ready = new Promise(((resolve) => {
            this.setReady = resolve;
        }));
        this._log = logger;
    }

    values() {
        return this._queue;
    }

    append(state) {
        this._queue.push(state);
        this.setReady(true);

        if (state) {
            this._pendingStates.push(state);
            state.promise
                // Using finally causes triggering `unhandledrejection` event
                .catch(() => {
                })
                .finally(() => {
                    this._pendingStates = this._pendingStates.filter((s) => s !== state);
                });
        }
    }

    extend(states) {
        for (const state of states) {
            this._queue.push(state);
        }
        this.setReady(true);
    }

    async get() {
        if (!this._queue.length) {
            this._ready = new Promise(((resolve) => {
                this.setReady = resolve;
            }));
            await this._ready;
        }
        if (!this._queue[this._queue.length - 1]) {
            this._queue = [];
            return undefined;
        }
        let data;
        let buffer = new BinaryWriter(Buffer.alloc(0));

        const batch = [];
        let size = 0;

        while (this._queue.length && batch.length <= MessageContainer.MAXIMUM_LENGTH) {
            const state = this._queue.shift();
            size += state.data.length + TLMessage.SIZE_OVERHEAD;
            if (size <= MessageContainer.MAXIMUM_SIZE) {
                let afterId;
                if (state.after) {
                    afterId = state.after.msgId;
                }
                state.msgId = await this._state.writeDataAsMessage(
                    buffer, state.data, state.request.classType === 'request',
                    afterId,
                );
                this._log.debug(`Assigned msgId = ${state.msgId} to ${state.request.className
                || state.request.constructor.name}`);
                batch.push(state);
                continue;
            }
            if (batch.length) {
                this._queue.unshift(state);
                break;
            }
            this._log.warn(`Message payload for ${state.request.className
            || state.request.constructor.name} is too long ${state.data.length} and cannot be sent`);
            state.reject('Request Payload is too big');
            size = 0;
        }
        if (!batch.length) {
            return undefined;
        }
        if (batch.length > 1) {
            const b = Buffer.alloc(8);
            b.writeUInt32LE(MessageContainer.CONSTRUCTOR_ID, 0);
            b.writeInt32LE(batch.length, 4);
            data = Buffer.concat([b, buffer.getValue()]);
            buffer = new BinaryWriter(Buffer.alloc(0));
            const containerId = await this._state.writeDataAsMessage(
                buffer, data, false,
            );
            for (const s of batch) {
                s.containerId = containerId;
            }
        }

        data = buffer.getValue();
        return {
            batch,
            data,
        };
    }

    rejectAll() {
        this._pendingStates.forEach((requestState) => {
            requestState.reject(new Error('Disconnect'));
        });
    }
}

module.exports = MessagePacker;
