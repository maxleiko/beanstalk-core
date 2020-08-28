import { yamlList } from './yaml-parser';

/**
 * Success codes
 */
export enum S {
  DELETED  = 'DELETED',
  INSERTED = 'INSERTED',
  RELEASED = 'RELEASED',
  RESERVED = 'RESERVED',
  USING    = 'USING',
  OK       = 'OK',
}

/**
 * Error codes
 */
export enum E {
  BURIED        = 'BURIED',
  DRAINING      = 'DRAINING',
  EXPECTED_CRLF = 'EXPECTED_CRLF',
  JOB_TOO_BIG   = 'JOB_TOO_BIG',
  NOT_FOUND     = 'NOT_FOUND',
}

export type ParseContext = { buf: Buffer; offset: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type R<T = any> = { value: T };

export type Msg =
  | AnyError
  | Ok
  | Inserted
  | Deleted
  | Using
  | Reserved
  | Released
  | NotFound
  | Buried
  | ExpectedCrlf
  | JobTooBig
  | Draining;

export type AnyError     = { code: E; };
export type Deleted      = { code: S.DELETED; };
export type Inserted     = { code: S.INSERTED; value: number; };
export type Using        = { code: S.USING; value: string; };
export type Ok           = { code: S.OK; value: string[]; };
export type Reserved     = { code: S.RESERVED; value: { id: number; payload: Buffer; }; };
export type Released     = { code: S.RELEASED; };
export type NotFound     = { code: E.NOT_FOUND; };
export type Buried       = { code: E.BURIED; };
export type ExpectedCrlf = { code: E.EXPECTED_CRLF; };
export type JobTooBig    = { code: E.JOB_TOO_BIG; };
export type Draining     = { code: E.DRAINING; };

export function parse(buf: Buffer): Msg[] {
  const ctx: ParseContext = { buf, offset: 0 };
  const results: Msg[] = [];
  while (ctx.offset < ctx.buf.length) {
    const res: Partial<R> = {};
    if (inserted(ctx, res)) {
      results.push({ code: S.INSERTED, value: res.value } as Inserted);
    } else if (using(ctx, res)) {
      results.push({ code: S.USING, value: res.value } as Using);
    } else if (reserved(ctx, res)) {
      results.push({ code: S.RESERVED, value: res.value } as Reserved);
    } else if (ok(ctx, res)) {
      results.push({ code: S.OK, value: res.value } as Ok);

    } else if (token(ctx, S.RELEASED)) {
      results.push({ code: S.RELEASED });
    } else if (token(ctx, E.BURIED)) {
      results.push({ code: E.BURIED });
    } else if (token(ctx, E.DRAINING)) {
      results.push({ code: E.DRAINING });
    } else if (token(ctx, E.EXPECTED_CRLF)) {
      results.push({ code: E.EXPECTED_CRLF });
    } else if (token(ctx, E.JOB_TOO_BIG)) {
      results.push({ code: E.JOB_TOO_BIG });
    } else if (token(ctx, S.DELETED)) {
      results.push({ code: S.DELETED });
    }
  }
  return results;
}

function ok(ctx: ParseContext, res: Partial<R<string[]>>): res is R<string[]> {
  if (token(ctx, S.OK)) {
    ctx.offset++; // space
    const len: Partial<R<number>> = {};
    if (integer(ctx, len)) { // <bytes>
      ctx.offset += 2; // CRLF
      res.value = yamlList(ctx.buf.slice(ctx.offset, ctx.offset + len.value));
      ctx.offset += len.value + 2; // skip (bytes len + CRLF)
      return true;
    }
  }
  return false;
}

function inserted(
  ctx: ParseContext,
  res: Partial<R<number>>
): res is R<number> {
  if (token(ctx, S.INSERTED)) {
    ctx.offset++; // space
    if (integer(ctx, res)) {
      ctx.offset += 2; // CRLF
      return true;
    }
  }
  return false;
}

function using(ctx: ParseContext, res: Partial<R<string>>): res is R<string> {
  if (token(ctx, S.USING)) {
    ctx.offset++; // space
    if (string(ctx, res)) {
      ctx.offset += 2; // CRLF
      return true;
    }
  }
  return false;
}

function reserved(
  ctx: ParseContext,
  res: Partial<R<{ id: number; payload: Buffer }>>
): res is R<{ id: number; payload: Buffer }> {
  if (token(ctx, S.RESERVED)) {
    ctx.offset++; // space
    const id: Partial<R<number>> = {};
    if (integer(ctx, id)) {
      // <id>
      ctx.offset++; // space
      const len: Partial<R<number>> = {};
      if (integer(ctx, len)) { // <bytes>
        ctx.offset += 2; // CRLF
        res.value = {
          id: id.value,
          payload: ctx.buf.slice(ctx.offset, ctx.offset + len.value),
        };
        ctx.offset += len.value + 2; // skip (bytes len + CRLF)
        return true;
      }
    }
  }
  return false;
}

function token(ctx: ParseContext, token: string): boolean {
  if (ctx.buf.toString().startsWith(token, ctx.offset)) {
    ctx.offset += token.length;
    return true;
  }
  return false;
}

function integer(ctx: ParseContext, res: Partial<R<number>>): res is R<number> {
  const startOffset = ctx.offset;
  while (
    ctx.offset < ctx.buf.length &&
    ctx.buf[ctx.offset] >= 48 &&
    ctx.buf[ctx.offset] <= 57
  ) {
    // 0-9
    ctx.offset++;
  }
  res.value = parseInt(ctx.buf.slice(startOffset, ctx.offset).toString(), 10);
  return true;
}

function string(ctx: ParseContext, res: Partial<R<string>>): res is R<string> {
  const startOffset = ctx.offset;
  while (ctx.offset < ctx.buf.length && ctx.buf[ctx.offset] !== 13) {
    // '\r'
    ctx.offset++;
  }
  res.value = ctx.buf.slice(startOffset, ctx.offset).toString();
  return true;
}
