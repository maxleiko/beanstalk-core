import { yamlList } from './yaml-parser';
import { ParseContext, R } from './internal_types';
import { Msg, Inserted, Using, Reserved, Ok, Watching } from './types';

/**
 * Success codes
 */
// prettier-ignore
export enum S {
  DELETED  = 'DELETED',
  INSERTED = 'INSERTED',
  RELEASED = 'RELEASED',
  RESERVED = 'RESERVED',
  USING    = 'USING',
  OK       = 'OK',
  WATCHING = 'WATCHING',
}

/**
 * Error codes
 */
// prettier-ignore
export enum E {
  BURIED        = 'BURIED',
  DRAINING      = 'DRAINING',
  EXPECTED_CRLF = 'EXPECTED_CRLF',
  JOB_TOO_BIG   = 'JOB_TOO_BIG',
  NOT_FOUND     = 'NOT_FOUND',
  DEADLINE_SOON = 'DEADLINE_SOON',
  TIMED_OUT     = 'TIMED_OUT',
  NOT_IGNORED   = 'NOT_IGNORED',
}

export function parse(buf: Buffer): Msg[] {
  const results: Msg[] = [];
  const ctx: ParseContext = { buf, offset: 0 };
  const res: Partial<R> = {};

  while (ctx.offset < ctx.buf.length) {
    if (inserted(ctx, res)) {
      results.push({ code: S.INSERTED, value: res.value } as Inserted); // casting to guard from future changes
    } else if (using(ctx, res)) {
      results.push({ code: S.USING, value: res.value } as Using); // casting to guard from future changes
    } else if (reserved(ctx, res)) {
      results.push({ code: S.RESERVED, value: res.value } as Reserved); // casting to guard from future changes
    } else if (ok(ctx, res)) {
      results.push({ code: S.OK, value: res.value } as Ok); // casting to guard from future changes
    } else if (watching(ctx, res)) {
      results.push({ code: S.WATCHING, value: res.value } as Watching); // casting to guard from future changes
    } else if (token(ctx, S.RELEASED, true)) {
      results.push({ code: S.RELEASED });
    } else if (token(ctx, E.BURIED, true)) {
      results.push({ code: E.BURIED });
    } else if (token(ctx, E.DRAINING, true)) {
      results.push({ code: E.DRAINING });
    } else if (token(ctx, E.EXPECTED_CRLF, true)) {
      results.push({ code: E.EXPECTED_CRLF });
    } else if (token(ctx, E.JOB_TOO_BIG, true)) {
      results.push({ code: E.JOB_TOO_BIG });
    } else if (token(ctx, S.DELETED, true)) {
      results.push({ code: S.DELETED });
    } else if (token(ctx, E.NOT_FOUND, true)) {
      results.push({ code: E.NOT_FOUND });
    } else if (token(ctx, E.DEADLINE_SOON, true)) {
      results.push({ code: E.DEADLINE_SOON });
    } else if (token(ctx, E.TIMED_OUT, true)) {
      results.push({ code: E.TIMED_OUT });
    } else if (token(ctx, E.NOT_IGNORED, true)) {
      results.push({ code: E.NOT_IGNORED });
    }
  }

  return results;
}

function ok(ctx: ParseContext, res: Partial<R<string[]>>): res is R<string[]> {
  if (token(ctx, S.OK)) {
    if (space(ctx)) {
      const len: Partial<R<number>> = {};
      if (integer(ctx, len)) {
        // <bytes>
        if (crlf(ctx)) {
          res.value = yamlList(
            ctx.buf.slice(ctx.offset, ctx.offset + len.value)
          );
          ctx.offset += len.value; // skip bytes len
          if (crlf(ctx)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

function inserted(
  ctx: ParseContext,
  res: Partial<R<number>>
): res is R<number> {
  if (token(ctx, S.INSERTED)) {
    if (space(ctx)) {
      if (integer(ctx, res)) {
        if (crlf(ctx)) {
          return true;
        }
      }
    }
  }
  return false;
}

function using(ctx: ParseContext, res: Partial<R<string>>): res is R<string> {
  if (token(ctx, S.USING)) {
    if (space(ctx)) {
      if (string(ctx, res)) {
        if (crlf(ctx)) {
          return true;
        }
      }
    }
  }
  return false;
}

function watching(
  ctx: ParseContext,
  res: Partial<R<number>>
): res is R<number> {
  if (token(ctx, S.WATCHING)) {
    if (space(ctx)) {
      if (integer(ctx, res)) {
        if (crlf(ctx)) {
          return true;
        }
      }
    }
  }
  return false;
}

function reserved(
  ctx: ParseContext,
  res: Partial<R<[number, Buffer]>>
): res is R<[number, Buffer]> {
  if (token(ctx, S.RESERVED)) {
    if (space(ctx)) {
      const id: Partial<R<number>> = {};
      if (integer(ctx, id)) {
        // <id>
        if (space(ctx)) {
          const len: Partial<R<number>> = {};
          if (integer(ctx, len)) {
            // <bytes>
            if (crlf(ctx)) {
              res.value = [
                id.value,
                ctx.buf.slice(ctx.offset, ctx.offset + len.value),
              ];
              ctx.offset += len.value; // skip bytes
              if (crlf(ctx)) {
                return true;
              }
            }
          }
        }
      }
    }
  }
  return false;
}

function token(ctx: ParseContext, token: string, withCrlf = false): boolean {
  if (ctx.buf.toString().startsWith(token, ctx.offset)) {
    ctx.offset += token.length;
    if (withCrlf) {
      if (crlf(ctx)) {
        return true;
      }
    } else {
      return true;
    }
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

function crlf(ctx: ParseContext): boolean {
  if (ctx.buf[ctx.offset] === 13 && ctx.buf[ctx.offset + 1] === 10) {
    // '\r' && '\n'
    ctx.offset += 2;
    return true;
  }
  return false;
}

function space(ctx: ParseContext): boolean {
  if (ctx.buf[ctx.offset] === 32) {
    // ' '
    ctx.offset++;
    return true;
  }
  return false;
}
