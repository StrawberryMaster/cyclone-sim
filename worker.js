const WORKER_PATH = 'worker.js';

onmessage = function (e) {
    let task = e.data.task;
    let id = e.data.id;
    let input = e.data.input;
    let output;

    // test tasks
    if (task === 'addfive') output = input + 5;
    else if (task === 'saderror') return postMessage({ task, id, error: 'a sad error' });
    else if (task === 'loopy') {
        output = 3;
        for (let i = 0; i < input; i++) output *= 1.2;
    }
    else output = input;

    postMessage({ task, id, output });
};
class CSWorker {
    constructor() {
        this.worker = new Worker(WORKER_PATH);
        this.promiseHandlers = [];
        this.lowestFreeHandlerSlot = 0;
        this.worker.onmessage = e => {
            let id = e.data.id;
            if (e.data.error) return this.promiseHandlers[id].reject(e.data.error);
            this.promiseHandlers[id].resolve(e.data.output);
            this.promiseHandlers[id] = undefined;
            this.lowestFreeHandlerSlot = Math.min(this.lowestFreeHandlerSlot, id);
        };
    }

    run(task, input) {
        return new Promise((resolve, reject) => {
            let id = this.lowestFreeHandlerSlot;
            this.promiseHandlers[id] = { resolve, reject };
            this.lowestFreeHandlerSlot = Math.min(this.promiseHandlers.length, this.lowestFreeHandlerSlot + 1);
            this.worker.postMessage({
                task,
                id,
                input
            });
        });
    }
}