const WORKER_PATH = 'worker.js';

onmessage = function (e) {
    let { task, id, input } = e.data;
    let output;

    switch (task) {
        case 'addfive':
            output = input + 5;
            break;
        case 'saderror':
            postMessage({ task, id, error: 'a sad error' });
            return;
        case 'loopy':
            output = 3;
            for (let i = 0; i < input; i++) output *= 1.2;
            break;
        default:
            output = input;
    }

    postMessage({ task, id, output });
};

class CSWorker {
    constructor() {
        this.worker = new Worker(WORKER_PATH);
        this.promiseHandlers = {};
        this.idCounter = 0;

        this.worker.onmessage = e => {
            let id = e.data.id;
            if (e.data.error) return this.promiseHandlers[id].reject(e.data.error);
            this.promiseHandlers[id].resolve(e.data.output);
            delete this.promiseHandlers[id];
        };
    }

    run(task, input) {
        return new Promise((resolve, reject) => {
            let id = this.idCounter++;
            this.promiseHandlers[id] = { resolve, reject };
            this.worker.postMessage({ task, id, input });
        });
    }
}