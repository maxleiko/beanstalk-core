import { E } from './protocol';

export class BeanstalkError extends Error {
  constructor(msg: string, readonly code: E) {
    super(`[${code}] ${msg}`);
  }
}
