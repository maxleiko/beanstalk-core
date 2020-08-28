import { S, E } from './protocol';

export interface IPendingRequest {
  successCode: S;
  errorCodes: E[];
}

export type ParseContext = { buf: Buffer; offset: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type R<T = any> = { value: T };