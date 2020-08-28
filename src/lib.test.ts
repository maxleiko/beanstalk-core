import { app } from './lib';
import { expect } from 'chai';

describe('lib', () => {
  it('dummy', async () => {
    const result = await app({ dummy: 'World' });
    expect(result).to.equal('Hello World');
  });
});