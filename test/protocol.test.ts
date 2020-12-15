import { expect } from 'chai';
import { gzipSync, gunzipSync } from 'zlib';
import { parse, M } from '../src/protocol';
import { Reserved, Ok, Watching, Found, Kicked, Buried } from '../src/types';
import { yamlList } from '../src/yaml-parser';

describe('protocol', () => {
  it('empty', () => {
    expect(() => parse(Buffer.from(''))).to.throw;
  });

  describe('INSERTED', () => {
    it('single', () => {
      const buffer = Buffer.from('INSERTED 42\r\n');
      const msg = parse(buffer);
      expect(msg).to.eql({ code: M.INSERTED, value: 42 });
    });
  });

  describe('USING', () => {
    it('single', () => {
      const buffer = Buffer.from('USING foo\r\n');
      const msg = parse(buffer);
      expect(msg).to.eql({ code: M.USING, value: 'foo' });
    });
  });

  describe('RESERVED', () => {
    it('single', () => {
      const buffer = Buffer.from('RESERVED 42 6\r\n123456\r\n');
      const msg = parse(buffer);
      expect(msg).to.eql({
        code: M.RESERVED,
        value: [42, Buffer.from('123456')],
      });
    });

    it('gzip payload', () => {
      const buf = gzipSync('Hello World');
      const buffer = Buffer.concat([
        Buffer.from(`RESERVED 42 ${buf.byteLength}\r\n`),
        buf,
        Buffer.from('\r\n'),
      ]);
      const msg = parse(buffer);
      const res = msg as Reserved;
      expect(res.code).to.equal(M.RESERVED);
      expect(res.value[0]).to.equal(42);
      expect(res.value[1]).to.eql(buf);
      expect(gunzipSync(res.value[1]).toString()).to.equal('Hello World');
    });
  });

  it('OK', () => {
    // prettier-ignore
    const payload = Buffer.from([
      '---',
      '- default',
      '- foo',
      '- bar',
      '- baz',
      '',
    ].join('\n'));
    const buffer = Buffer.concat([
      Buffer.from(`OK ${payload.byteLength}\r\n`),
      payload,
      Buffer.from('\r\n'),
    ]);
    const msg = parse(buffer);
    const res = msg as Ok;
    expect(res.code).to.equal(M.OK);
    expect(yamlList(res.value)).to.eql(['default', 'foo', 'bar', 'baz']);
  });

  it('FOUND', () => {
    const id = 42;
    const payload = Buffer.from('123456789');
    const buffer = Buffer.concat([
      Buffer.from(`FOUND ${id} ${payload.byteLength}\r\n`),
      payload,
      Buffer.from('\r\n'),
    ]);
    const msg = parse(buffer);
    const res = msg as Found;
    expect(res.code).to.equal(M.FOUND);
    expect(res.value[0]).to.equal(id);
    expect(res.value[1]).to.eql(payload);
  });

  it('KICKED', () => {
    const buffer = Buffer.from('KICKED\r\n');
    const msg = parse(buffer);
    const res = msg as Kicked;
    expect(res.code).to.equal(M.KICKED);
    expect(res.value).to.be.undefined;
  });

  it('KICKED (with id)', () => {
    const id = 42;
    const buffer = Buffer.from(`KICKED ${id}\r\n`);
    const msg = parse(buffer);
    const res = msg as Kicked;
    expect(res.code).to.equal(M.KICKED);
    expect(res.value).to.equal(id);
  });

  it('unfinished message', () => {
    expect(() => parse(Buffer.from('KICKED\r'))).to.throw;
  });

  it('JOB_TOO_BIG', () => {
    const buffer = Buffer.from('JOB_TOO_BIG\r\n');
    const msg = parse(buffer);
    expect(msg.code).to.equal(M.JOB_TOO_BIG);
  });

  it('BURIED', () => {
    const buffer = Buffer.from('BURIED\r\n');
    const msg = parse(buffer);
    expect(msg.code).to.equal(M.BURIED);
  });

  it('BURIED 42', () => {
    const buffer = Buffer.from('BURIED 42\r\n');
    const msg = parse(buffer);
    expect(msg.code).to.equal(M.BURIED);
    expect((msg as Buried).value).to.equal(42);
  });

  it('DRAINING', () => {
    const buffer = Buffer.from('DRAINING\r\n');
    const msg = parse(buffer);
    expect(msg.code).to.equal(M.DRAINING);
  });

  it('EXPECTED_CRLF', () => {
    const buffer = Buffer.from('EXPECTED_CRLF\r\n');
    const msg = parse(buffer);
    expect(msg.code).to.equal(M.EXPECTED_CRLF);
  });

  it('NOT_FOUND', () => {
    const buffer = Buffer.from('NOT_FOUND\r\n');
    const msg = parse(buffer);
    expect(msg.code).to.equal(M.NOT_FOUND);
  });
  
  it('DELETED', () => {
    const buffer = Buffer.from('DELETED\r\n');
    const msg = parse(buffer);
    expect(msg.code).to.equal(M.DELETED);
  });

  it('RELEASED', () => {
    const buffer = Buffer.from('RELEASED\r\n');
    const msg = parse(buffer);
    expect(msg.code).to.equal(M.RELEASED);
  });

  it('DEADLINE_SOON', () => {
    const buffer = Buffer.from('DEADLINE_SOON\r\n');
    const msg = parse(buffer);
    expect(msg.code).to.equal(M.DEADLINE_SOON);
  });

  it('NOT_IGNORED', () => {
    const buffer = Buffer.from('NOT_IGNORED\r\n');
    const msg = parse(buffer);
    expect(msg.code).to.equal(M.NOT_IGNORED);
  });

  it('TIMED_OUT', () => {
    const buffer = Buffer.from('TIMED_OUT\r\n');
    const msg = parse(buffer);
    expect(msg.code).to.equal(M.TIMED_OUT);
  });

  it('WATCHING', () => {
    const buffer = Buffer.from('WATCHING 42\r\n');
    const msg = parse(buffer);
    const res = msg as Watching;
    expect(res.code).to.equal(M.WATCHING);
    expect(res.value).to.equal(42);
  });
});
