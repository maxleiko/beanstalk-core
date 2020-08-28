import { S, E } from './protocol';

export interface IPutOptions {
  priority: number;
  delay: number;
  ttr: number;
}

export interface IReleaseOptions {
  /**
   * a new priority to assign to the job
   */
  priority: number;
  /**
   * an integer number of seconds to wait before putting the job in
   * the ready queue. The job will be in the "delayed" state during this time.
   */
  delay: number;
}

export interface IPendingRequest {
  successCode: S;
  errorCodes: E[];
}