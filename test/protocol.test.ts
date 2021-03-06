import { expect } from 'chai';
import { gzipSync, gunzipSync } from 'zlib';
import { ParseContext } from '../src/internal_types';
import { parse, M } from '../src/protocol';
import { Reserved, Ok, Watching, Found, Kicked, Msg, Buried } from '../src/types';
import { yamlList } from '../src/yaml-parser';

describe('protocol', () => {
  it('empty', () => {
    const msgs: Msg[] = [];
    parse(new ParseContext(Buffer.from('')), msgs);
    expect(msgs).to.be.empty;
  });

  it('multichunk response', () => {
    const msgs: Msg[] = [];
    const ctx = new ParseContext(Buffer.from(`RESERVED 42 6\r\n123`));
    parse(ctx, msgs);
    expect(msgs.length).to.equal(0);
    ctx.append(Buffer.from(`456\r\n`));
    parse(ctx, msgs);
    expect(msgs.length).to.equal(1);
  });

  describe('INSERTED', () => {
    it('single', () => {
      const msgs: Msg[] = [];
      const buffer = Buffer.from('INSERTED 42\r\n');
      parse(new ParseContext(buffer), msgs);
      expect(msgs[0]).to.eql({ code: M.INSERTED, value: 42 });
    });

    it('multiple', () => {
      const msgs: Msg[] = [];
      const buffer = Buffer.from('INSERTED 42\r\nINSERTED 43\r\nINSERTED 44\r\n');
      const ctx = new ParseContext(buffer);
      parse(ctx, msgs);
      expect(msgs[0]).to.eql({ code: M.INSERTED, value: 42 });
      parse(ctx, msgs);
      expect(msgs[1]).to.eql({ code: M.INSERTED, value: 43 });
      parse(ctx, msgs);
      expect(msgs[2]).to.eql({ code: M.INSERTED, value: 44 });
    });
  });

  describe('USING', () => {
    it('single', () => {
      const msgs: Msg[] = [];
      const buffer = Buffer.from('USING foo\r\n');
      parse(new ParseContext(buffer), msgs);
      expect(msgs[0]).to.eql({ code: M.USING, value: 'foo' });
    });

    it('multiple', () => {
      const msgs: Msg[] = [];
      const buffer = Buffer.from('USING foo\r\nUSING bar\r\nUSING bloop\r\n');
      const ctx = new ParseContext(buffer);
      parse(ctx, msgs);
      expect(msgs[0]).to.eql({ code: M.USING, value: 'foo' });
      parse(ctx, msgs);
      expect(msgs[1]).to.eql({ code: M.USING, value: 'bar' });
      parse(ctx, msgs);
      expect(msgs[2]).to.eql({ code: M.USING, value: 'bloop' });
    });
  });

  describe('RESERVED', () => {
    it('single', () => {
      const msgs: Msg[] = [];
      const buffer = Buffer.from('RESERVED 42 6\r\n123456\r\n');
      parse(new ParseContext(buffer), msgs);
      expect(msgs[0]).to.eql({
        code: M.RESERVED,
        value: [42, Buffer.from('123456')],
      });
    });

    it('gzip payload', () => {
      const msgs: Msg[] = [];
      const buf = gzipSync('Hello World');
      const buffer = Buffer.concat([
        Buffer.from(`RESERVED 42 ${buf.byteLength}\r\n`),
        buf,
        Buffer.from('\r\n'),
      ]);
      parse(new ParseContext(buffer), msgs);
      const res = msgs[0] as Reserved;
      expect(res.code).to.equal(M.RESERVED);
      expect(res.value[0]).to.equal(42);
      expect(res.value[1]).to.eql(buf);
      expect(gunzipSync(res.value[1]).toString()).to.equal('Hello World');
    });
  });

  it('OK', () => {
    const msgs: Msg[] = [];
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
    parse(new ParseContext(buffer), msgs);
    const res = msgs[0] as Ok;
    expect(res.code).to.equal(M.OK);
    expect(yamlList(res.value)).to.eql(['default', 'foo', 'bar', 'baz']);
  });

  it('FOUND', () => {
    const msgs: Msg[] = [];
    const id = 42;
    const payload = Buffer.from('123456789');
    const buffer = Buffer.concat([
      Buffer.from(`FOUND ${id} ${payload.byteLength}\r\n`),
      payload,
      Buffer.from('\r\n'),
    ]);
    parse(new ParseContext(buffer), msgs);
    const res = msgs[0] as Found;
    expect(res.code).to.equal(M.FOUND);
    expect(res.value[0]).to.equal(id);
    expect(res.value[1]).to.eql(payload);
  });

  it('KICKED', () => {
    const msgs: Msg[] = [];
    const buffer = Buffer.from('KICKED\r\n');
    parse(new ParseContext(buffer), msgs);
    const res = msgs[0] as Kicked;
    expect(res.code).to.equal(M.KICKED);
    expect(res.value).to.be.undefined;
  });

  it('KICKED (with id)', () => {
    const msgs: Msg[] = [];
    const id = 42;
    const buffer = Buffer.from(`KICKED ${id}\r\n`);
    parse(new ParseContext(buffer), msgs);
    const res = msgs[0] as Kicked;
    expect(res.code).to.equal(M.KICKED);
    expect(res.value).to.equal(id);
  });

  it('unfinished message', () => {
    const msgs: Msg[] = [];
    parse(new ParseContext(Buffer.from('KICKED\r')), msgs);
    expect(msgs).to.be.empty;
  });

  it('JOB_TOO_BIG', () => {
    const msgs: Msg[] = [];
    const buffer = Buffer.from('JOB_TOO_BIG\r\n');
    parse(new ParseContext(buffer), msgs);
    expect(msgs[0].code).to.equal(M.JOB_TOO_BIG);
  });

  it('BURIED', () => {
    const msgs: Msg[] = [];
    const buffer = Buffer.from('BURIED\r\n');
    parse(new ParseContext(buffer), msgs);
    expect(msgs[0].code).to.equal(M.BURIED);
  });

  it('BURIED 42', () => {
    const msgs: Msg[] = [];
    const buffer = Buffer.from('BURIED 42\r\n');
    parse(new ParseContext(buffer), msgs);
    expect(msgs[0].code).to.equal(M.BURIED);
    expect((msgs[0] as Buried).value).to.equal(42);
  });

  it('DRAINING', () => {
    const msgs: Msg[] = [];
    const buffer = Buffer.from('DRAINING\r\n');
    parse(new ParseContext(buffer), msgs);
    expect(msgs[0].code).to.equal(M.DRAINING);
  });

  it('EXPECTED_CRLF', () => {
    const msgs: Msg[] = [];
    const buffer = Buffer.from('EXPECTED_CRLF\r\n');
    parse(new ParseContext(buffer), msgs);
    expect(msgs[0].code).to.equal(M.EXPECTED_CRLF);
  });

  it('NOT_FOUND', () => {
    const msgs: Msg[] = [];
    const buffer = Buffer.from('NOT_FOUND\r\n');
    parse(new ParseContext(buffer), msgs);
    expect(msgs[0].code).to.equal(M.NOT_FOUND);
  });
  
  it('DELETED', () => {
    const msgs: Msg[] = [];
    const buffer = Buffer.from('DELETED\r\n');
    parse(new ParseContext(buffer), msgs);
    expect(msgs[0].code).to.equal(M.DELETED);
  });

  it('RELEASED', () => {
    const msgs: Msg[] = [];
    const buffer = Buffer.from('RELEASED\r\n');
    parse(new ParseContext(buffer), msgs);
    expect(msgs[0].code).to.equal(M.RELEASED);
  });

  it('DEADLINE_SOON', () => {
    const msgs: Msg[] = [];
    const buffer = Buffer.from('DEADLINE_SOON\r\n');
    parse(new ParseContext(buffer), msgs);
    expect(msgs[0].code).to.equal(M.DEADLINE_SOON);
  });

  it('NOT_IGNORED', () => {
    const msgs: Msg[] = [];
    const buffer = Buffer.from('NOT_IGNORED\r\n');
    parse(new ParseContext(buffer), msgs);
    expect(msgs[0].code).to.equal(M.NOT_IGNORED);
  });

  it('TIMED_OUT', () => {
    const msgs: Msg[] = [];
    const buffer = Buffer.from('TIMED_OUT\r\n');
    parse(new ParseContext(buffer), msgs);
    expect(msgs[0].code).to.equal(M.TIMED_OUT);
  });

  it('WATCHING', () => {
    const msgs: Msg[] = [];
    const buffer = Buffer.from('WATCHING 42\r\n');
    parse(new ParseContext(buffer), msgs);
    const res = msgs[0] as Watching;
    expect(res.code).to.equal(M.WATCHING);
    expect(res.value).to.equal(42);
  });
});