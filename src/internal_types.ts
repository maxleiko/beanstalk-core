import { M } from './protocol';

export interface IPendingRequest {
  successCode: M;
  errorCodes: M[];
}

export type ParseContext = { buf: Buffer; offset: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type R<T = any> = { value: T };
