import { expect } from 'chai';
import BeanstalkClient from './client';

describe('beanstalkd', () => {
  let client: BeanstalkClient;
  beforeEach(async () => {
    client = new BeanstalkClient();
    await client.connect();
  });
  afterEach(async () => {
    await client.quit();
  });

  it('put', async () => {
    await client.connect();
    const id = await client.put('Hello World');
    expect(id).to.be.ok;
  });

  it('use', async () => {
    await client.connect();
    const tube = await client.use('foo');
    expect(tube).to.eql('foo');
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    client.put('Hello World 0');
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    client.put('Hello World 1');
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    client.put('Hello World 2');
    await client.put('Hello World 4');
  });
});