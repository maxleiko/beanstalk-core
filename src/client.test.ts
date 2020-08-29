import { expect } from 'chai';
import { BeanstalkClient } from './client';

describe('BeanstalkClient', () => {
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
    expect(typeof id).to.equal('number');
    await client.delete(id);
  });

  it('reserve', async () => {
    await client.connect();
    const i = await client.put('Hello World');
    expect(typeof i).to.equal('number');
    const [id, payload] = await client.reserve();
    expect(payload.toString()).to.equal('Hello World');
    await client.delete(id);
  });

  it('reserve (timeout)', async () => {
    await client.connect();
    const i = await client.put('Hello World (timeout)');
    expect(typeof i).to.equal('number');
    const [id, payload] = await client.reserve(1000);
    expect(payload.toString()).to.equal('Hello World (timeout)');
    await client.delete(id);
  });

  it('release', async () => {
    await client.connect();
    const i = await client.put('Hello World (release)');
    expect(typeof i).to.equal('number');
    const [id, payload] = await client.reserve();
    expect(payload.toString()).to.equal('Hello World (release)');
    await client.release(id);
    const [id2, payload2] = await client.reserve();
    expect(payload2.toString()).to.equal('Hello World (release)');
    await client.delete(id2);
  });

  const to_delete: number[] = [];

  it('use', async () => {
    await client.connect();
    const tube = await client.use('foo');
    expect(tube).to.eql('foo');
    const tasks = [
      client.put('Hello World 0'),
      client.put('Hello World 1'),
      client.put('Hello World 2'),
      client.put('Hello World 4'),
    ];
    const ids = await Promise.all(tasks);
    to_delete.push(...ids);
  });

  it('delete', async () => {
    await client.connect();
    await client.use('foo');
    for (const id of to_delete) {
      await client.delete(id);
    }
  });

  it('listTubesWatched', async () => {
    await client.connect();
    let count = await client.watch('foo');
    expect(count).to.equal(2);
    count = await client.watch('bar');
    expect(count).to.equal(3);
    let list = await client.listTubesWatched();
    expect(list).to.eql(['default', 'foo', 'bar']);
    count = await client.ignore('foo');
    expect(count).to.equal(2);
    list = await client.listTubesWatched();
    expect(list).to.eql(['default', 'bar']);
  });
});