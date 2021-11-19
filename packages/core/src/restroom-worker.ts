import { hook } from "./hooks";
import { zencode_exec } from "zenroom";
import { RestroomResult } from "./restroom-result";
import { parentPort, workerData } from 'worker_threads';
import { WorkerResult, WorkerType } from "./worker-result";

console.log("restroom started "+ Date.now());

const runHook = (hook: string, args: any) => {
  const workerResult : WorkerResult = {
    type: WorkerType.HOOK,
    hook: {
      hook: hook,
      args: args
    }
  }
  parentPort.postMessage(JSON.stringify(workerResult));
};

async function callRestroom(data: string, keys: string, conf:string, zencode:string, contractPath:string): Promise<WorkerResult>{
  
  let restroomResult: RestroomResult = {};
  let zenroom_result: string, json: string, zenroom_errors: string;
  zenroom_result = zenroom_errors = json = "";

  try {
    await runHook(hook.INIT, {});
    await runHook(hook.BEFORE, { zencode, conf, data, keys });
    await zencode_exec(zencode, {
      data: Object.keys(data).length ? JSON.stringify(data) : undefined,
      keys: keys,
      conf: conf,
    })
      .then(async ({ result }) => {
        zenroom_result = result;
        result = JSON.parse(result);
        await runHook(hook.SUCCESS, { result, zencode, zenroom_errors, outcome: restroomResult });
        restroomResult.result = result;
        restroomResult.status = 200;
      })
      .then(async (json) => {
        await runHook(hook.AFTER, { json, zencode, outcome: restroomResult });
      })
      .catch(async (e) => {
        zenroom_errors = e;
        await runHook(hook.ERROR, { zenroom_errors, zencode, outcome: restroomResult });
        restroomResult.error = e;
        restroomResult.errorMessage = `[ZENROOM EXECUTION ERROR FOR CONTRACT ${contractPath}]`;
      })
      .finally(async () => {
        await runHook(hook.FINISH, { outcome: restroomResult });
      });
  } catch (e) {
    await runHook(hook.EXCEPTION, {});
    restroomResult.errorMessage = `[UNEXPECTED EXCEPTION FOR CONTRACT ${contractPath}]`;
    restroomResult.error = e;
  }
  const result : WorkerResult = {
    type: WorkerType.RESTROOM_RESULT,
    restroomResult: restroomResult
  }
  return result;
}
const complexObject = JSON.parse(workerData.value);
callRestroom(
  complexObject.data, 
  complexObject.keys, 
  complexObject.conf, 
  complexObject.zencode, 
  complexObject.contractPath).then((res)=>{
    const result = JSON.stringify(res);
    parentPort.postMessage(result);
});

