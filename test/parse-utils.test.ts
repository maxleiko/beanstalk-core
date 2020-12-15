import { char, lf, crlf, integer, float, dot, number, string, space, colon, boolean, scalar } from '../src/parse-utils';
import { expect } from 'chai';
import { ParseContext, R } from '../src/internal_types';
import { Scalar } from '../src/types';

const code = (v: string) => v.charCodeAt(0);

describe('parse-utils', () => {
  it('char', () => {
    const ctx = new ParseContext(Buffer.from('f'));
    const res = char(ctx, code('f'));
    expect(res).to.be.true;
    expect(ctx.offset).to.equal(1);
  });

  it('char fail', () => {
    const ctx = new ParseContext(Buffer.from('d'));
    const res = char(ctx, code('f'));
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('lf', () => {
    const ctx = new ParseContext(Buffer.from('\n'));
    const res = lf(ctx);
    expect(res).to.be.true;
    expect(ctx.offset).to.equal(1);
  });

  it('lf fail', () => {
    const ctx = new ParseContext(Buffer.from('p'));
    const res = lf(ctx);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('crlf', () => {
    const ctx = new ParseContext(Buffer.from('\r\n'));
    const res = crlf(ctx);
    expect(res).to.be.true;
    expect(ctx.offset).to.equal(2);
  });

  it('crlf fail', () => {
    const ctx = new ParseContext(Buffer.from('\r'));
    const res = crlf(ctx);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('space', () => {
    const ctx = new ParseContext(Buffer.from(' '));
    const res = space(ctx);
    expect(res).to.be.true;
    expect(ctx.offset).to.equal(1);
  });

  it('space fail', () => {
    const ctx = new ParseContext(Buffer.from('\r'));
    const res = space(ctx);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('colon', () => {
    const ctx = new ParseContext(Buffer.from(':'));
    const res = colon(ctx);
    expect(res).to.be.true;
    expect(ctx.offset).to.equal(1);
  });

  it('colon fail', () => {
    const ctx = new ParseContext(Buffer.from('\r'));
    const res = colon(ctx);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('dot', () => {
    const ctx = new ParseContext(Buffer.from('.'));
    const res = dot(ctx);
    expect(res).to.be.true;
    expect(ctx.offset).to.equal(1);
  });

  it('dot fail', () => {
    const ctx = new ParseContext(Buffer.from('nope'));
    const res = dot(ctx);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('integer', () => {
    const ctx = new ParseContext(Buffer.from('42g'));
    const i: Partial<R<number>> = {};
    const res = integer(ctx, i);
    expect(res).to.be.true;
    expect(i.value).to.equal(42);
    expect(ctx.offset).to.equal(2);
  });

  it('integer empty', () => {
    const ctx = new ParseContext(Buffer.from(''));
    const i: Partial<R<number>> = {};
    const res = integer(ctx, i);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('integer fail', () => {
    const ctx = new ParseContext(Buffer.from('y4'));
    const i: Partial<R<number>> = {};
    const res = integer(ctx, i);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('float (no dot)', () => {
    const ctx = new ParseContext(Buffer.from('42g'));
    const f: Partial<R<number>> = {};
    const res = float(ctx, f);
    expect(res).to.be.true;
    expect(f.value).to.equal(42);
    expect(ctx.offset).to.equal(2);
  });

  it('float', () => {
    const ctx = new ParseContext(Buffer.from('3.14'));
    const f: Partial<R<number>> = {};
    const res = float(ctx, f);
    expect(res).to.be.true;
    expect(f.value).to.equal(3.14);
    expect(ctx.offset).to.equal(4);
  });

  it('float fail', () => {
    const ctx = new ParseContext(Buffer.from('1..2'));
    const f: Partial<R<number>> = {};
    const res = float(ctx, f);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('number (float)', () => {
    const ctx = new ParseContext(Buffer.from('3.14'));
    const n: Partial<R<number>> = {};
    const res = number(ctx, n);
    expect(res).to.be.true;
    expect(n.value).to.equal(3.14);
    expect(ctx.offset).to.equal(4);
  });

  it('number (int)', () => {
    const ctx = new ParseContext(Buffer.from('42'));
    const n: Partial<R<number>> = {};
    const res = number(ctx, n);
    expect(res).to.be.true;
    expect(n.value).to.equal(42);
    expect(ctx.offset).to.equal(2);
  });

  it('string', () => {
    const ctx = new ParseContext(Buffer.from('potato '));
    const s: Partial<R<string>> = {};
    const res = string(ctx, code(' '), s);
    expect(res).to.be.true;
    expect(s.value).to.equal('potato');
    expect(ctx.offset).to.equal(6);
  });

  it('boolean (true)', () => {
    const ctx = new ParseContext(Buffer.from('truel'));
    const b: Partial<R<boolean>> = {};
    const res = boolean(ctx, b);
    expect(res).to.be.true;
    expect(b.value).to.be.true;
    expect(ctx.offset).to.equal(4);
  });

  it('boolean (false)', () => {
    const ctx = new ParseContext(Buffer.from('false!'));
    const b: Partial<R<boolean>> = {};
    const res = boolean(ctx, b);
    expect(res).to.be.true;
    expect(b.value).to.be.false;
    expect(ctx.offset).to.equal(5);
  });

  it('boolean fail', () => {
    const ctx = new ParseContext(Buffer.from('bfalse!'));
    const b: Partial<R<boolean>> = {};
    const res = boolean(ctx, b);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });

  it('scalar (boolean)', () => {
    const ctx = new ParseContext(Buffer.from('false!'));
    const s: Partial<R<Scalar>> = {};
    const res = scalar(ctx, code('\n'), s);
    expect(res).to.be.true;
    expect(s.value).to.be.false;
    expect(ctx.offset).to.equal(5);
  });

  it('scalar (number)', () => {
    const ctx = new ParseContext(Buffer.from('42'));
    const s: Partial<R<Scalar>> = {};
    const res = scalar(ctx, code('\n'), s);
    expect(res).to.be.true;
    expect(s.value).to.equal(42);
    expect(ctx.offset).to.equal(2);
  });

  it('scalar (string)', () => {
    const ctx = new ParseContext(Buffer.from('hello world'));
    const s: Partial<R<Scalar>> = {};
    const res = scalar(ctx, code('\n'), s);
    expect(res).to.be.true;
    expect(s.value).to.equal('hello world');
    expect(ctx.offset).to.equal(11);
  });

  it('scalar (empty)', () => {
    const ctx = new ParseContext(Buffer.from(''));
    const s: Partial<R<Scalar>> = {};
    const res = scalar(ctx, code('\n'), s);
    expect(res).to.be.false;
    expect(ctx.offset).to.equal(0);
  });
});
