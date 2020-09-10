import { BeanstalkError } from '../src/error';
import { M } from '../src/protocol';
import { expect } from 'chai';

describe('error', () => {
  it('should contain code', () => {
    const err = new BeanstalkError('Hello', M.NOT_FOUND);
    expect(err.message).to.equal(`[${M.NOT_FOUND}] Hello`);
    expect(err.code).to.eql(M.NOT_FOUND);
  });
});