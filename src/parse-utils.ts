import { ParseContext, R } from './internal_types';
import { Scalar } from './types';

export function integer(ctx: ParseContext, res: Partial<R<number>>): res is R<number> {
  const startOffset = ctx.offset;
  while (ctx.offset < ctx.buf.length && ctx.buf[ctx.offset] >= 48 && ctx.buf[ctx.offset] <= 57) {
    // 0-9
    ctx.offset++;
  }
  if (ctx.offset === startOffset) {
    return false;
  }
  res.value = parseInt(ctx.buf.slice(startOffset, ctx.offset).toString(), 10);
  return true;
}

export function dot(ctx: ParseContext): boolean {
  if (char(ctx, 46)) {
    return true;
  }
  return false;
}

export function float(ctx: ParseContext, res: Partial<R<number>>): res is R<number> {
  const start = ctx.offset;
  const head: Partial<R<number>> = {};
  if (integer(ctx, head)) {
    if (dot(ctx)) {
      const tail: Partial<R<number>> = {};
      if (integer(ctx, tail)) {
        res.value = parseFloat(`${head.value}.${tail.value}`);
        return true;
      }
    } else {
      res.value = head.value;
      return true;
    }
  }
  ctx.offset = start;
  return false;
}

export function number(ctx: ParseContext, res: Partial<R<number>>): res is R<number> {
  if (float(ctx, res)) {
    return true;
  }
  return false;
}

export function string(ctx: ParseContext, endCode: number, res: Partial<R<string>>): res is R<string> {
  if (ctx.offset === ctx.buf.length) {
    return false;
  }
  const startOffset = ctx.offset;
  while (ctx.offset < ctx.buf.length && ctx.buf[ctx.offset] !== endCode) {
    ctx.offset++;
  }
  res.value = ctx.buf.slice(startOffset, ctx.offset).toString();
  return true;
}

export function char(ctx: ParseContext, code: number): boolean {
  if (ctx.buf[ctx.offset] === code) {
    ctx.offset++;
    return true;
  }
  return false;
}

export function crlf(ctx: ParseContext): boolean {
  const start = ctx.offset;
  if (char(ctx, 13)) {
    if (char(ctx, 10)) {
      return true;
    }
  }
  ctx.offset = start;
  return false;
}

export function lf(ctx: ParseContext): boolean {
  if (char(ctx, 10)) {
    return true;
  }
  return false;
}

export function space(ctx: ParseContext): boolean {
  if (char(ctx, 32)) {
    return true;
  }
  return false;
}

export function colon(ctx: ParseContext): boolean {
  if (char(ctx, 58)) {
    return true;
  }
  return false;
}

export function boolean(ctx: ParseContext, res: Partial<R<boolean>>): res is R<boolean> {
  const start = ctx.offset;
  // 116, 114, 117, 101 = true
  if (char(ctx, 116)) {
    if (char(ctx, 114)) {
      if (char(ctx, 117)) {
        if (char(ctx, 101)) {
          res.value = true;
          return true;
        }
      }
    }
  }
  ctx.offset = start;
  // 102, 97, 108, 115, 101 = false
  if (char(ctx, 102)) {
    if (char(ctx, 97)) {
      if (char(ctx, 108)) {
        if (char(ctx, 115)) {
          if (char(ctx, 101)) {
            res.value = false;
            return true;
          }
        }
      }
    }
  }
  ctx.offset = start;
  return false;
}

export function scalar(ctx: ParseContext, endCode: number, res: Partial<R<Scalar>>): res is R<Scalar> {
  const start = ctx.offset;
  const b: Partial<R<boolean>> = {};
  if (boolean(ctx, b)) {
    res.value = b.value;
    return true;
  }
  const i: Partial<R<number>> = {};
  if (number(ctx, i)) {
    res.value = i.value;
    return true;
  }
  const s: Partial<R<string>> = {};
  if (string(ctx, endCode, s)) {
    res.value = s.value;
    return true;
  }
  ctx.offset = start;
  return false;
}
