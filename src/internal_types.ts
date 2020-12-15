import { M } from './protocol';

export interface IPendingRequest {
  successCode: M;
  errorCodes: M[];
}

export class ParseContext {
  offset: number;

  constructor(private _buf: Buffer = Buffer.from([])) {
    this.offset = 0;
  }

  get buf(): Buffer {
    return this._buf;
  }

  append(chunk: Buffer): void {
    this._buf = Buffer.concat([this._buf, chunk]);
    this.offset = 0;
  }

  update(): void {
    this._buf = Buffer.from(this._buf.slice(this.offset));
    this.offset = 0;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type R<T = any> = { value: T };
