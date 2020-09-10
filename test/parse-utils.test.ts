import { char, lf, crlf, integer, float, dot, number, string, space, colon, boolean, scalar } from '../src/parse-utils';
import { expect } from 'chai';
import { R } from '../src/internal_types';
import { Scalar } from '../src/types';

const code = (v: string) => v.charCodeAt(0);

describe('parse-utils', () => {
  it('char', () => {
    const ctx = {
      buf: Buffer.from('f'),
      offset: 0,
    };
    const res = char(ctx, code('f'));
    expect(res).to.be.true;
    expect(ctx.offset).to.equal(1);
  });

  it('char fail', () => {
    const ctx = {
      buf: Buffer.from('d'),
      offset: 0,
    };
    const res = char(ctx, code('f'));
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('lf', () => {
    const ctx = {
      buf: Buffer.from('\n'),
      offset: 0,
    };
    const res = lf(ctx);
    expect(res).to.be.true;
    expect(ctx.offset).to.equal(1);
  });

  it('lf fail', () => {
    const ctx = {
      buf: Buffer.from('p'),
      offset: 0,
    };
    const res = lf(ctx);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('crlf', () => {
    const ctx = {
      buf: Buffer.from('a\r\n'),
      offset: 1,
    };
    const res = crlf(ctx);
    expect(res).to.be.true;
    expect(ctx.offset).to.equal(3);
  });

  it('crlf fail', () => {
    const ctx = {
      buf: Buffer.from('\r'),
      offset: 0,
    };
    const res = crlf(ctx);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('space', () => {
    const ctx = {
      buf: Buffer.from(' '),
      offset: 0,
    };
    const res = space(ctx);
    expect(res).to.be.true;
    expect(ctx.offset).to.equal(1);
  });

  it('space fail', () => {
    const ctx = {
      buf: Buffer.from('\r'),
      offset: 0,
    };
    const res = space(ctx);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('colon', () => {
    const ctx = {
      buf: Buffer.from(':'),
      offset: 0,
    };
    const res = colon(ctx);
    expect(res).to.be.true;
    expect(ctx.offset).to.equal(1);
  });

  it('colon fail', () => {
    const ctx = {
      buf: Buffer.from('\r'),
      offset: 0,
    };
    const res = colon(ctx);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('dot', () => {
    const ctx = {
      buf: Buffer.from('.'),
      offset: 0,
    };
    const res = dot(ctx);
    expect(res).to.be.true;
    expect(ctx.offset).to.equal(1);
  });

  it('dot fail', () => {
    const ctx = {
      buf: Buffer.from('nope'),
      offset: 0,
    };
    const res = dot(ctx);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('integer', () => {
    const ctx = {
      buf: Buffer.from('42g'),
      offset: 0,
    };
    const i: Partial<R<number>> = {};
    const res = integer(ctx, i);
    expect(res).to.be.true;
    expect(i.value).to.equal(42);
    expect(ctx.offset).to.equal(2);
  });

  it('integer empty', () => {
    const ctx = {
      buf: Buffer.from(''),
      offset: 0,
    };
    const i: Partial<R<number>> = {};
    const res = integer(ctx, i);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('integer fail', () => {
    const ctx = {
      buf: Buffer.from('y4'),
      offset: 0,
    };
    const i: Partial<R<number>> = {};
    const res = integer(ctx, i);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('float (no dot)', () => {
    const ctx = {
      buf: Buffer.from('42g'),
      offset: 0,
    };
    const f: Partial<R<number>> = {};
    const res = float(ctx, f);
    expect(res).to.be.true;
    expect(f.value).to.equal(42);
    expect(ctx.offset).to.equal(2);
  });

  it('float', () => {
    const ctx = {
      buf: Buffer.from('3.14'),
      offset: 0,
    };
    const f: Partial<R<number>> = {};
    const res = float(ctx, f);
    expect(res).to.be.true;
    expect(f.value).to.equal(3.14);
    expect(ctx.offset).to.equal(4);
  });

  it('float fail', () => {
    const ctx = {
      buf: Buffer.from('1..2'),
      offset: 0,
    };
    const f: Partial<R<number>> = {};
    const res = float(ctx, f);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('number (float)', () => {
    const ctx = {
      buf: Buffer.from('3.14'),
      offset: 0,
    };
    const n: Partial<R<number>> = {};
    const res = number(ctx, n);
    expect(res).to.be.true;
    expect(n.value).to.equal(3.14);
    expect(ctx.offset).to.equal(4);
  });

  it('number (int)', () => {
    const ctx = {
      buf: Buffer.from('42'),
      offset: 0,
    };
    const n: Partial<R<number>> = {};
    const res = number(ctx, n);
    expect(res).to.be.true;
    expect(n.value).to.equal(42);
    expect(ctx.offset).to.equal(2);
  });

  it('string', () => {
    const ctx = {
      buf: Buffer.from('potato '),
      offset: 0,
    };
    const s: Partial<R<string>> = {};
    const res = string(ctx, code(' '), s);
    expect(res).to.be.true;
    expect(s.value).to.equal('potato');
    expect(ctx.offset).to.equal(6);
  });

  it('boolean (true)', () => {
    const ctx = {
      buf: Buffer.from('truel'),
      offset: 0,
    };
    const b: Partial<R<boolean>> = {};
    const res = boolean(ctx, b);
    expect(res).to.be.true;
    expect(b.value).to.be.true;
    expect(ctx.offset).to.equal(4);
  });

  it('boolean (false)', () => {
    const ctx = {
      buf: Buffer.from('bfalse!'),
      offset: 1,
    };
    const b: Partial<R<boolean>> = {};
    const res = boolean(ctx, b);
    expect(res).to.be.true;
    expect(b.value).to.be.false;
    expect(ctx.offset).to.equal(6);
  });

  it('boolean fail', () => {
    const ctx = {
      buf: Buffer.from('bfalse!'),
      offset: 0,
    };
    const b: Partial<R<boolean>> = {};
    const res = boolean(ctx, b);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('scalar (boolean)', () => {
    const ctx = {
      buf: Buffer.from('bfalse!'),
      offset: 1,
    };
    const s: Partial<R<Scalar>> = {};
    const res = scalar(ctx, code('\n'), s);
    expect(res).to.be.true;
    expect(s.value).to.be.false;
    expect(ctx.offset).to.equal(6);
  });

  it('scalar (number)', () => {
    const ctx = {
      buf: Buffer.from('42'),
      offset: 0,
    };
    const s: Partial<R<Scalar>> = {};
    const res = scalar(ctx, code('\n'), s);
    expect(res).to.be.true;
    expect(s.value).to.equal(42);
    expect(ctx.offset).to.equal(2);
  });

  it('scalar (string)', () => {
    const ctx = {
      buf: Buffer.from('hello world'),
      offset: 0,
    };
    const s: Partial<R<Scalar>> = {};
    const res = scalar(ctx, code('\n'), s);
    expect(res).to.be.true;
    expect(s.value).to.equal('hello world');
    expect(ctx.offset).to.equal(11);
  });

  it('scalar (empty)', () => {
    const ctx = {
      buf: Buffer.from(''),
      offset: 0,
    };
    const s: Partial<R<Scalar>> = {};
    const res = scalar(ctx, code('\n'), s);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });
});
