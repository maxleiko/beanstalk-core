import { E, S } from './protocol';

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

export type Msg =
  | AnyError
  | Ok
  | Inserted
  | Deleted
  | Using
  | Reserved
  | Released
  | NotFound
  | Buried
  | ExpectedCrlf
  | JobTooBig
  | Draining
  | Watching
  | NotIgnored
  | Found
  | Kicked
  | Paused
  | Touched;

export type AnyError     = { code: E; };
export type Deleted      = { code: S.DELETED; };
export type Released     = { code: S.RELEASED; };
export type NotFound     = { code: E.NOT_FOUND; };
export type Buried       = { code: E.BURIED; };
export type ExpectedCrlf = { code: E.EXPECTED_CRLF; };
export type JobTooBig    = { code: E.JOB_TOO_BIG; };
export type Draining     = { code: E.DRAINING; };
export type NotIgnored   = { code: E.NOT_IGNORED; };
export type Paused       = { code: S.PAUSED; };
export type Touched      = { code: S.TOUCHED; };
export type Inserted     = { code: S.INSERTED; value: number; };
export type Using        = { code: S.USING; value: string; };
export type Ok           = { code: S.OK; value: Buffer; };
export type Reserved     = { code: S.RESERVED; value: [number, Buffer]; };
export type Found        = { code: S.FOUND; value: [number, Buffer]; };
export type Watching     = { code: S.WATCHING; value: number; };
export type Kicked       = { code: S.KICKED; value: number | undefined; };