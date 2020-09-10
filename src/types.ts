import { M } from './protocol';

export type Scalar = string | number | boolean;

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

// export type AnyError =
//   | ExpectedCrlf
//   | InternalError
//   | JobTooBig
//   | BadFormat
//   | OutOfMemory
//   | UnknownCommand;

export type Msg =
  | BadFormat
  | Buried
  | DeadlineSoon
  | Deleted
  | Draining
  | ExpectedCrlf
  | Found
  | Inserted
  | InternalError
  | JobTooBig
  | Kicked
  | NotFound
  | NotIgnored
  | Ok
  | OutOfMemory
  | Paused
  | Released
  | Reserved
  | TimedOut
  | Touched
  | Using
  | Watching
  | UnknownCommand

export type BadFormat      = { code: M.BAD_FORMAT };
export type Buried         = { code: M.BURIED, value: number | undefined; };
export type DeadlineSoon   = { code: M.DEADLINE_SOON };
export type Deleted        = { code: M.DELETED };
export type Draining       = { code: M.DRAINING };
export type ExpectedCrlf   = { code: M.EXPECTED_CRLF };
export type Found          = { code: M.FOUND; value: [number, Buffer]; };
export type Inserted       = { code: M.INSERTED; value: number; };
export type InternalError  = { code: M.INTERNAL_ERROR };
export type JobTooBig      = { code: M.JOB_TOO_BIG };
export type Kicked         = { code: M.KICKED; value: number | undefined; };
export type NotFound       = { code: M.NOT_FOUND };
export type NotIgnored     = { code: M.NOT_IGNORED };
export type Ok             = { code: M.OK; value: Buffer; };
export type OutOfMemory    = { code: M.OUT_OF_MEMORY };
export type Paused         = { code: M.PAUSED };
export type Released       = { code: M.RELEASED };
export type Reserved       = { code: M.RESERVED; value: [number, Buffer]; };
export type TimedOut       = { code: M.TIMED_OUT };
export type Touched        = { code: M.TOUCHED };
export type UnknownCommand = { code: M.UNKNOWN_COMMAND };
export type Using          = { code: M.USING; value: string; };
export type Watching       = { code: M.WATCHING; value: number; };
