import { BeanstalkError } from './error';
import { E } from './protocol';
import { expect } from 'chai';

describe('BeanstalkError', () => {
  it('should contain code', () => {
    const err = new BeanstalkError('Hello', E.NOT_FOUND);
    expect(err.message).to.equal(`[${E.NOT_FOUND}] Hello`);
    expect(err.code).to.eql(E.NOT_FOUND);
  });
});