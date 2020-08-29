import { expect } from 'chai';
import { gzipSync, gunzipSync } from 'zlib';
import { parse, S, E } from './protocol';
import { Reserved, Ok, Watching, Found, Kicked } from './types';
import { yamlList } from './yaml-parser';

describe('protocol', () => {
  it('empty', () => {
    expect(() => parse(Buffer.from(''))).to.throw('Empty message');
  });

  describe('INSERTED', () => {
    it('single', () => {
      const results = parse(Buffer.from('INSERTED 42\r\n'));
      expect(results.length).to.equal(1);
      expect(results[0]).to.eql({ code: S.INSERTED, value: 42 });
    });

    it('multiple', () => {
      const results = parse(
        Buffer.from('INSERTED 42\r\nINSERTED 43\r\nINSERTED 44\r\n')
      );
      expect(results.length).to.equal(3);
      expect(results[0]).to.eql({ code: S.INSERTED, value: 42 });
      expect(results[1]).to.eql({ code: S.INSERTED, value: 43 });
      expect(results[2]).to.eql({ code: S.INSERTED, value: 44 });
    });
  });

  describe('USING', () => {
    it('single', () => {
      const results = parse(Buffer.from('USING foo\r\n'));
      expect(results.length).to.equal(1);
      expect(results[0]).to.eql({ code: S.USING, value: 'foo' });
    });

    it('multiple', () => {
      const results = parse(
        Buffer.from('USING foo\r\nUSING bar\r\nUSING bloop\r\n')
      );
      expect(results.length).to.equal(3);
      expect(results[0]).to.eql({ code: S.USING, value: 'foo' });
      expect(results[1]).to.eql({ code: S.USING, value: 'bar' });
      expect(results[2]).to.eql({ code: S.USING, value: 'bloop' });
    });
  });

  describe('RESERVED', () => {
    it('single', () => {
      const results = parse(Buffer.from('RESERVED 42 6\r\n123456\r\n'));
      expect(results.length).to.equal(1);
      expect(results[0]).to.eql({
        code: S.RESERVED,
        value: [42, Buffer.from('123456')],
      });
    });

    it('gzip payload', () => {
      const buf = gzipSync('Hello World');
      const msg = Buffer.concat([
        Buffer.from(`RESERVED 42 ${buf.byteLength}\r\n`),
        buf,
        Buffer.from('\r\n'),
      ]);
      const results = parse(msg);
      expect(results.length).to.equal(1);
      const res = results[0] as Reserved;
      expect(res.code).to.equal(S.RESERVED);
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
    const results = parse(
      Buffer.concat([
        Buffer.from(`OK ${payload.byteLength}\r\n`),
        payload,
        Buffer.from('\r\n'),
      ]),
    );
    expect(results.length).to.equal(1);
    const res = results[0] as Ok;
    expect(res.code).to.equal(S.OK);
    expect(yamlList(res.value)).to.eql(['default', 'foo', 'bar', 'baz']);
  });

  it('FOUND', () => {
    const id = 42;
    const payload = Buffer.from('123456789');
    const results = parse(
      Buffer.concat([
        Buffer.from(`FOUND ${id} ${payload.byteLength}\r\n`),
        payload,
        Buffer.from('\r\n'),
      ]),
    );
    expect(results.length).to.equal(1);
    const res = results[0] as Found;
    expect(res.code).to.equal(S.FOUND);
    expect(res.value[0]).to.equal(id);
    expect(res.value[1]).to.eql(payload);
  });

  it('KICKED', () => {
    const results = parse(Buffer.from('KICKED\r\n'));
    expect(results.length).to.equal(1);
    const res = results[0] as Kicked;
    expect(res.code).to.equal(S.KICKED);
    expect(res.value).to.be.undefined;
  });

  it('KICKED (with id)', () => {
    const id = 42;
    const results = parse(Buffer.from(`KICKED ${id}\r\n`));
    expect(results.length).to.equal(1);
    const res = results[0] as Kicked;
    expect(res.code).to.equal(S.KICKED);
    expect(res.value).to.equal(id);
  });

  it('KICKED (malformed)', () => {
    const msg = Buffer.from('KICKED\r');
    expect(() => parse(msg)).to.throw('Unable to parse beanstalk message');
  });

  it('JOB_TOO_BIG', () => {
    const results = parse(Buffer.from('JOB_TOO_BIG\r\n'));
    expect(results.length).to.equal(1);
    expect(results[0].code).to.equal(E.JOB_TOO_BIG);
  });

  it('BURIED', () => {
    const results = parse(Buffer.from('BURIED\r\n'));
    expect(results.length).to.equal(1);
    expect(results[0].code).to.equal(E.BURIED);
  });

  it('DRAINING', () => {
    const results = parse(Buffer.from('DRAINING\r\n'));
    expect(results.length).to.equal(1);
    expect(results[0].code).to.equal(E.DRAINING);
  });

  it('EXPECTED_CRLF', () => {
    const results = parse(Buffer.from('EXPECTED_CRLF\r\n'));
    expect(results.length).to.equal(1);
    expect(results[0].code).to.equal(E.EXPECTED_CRLF);
  });

  it('NOT_FOUND', () => {
    const results = parse(Buffer.from('NOT_FOUND\r\n'));
    expect(results.length).to.equal(1);
    expect(results[0].code).to.equal(E.NOT_FOUND);
  });
  
  it('DELETED', () => {
    const results = parse(Buffer.from('DELETED\r\n'));
    expect(results.length).to.equal(1);
    expect(results[0].code).to.equal(S.DELETED);
  });

  it('RELEASED', () => {
    const results = parse(Buffer.from('RELEASED\r\n'));
    expect(results.length).to.equal(1);
    expect(results[0].code).to.equal(S.RELEASED);
  });

  it('DEADLINE_SOON', () => {
    const results = parse(Buffer.from('DEADLINE_SOON\r\n'));
    expect(results.length).to.equal(1);
    expect(results[0].code).to.equal(E.DEADLINE_SOON);
  });

  it('NOT_IGNORED', () => {
    const results = parse(Buffer.from('NOT_IGNORED\r\n'));
    expect(results.length).to.equal(1);
    expect(results[0].code).to.equal(E.NOT_IGNORED);
  });

  it('TIMED_OUT', () => {
    const results = parse(Buffer.from('TIMED_OUT\r\n'));
    expect(results.length).to.equal(1);
    expect(results[0].code).to.equal(E.TIMED_OUT);
  });

  it('WATCHING', () => {
    const results = parse(Buffer.from('WATCHING 42\r\n'));
    expect(results.length).to.equal(1);
    const res = results[0] as Watching;
    expect(res.code).to.equal(S.WATCHING);
    expect(res.value).to.equal(42);
  });
});
