import { RestroomResult } from "./restroom-result";

export type WorkerResult = {
  type: WorkerType; 
  hook?: any;
  restroomResult?: RestroomResult;
};

export enum WorkerType {
  HOOK, 
  RESTROOM_RESULT
}