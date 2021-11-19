import { getHooks, initHooks } from "./hooks";
import { getConf, getData, getKeys, getMessage, getYml, getContractByContractName, getContractFromPath } from "./utils";
import { addKeysToContext, addDataToContext, addNextToContext, addConfToContext } from "./context";
import { NextFunction, Request, Response } from "express";
import * as yaml from "js-yaml";
import { RestroomResult } from "./restroom-result";
import { Zencode } from "@restroom-mw/zencode";
import { BlockContext } from "./block-context";
import { CHAIN_EXTENSION } from "@restroom-mw/utils";
import { Worker } from 'worker_threads';
import TSWorker from 'ts-worker';
import { WorkerType } from "./worker-result";
const functionHooks = initHooks;

export default async (req: Request, res: Response, next: NextFunction) => {

  if (req.url === "/favicon.ico") {
    return;
  }

  const runHook = (hook: string, args: any) => {
    try {
      return getHooks(hook, res, args);
    } catch (e) {
      sendError(`[EXCEPTION IN REGISTERED HOOK ${hook}]`, e);
    }
  };

  /**
   * Centralized api error handling
   * @param {subject} string subject 
   * @param {e} NodeJS.ErrnoException error
   */
  const sendError = (subject: string, e: NodeJS.ErrnoException = null) => {
    const exception = e ? e.stack || e.message : "";
    const message = subject + "\n\n\n" + exception;
    if (e.code === "ENOENT") {
      getMessage(req).then( (mes)=>{
        res.status(404).send(mes);
      });
    } else{
      if (!res.headersSent) {
          res.status(500).json({
            zenroom_errors: zenroom_errors,
            result: zenroom_result,
            exception: message,
          });
          if (e) next(e);
      }
    }
  };

  /**
   * Centralized api response handling
   * @param {restroomResult} RestroomResult containing restroom result 
   * @param {res} Response endpoint response
   */
  const buildEndpointResponse = (restroomResult: RestroomResult, res: Response) => {
    if (restroomResult?.error) {
      sendError(restroomResult.errorMessage, restroomResult.error);
    } else {
      res.status(restroomResult.status).json(restroomResult?.result);
    }
  };

  async function resolveRestroomResult(restroomResult: RestroomResult): Promise<RestroomResult> {
    return new Promise((resolve) => {
      resolve(restroomResult);
    });
  };

  /**
   * Function responsible to execute the chain
   * @param {ymlFile} string containing restroom result 
   * @param {data} object data object coming from endpoint 
   */
  async function executeChain(fileContents: string, data: any): Promise<any> {
    const ymlContent: any = yaml.load(fileContents);
    const startBlock: string = ymlContent.start;
  
    return await evaluateBlock(startBlock, ymlContent, data);
  }

  const getRestroomResult = async (contractName:string, data:any) : Promise<RestroomResult> => {
    const isChain = contractName.split(".")[1] === CHAIN_EXTENSION || false;
    const keys = isChain ? "{}" : getKeys(contractName);
    try {
      return isChain ? executeChain(getYml(contractName.split(".")[0]), data) : callRestroomWithTimeout(data, keys, getConf(contractName), getContractByContractName(contractName), contractName);
    } catch (err){
      return await resolveRestroomResult({
        error: err
      });
    }
  }

  async function evaluateBlock(
    block: string,
    ymlContent: any,
    data: any
  ): Promise<RestroomResult> {
    console.debug("Current block is " + block);

    const singleContext: BlockContext = { keys: null, data: {}, next: null, conf: "", output:{}};
    try {

      addKeysToContext(singleContext, ymlContent.blocks[block]);
      addDataToContext(singleContext, data);
      addConfToContext(singleContext, ymlContent.blocks[block]);
      addNextToContext(singleContext, ymlContent.blocks[block]);
      const zencode = getContractFromPath(block);
      const restroomResult: any = await callRestroomWithTimeout(singleContext.data, JSON.stringify(singleContext.keys), singleContext.conf, zencode, block);
      if (restroomResult?.error) {
        return await resolveRestroomResult(restroomResult);
      }
      Object.assign(singleContext.output, restroomResult.result);

      if(!singleContext?.next){
        return await resolveRestroomResult({
          result: singleContext?.output,
          status: 200,
        });
      }
    } catch (err){
      return await resolveRestroomResult({
        error: err,
        errorMessage: `[CHAIN EXECUTION ERROR FOR CONTRACT ${block}]`
      });
    }
    return await evaluateBlock(singleContext.next, ymlContent, singleContext.output);
  }
  
  async function callRestroomWithTimeout(data: string, keys: string, conf:string, zencode:Zencode, contractPath:string):Promise<RestroomResult>{
    return new Promise((resolve) => {
      const inputData: any = {
        data,
        keys,
        conf,
        zencode:zencode.content,
        contractPath
      };
      console.log("restroom created "+Date.now());
      console.time("restroom");
      const restroomWorker: Worker = TSWorker('../src/restroom-worker.ts', {
        workerData: {
          value:JSON.stringify(inputData)
        }
      });
      console.log("timeout created "+Date.now());
      console.time("timeout");
      const timeoutWorker: Worker = TSWorker('../src/timeout-worker.ts', {
        workerData: {
          value: 10000
        }
      });
      
      restroomWorker.on('message', res => {
        const result = JSON.parse(res);
        if (result.type === WorkerType.HOOK){
          runHook(result.hook, result.args);
        } else if (result.type === WorkerType.RESTROOM_RESULT){
          timeoutWorker.terminate();
          console.log('Ho ammazzato timeout');
          console.timeEnd("timeout");
          console.timeEnd("restroom");
          resolve(result.restroomResult);
        }
      });
  
      timeoutWorker.on('message', res => {
        console.log('Ho ammazzato restroom');
        console.timeEnd("timeout");
        console.timeEnd("restroom");
        restroomWorker.terminate();
        resolve({
          error: Error("timeout"),
          errorMessage:"timeout"
        })
      });
    });
  }
  

  let zenroom_result: string, json: string, zenroom_errors: string;
  zenroom_result = zenroom_errors = json = "";
  const contractName = req.params["0"];
  let data = getData(req, res);
  
  res.set("x-powered-by", "RESTroom by Dyne.org");
  buildEndpointResponse(await getRestroomResult(contractName, data), res);
};

export const {
  onInit,
  onBefore,
  onAfter,
  onSuccess,
  onError,
  onException,
  onFinish,
} = functionHooks;

export { Restroom } from "./restroom";