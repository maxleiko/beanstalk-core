import { expect } from 'chai';
import { BeanstalkClient } from '../src/client';
import { IPutOptions } from '../src/types';

const HOST = process.env.HOST ?? 'localhost';
const PORT = parseInt(process.env.PORT ?? '11301', 10);

describe('BeanstalkClient', () => {
  let client: BeanstalkClient;
  beforeEach(async () => {
    client = new BeanstalkClient();
    await client.connect(HOST, PORT);
  });
  afterEach(async () => {
    await client.quit();
  });

  it('put', async () => {
    await client.connect(HOST, PORT);
    const id = await client.put('Hello World');
    expect(typeof id).to.equal('number');
    await client.delete(id);
  });


  it('batch put', async () => {
    await client.connect(HOST, PORT);
    const tasks = [
      client.put('Hello World 0'),
      client.put('Hello World 1'),
      client.put('Hello World 2'),
      client.put('Hello World 4'),
    ];
    const ids = await Promise.all(tasks);
    expect(ids[1]).to.be.greaterThan(ids[0]);
    for (const id of ids) {
      await client.delete(id);
    }
  });

  it('reserve', async () => {
    await client.connect(HOST, PORT);
    const i = await client.put('Hello World');
    expect(typeof i).to.equal('number');
    const [id, payload] = await client.reserve();
    expect(payload.toString()).to.equal('Hello World');
    await client.delete(id);
  });

  it('reserve (timeout)', async () => {
    await client.connect(HOST, PORT);
    await client.put('Hello World (timeout)');
    const [id, payload] = await client.reserve(1000);
    expect(payload.toString()).to.equal('Hello World (timeout)');
    await client.delete(id);
  });

  it('peek', async () => {
    await client.connect(HOST, PORT);
    const id = await client.put('Hello peek');
    const [id2, payload2] = await client.peek(id);
    expect(id2).to.equal(id);
    expect(payload2.toString()).to.equal('Hello peek');
    await client.delete(id);
  });

  it('peekReady', async () => {
    await client.connect(HOST, PORT);
    const id = await client.put('Hello peek ready');
    const [id2, payload2] = await client.peekReady();
    expect(id2).to.equal(id);
    expect(payload2.toString()).to.equal('Hello peek ready');
    await client.delete(id);
  });

  it('peekDelayed', async () => {
    await client.connect(HOST, PORT);
    const opts: IPutOptions = {
      priority: 0,
      delay: 2000,
      ttr: 60,
    };
    const id = await client.put('Hello peek delayed', opts);
    const [id2, payload2] = await client.peekDelayed();
    expect(id2).to.equal(id);
    expect(payload2.toString()).to.equal('Hello peek delayed');
    await client.delete(id);
  });

  it('peekBuried', async () => {
    await client.connect(HOST, PORT);
    const id = await client.put('Hello peek buried');
    await client.reserve();
    await client.bury(id);
    const [id2, payload2] = await client.peekBuried();
    expect(id2).to.equal(id);
    expect(payload2.toString()).to.equal('Hello peek buried');
    await client.delete(id2);
  });

  it('kick', async () => {
    await client.connect(HOST, PORT);
    const id = await client.put('Hello kick');
    await client.reserve();
    await client.bury(id);
    let stats = await client.statsJob(id);
    expect(stats['state']).to.equal('buried');
    await client.kick(1);
    stats = await client.statsJob(id);
    expect(stats['state']).to.equal('ready');
    await client.delete(id);
  });

  it('kickJob', async () => {
    await client.connect(HOST, PORT);
    const id = await client.put('Hello kick');
    await client.reserve();
    await client.bury(id);
    let stats = await client.statsJob(id);
    expect(stats['state']).to.equal('buried');
    await client.kickJob(id);
    stats = await client.statsJob(id);
    expect(stats['state']).to.equal('ready');
    await client.delete(id);
  });

  it('release', async () => {
    await client.connect(HOST, PORT);
    const i = await client.put('Hello World (release)');
    expect(typeof i).to.equal('number');
    const [id, payload] = await client.reserve();
    expect(payload.toString()).to.equal('Hello World (release)');
    await client.release(id);
    const [id2, payload2] = await client.reserve();
    expect(payload2.toString()).to.equal('Hello World (release)');
    await client.delete(id2);
  });

  it('stats', async () => {
    await client.connect(HOST, PORT);
    const stats = await client.stats();
    expect(stats).to.be.ok;
  });

  it('statsTube', async () => {
    await client.connect(HOST, PORT);
    const stats = await client.statsTube('default');
    expect(stats).to.be.ok;
    expect(stats['name']).to.equal('default');
  });

  it('listTubes', async () => {
    await client.connect(HOST, PORT);
    let tubes = await client.listTubes();
    expect(tubes).to.eql(['default']);
    await client.use('foo');
    tubes = await client.listTubes();
    expect(tubes).to.eql(['default', 'foo']);
  });

  it('listTubesWatched', async () => {
    await client.connect(HOST, PORT);
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

  it('listTubeUsed', async () => {
    await client.connect(HOST, PORT);
    let tube = await client.listTubeUsed();
    expect(tube).to.equal('default');
    await client.use('foo');
    tube = await client.listTubeUsed();
    expect(tube).to.equal('foo');
  });

  it('pause', async () => {
    await client.connect(HOST, PORT);
    await client.use('paused');
    await client.pause('paused', 1);
    // wait a bit
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  it('touch', async () => {
    await client.connect(HOST, PORT);
    const id = await client.put('Hello touch', { priority: 0, delay: 0, ttr: 2 });
    const [id2] = await client.reserve();
    expect(id2).to.equal(id);
    await client.touch(id);
    await client.delete(id);
  });
});