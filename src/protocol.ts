import { ParseContext, R } from './internal_types';
import { Msg, Inserted, Using, Reserved, Ok, Watching, Found, Kicked } from './types';
import { space, integer, crlf, string } from './parse-utils';

export class BeanstalkParseError extends Error {
  constructor(msg: string, readonly buf: Buffer) {
    super(msg);
  }
}

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
  FOUND    = 'FOUND',
  KICKED   = 'KICKED',
  PAUSED   = 'PAUSED',
  TOUCHED  = 'TOUCHED',
}

/**
 * Error codes
 */
// prettier-ignore
export enum E {
  BURIED          = 'BURIED',
  DRAINING        = 'DRAINING',
  EXPECTED_CRLF   = 'EXPECTED_CRLF',
  JOB_TOO_BIG     = 'JOB_TOO_BIG',
  NOT_FOUND       = 'NOT_FOUND',
  DEADLINE_SOON   = 'DEADLINE_SOON',
  TIMED_OUT       = 'TIMED_OUT',
  NOT_IGNORED     = 'NOT_IGNORED',
  BAD_FORMAT      = 'BAD_FORMAT',
  OUT_OF_MEMORY   = 'OUT_OF_MEMORY',
  INTERNAL_ERROR  = 'INTERNAL_ERROR',
  UNKNOWN_COMMAND = 'UNKNOWN_COMMAND',
}

export function parse(buf: Buffer): Msg[] {
  if (buf.length === 0) {
    throw new BeanstalkParseError('Empty message', buf);
  }

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
    } else if (found(ctx, res)) {
      results.push({ code: S.FOUND, value: res.value } as Found); // casting to guard from future changes
    } else if (kicked(ctx, res)) {
      results.push({ code: S.KICKED, value: res.value } as Kicked); // casting to guard from future changes
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
    } else if (token(ctx, E.BAD_FORMAT, true)) {
      results.push({ code: E.BAD_FORMAT });
    } else if (token(ctx, E.UNKNOWN_COMMAND, true)) {
      results.push({ code: E.UNKNOWN_COMMAND });
    } else if (token(ctx, E.OUT_OF_MEMORY, true)) {
      results.push({ code: E.OUT_OF_MEMORY });
    } else if (token(ctx, E.INTERNAL_ERROR, true)) {
      results.push({ code: E.INTERNAL_ERROR });
    } else if (token(ctx, S.PAUSED, true)) {
      results.push({ code: S.PAUSED });
    } else if (token(ctx, S.TOUCHED, true)) {
      results.push({ code: S.TOUCHED });
    } else {
      throw new BeanstalkParseError('Unable to parse beanstalk message', buf);
    }
  }

  return results;
}

function found(ctx: ParseContext, res: Partial<R<[number, Buffer]>>): res is R<[number, Buffer]> {
  const start = ctx.offset;
  if (token(ctx, S.FOUND)) {
    if (space(ctx)) {
      const id: Partial<R<number>> = {};
      if (integer(ctx, id)) {
        if (space(ctx)) {
          const len: Partial<R<number>> = {};
          if (integer(ctx, len)) {
            if (crlf(ctx)) {
              res.value = [id.value, ctx.buf.slice(ctx.offset, ctx.offset + len.value)];
              ctx.offset += len.value; // skip bytes len
              if (crlf(ctx)) {
                return true;
              }
            }
          }
        }
      }
    }
  }
  ctx.offset = start;
  return false;
}

function kicked(ctx: ParseContext, res: Partial<R<number | undefined>>): res is R<number | undefined> {
  const start = ctx.offset;
  if (token(ctx, S.KICKED)) {
    if (space(ctx)) {
      if (integer(ctx, res)) {
        if (crlf(ctx)) {
          return true;
        }
      }
    } else if (crlf(ctx)) {
      res.value = undefined;
      return true;
    }
  }
  ctx.offset = start;
  return false;
}

function ok(ctx: ParseContext, res: Partial<R<Buffer>>): res is R<Buffer> {
  const start = ctx.offset;
  if (token(ctx, S.OK)) {
    if (space(ctx)) {
      const len: Partial<R<number>> = {};
      // <bytes>
      if (integer(ctx, len)) {
        if (crlf(ctx)) {
          res.value = ctx.buf.slice(ctx.offset, ctx.offset + len.value);
          ctx.offset += len.value; // skip bytes len
          if (crlf(ctx)) {
            return true;
          }
        }
      }
    }
  }
  ctx.offset = start;
  return false;
}

function inserted(ctx: ParseContext, res: Partial<R<number>>): res is R<number> {
  const start = ctx.offset;
  if (token(ctx, S.INSERTED)) {
    if (space(ctx)) {
      if (integer(ctx, res)) {
        if (crlf(ctx)) {
          return true;
        }
      }
    }
  }
  ctx.offset = start;
  return false;
}

function using(ctx: ParseContext, res: Partial<R<string>>): res is R<string> {
  const start = ctx.offset;
  if (token(ctx, S.USING)) {
    if (space(ctx)) {
      if (string(ctx, 13, res)) {
        // 13: '\r'
        if (crlf(ctx)) {
          return true;
        }
      }
    }
  }
  ctx.offset = start;
  return false;
}

function watching(ctx: ParseContext, res: Partial<R<number>>): res is R<number> {
  const start = ctx.offset;
  if (token(ctx, S.WATCHING)) {
    if (space(ctx)) {
      if (integer(ctx, res)) {
        if (crlf(ctx)) {
          return true;
        }
      }
    }
  }
  ctx.offset = start;
  return false;
}

function reserved(ctx: ParseContext, res: Partial<R<[number, Buffer]>>): res is R<[number, Buffer]> {
  const start = ctx.offset;
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
              res.value = [id.value, ctx.buf.slice(ctx.offset, ctx.offset + len.value)];
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
  ctx.offset = start;
  return false;
}

function token(ctx: ParseContext, token: string, withCrlf = false): boolean {
  const start = ctx.offset;
  let index = 0;
  let valid = true;
  while (index < token.length) {
    if (ctx.buf[ctx.offset + index] !== token.charCodeAt(index)) {
      valid = false;
      break;
    }
    index++;
  }
  if (valid) {
    ctx.offset += token.length;
    if (withCrlf) {
      if (crlf(ctx)) {
        return true;
      } else {
        ctx.offset = start;
        return false;
      }
    }
    return true;
  }
  ctx.offset = start;
  return false;
}
