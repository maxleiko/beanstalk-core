import { ParseContext, R } from './internal_types';
import { Msg, Inserted, Using, Reserved, Ok, Watching, Found, Kicked, Buried } from './types';
import { space, integer, crlf, string } from './parse-utils';
import { BeanstalkClientError } from './error';

/**
 * Messages
 */
// prettier-ignore
export enum M {
  DELETED         = 'DELETED',
  INSERTED        = 'INSERTED',
  BURIED          = 'BURIED',
  RELEASED        = 'RELEASED',
  RESERVED        = 'RESERVED',
  USING           = 'USING',
  OK              = 'OK',
  WATCHING        = 'WATCHING',
  FOUND           = 'FOUND',
  KICKED          = 'KICKED',
  PAUSED          = 'PAUSED',
  TOUCHED         = 'TOUCHED',
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

/**
 * @param buf a buffer containing Beanstalkd response messages
 * @param msgs fills this array with the parsed messages
 * @returns the number of bytes read
 */
export function parse(buf: Buffer): Msg {
  if (buf.length === 0) {
    throw new BeanstalkClientError('Empty buffer');
  }

  const ctx: ParseContext = { buf, offset: 0 };
  const res: Partial<R> = {};

    if (inserted(ctx, res)) {
      return { code: M.INSERTED, value: res.value } as Inserted; // casting to guard from future changes
    } else if (buried(ctx, res)) {
      return { code: M.BURIED, value: res.value } as Buried; // casting to guard from future changes
    } else if (using(ctx, res)) {
      return { code: M.USING, value: res.value } as Using; // casting to guard from future changes
    } else if (reserved(ctx, res)) {
      return { code: M.RESERVED, value: res.value } as Reserved; // casting to guard from future changes
    } else if (ok(ctx, res)) {
      return { code: M.OK, value: res.value } as Ok; // casting to guard from future changes
    } else if (watching(ctx, res)) {
      return { code: M.WATCHING, value: res.value } as Watching; // casting to guard from future changes
    } else if (found(ctx, res)) {
      return { code: M.FOUND, value: res.value } as Found; // casting to guard from future changes
    } else if (kicked(ctx, res)) {
      return { code: M.KICKED, value: res.value } as Kicked; // casting to guard from future changes
    } else if (token(ctx, M.RELEASED, true)) {
      return { code: M.RELEASED };
    } else if (token(ctx, M.DRAINING, true)) {
      return { code: M.DRAINING };
    } else if (token(ctx, M.EXPECTED_CRLF, true)) {
      return { code: M.EXPECTED_CRLF };
    } else if (token(ctx, M.JOB_TOO_BIG, true)) {
      return { code: M.JOB_TOO_BIG };
    } else if (token(ctx, M.DELETED, true)) {
      return { code: M.DELETED };
    } else if (token(ctx, M.NOT_FOUND, true)) {
      return { code: M.NOT_FOUND };
    } else if (token(ctx, M.DEADLINE_SOON, true)) {
      return { code: M.DEADLINE_SOON };
    } else if (token(ctx, M.TIMED_OUT, true)) {
      return { code: M.TIMED_OUT };
    } else if (token(ctx, M.NOT_IGNORED, true)) {
      return { code: M.NOT_IGNORED };
    } else if (token(ctx, M.BAD_FORMAT, true)) {
      return { code: M.BAD_FORMAT };
    } else if (token(ctx, M.UNKNOWN_COMMAND, true)) {
      return { code: M.UNKNOWN_COMMAND };
    } else if (token(ctx, M.OUT_OF_MEMORY, true)) {
      return { code: M.OUT_OF_MEMORY };
    } else if (token(ctx, M.INTERNAL_ERROR, true)) {
      return { code: M.INTERNAL_ERROR };
    } else if (token(ctx, M.PAUSED, true)) {
      return { code: M.PAUSED };
    } else if (token(ctx, M.TOUCHED, true)) {
      return { code: M.TOUCHED };
    }

  throw new BeanstalkClientError('Invalid beanstalkd response');
}

function found(ctx: ParseContext, res: Partial<R<[number, Buffer]>>): res is R<[number, Buffer]> {
  const start = ctx.offset;
  if (token(ctx, M.FOUND)) {
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
  if (token(ctx, M.KICKED)) {
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
  if (token(ctx, M.OK)) {
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
  if (token(ctx, M.INSERTED)) {
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

function buried(ctx: ParseContext, res: Partial<R<number | undefined>>): res is R<number | undefined> {
  const start = ctx.offset;
  if (token(ctx, M.BURIED)) {
    if (space(ctx)) {
      if (integer(ctx, res)) {
        if (crlf(ctx)) {
          return true;
        }
      }
    } else {
      if (crlf(ctx)) {
        return true;
      }
    }
  }
  ctx.offset = start;
  return false;
}

function using(ctx: ParseContext, res: Partial<R<string>>): res is R<string> {
  const start = ctx.offset;
  if (token(ctx, M.USING)) {
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
  if (token(ctx, M.WATCHING)) {
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
  const id: Partial<R<number>> = {};
  if (token(ctx, M.RESERVED)) {
    if (space(ctx)) {
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
    if (id.value) {
      throw new BeanstalkClientError('Malformed RESERVED message', { id: id.value });
    }
    throw new BeanstalkClientError('Malformed RESERVED message');
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
