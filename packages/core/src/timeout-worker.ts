import { parentPort, workerData } from 'worker_threads';
console.log("timeout started "+ Date.now());
setTimeout(function() {
    parentPort.postMessage("timeout");
}, workerData.value);