const { parentPort, workerData } = require('node:worker_threads');
const { initialize, evaluate, getBackend } = require('./engine.cjs');

initialize(workerData.modelDir).then(() => {
  parentPort.postMessage({ ready: true, backend: getBackend() });
  parentPort.on('message', async ({ operation, payload }) => {
    try {
      parentPort.postMessage({ result: await evaluate(operation, payload) });
    } catch (error) {
      parentPort.postMessage({ error: error.message });
    }
  });
}).catch(error => {
  console.error('Model AI gagal dimuat:', error.message);
  process.exit(1);
});
