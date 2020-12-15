import { M } from './protocol';

export class BeanstalkError extends Error {
  constructor(msg: string, readonly code: M) {
    super(`[${code}] ${msg}`);
  }
}

export class BeanstalkClientError extends Error {}