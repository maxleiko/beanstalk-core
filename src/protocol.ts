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
 */
export function parse(ctx: ParseContext, msgs: Msg[]): void {
  const res: Partial<R> = {};

  if (inserted(ctx, res)) {
    msgs.push({ code: M.INSERTED, value: res.value } as Inserted); // casting to guard from future changes
    ctx.update();
  } else if (buried(ctx, res)) {
    msgs.push({ code: M.BURIED, value: res.value } as Buried); // casting to guard from future changes
    ctx.update();
  } else if (using(ctx, res)) {
    msgs.push({ code: M.USING, value: res.value } as Using); // casting to guard from future changes
    ctx.update();
  } else if (reserved(ctx, res)) {
    msgs.push({ code: M.RESERVED, value: res.value } as Reserved); // casting to guard from future changes
    ctx.update();
  } else if (ok(ctx, res)) {
    msgs.push({ code: M.OK, value: res.value } as Ok); // casting to guard from future changes
    ctx.update();
  } else if (watching(ctx, res)) {
    msgs.push({ code: M.WATCHING, value: res.value } as Watching); // casting to guard from future changes
    ctx.update();
  } else if (found(ctx, res)) {
    msgs.push({ code: M.FOUND, value: res.value } as Found); // casting to guard from future changes
    ctx.update();
  } else if (kicked(ctx, res)) {
    msgs.push({ code: M.KICKED, value: res.value } as Kicked); // casting to guard from future changes
    ctx.update();
  } else if (token(ctx, M.RELEASED, true)) {
    msgs.push({ code: M.RELEASED });
    ctx.update();
  } else if (token(ctx, M.DRAINING, true)) {
    msgs.push({ code: M.DRAINING });
    ctx.update();
  } else if (token(ctx, M.EXPECTED_CRLF, true)) {
    msgs.push({ code: M.EXPECTED_CRLF });
    ctx.update();
  } else if (token(ctx, M.JOB_TOO_BIG, true)) {
    msgs.push({ code: M.JOB_TOO_BIG });
    ctx.update();
  } else if (token(ctx, M.DELETED, true)) {
    msgs.push({ code: M.DELETED });
    ctx.update();
  } else if (token(ctx, M.NOT_FOUND, true)) {
    msgs.push({ code: M.NOT_FOUND });
    ctx.update();
  } else if (token(ctx, M.DEADLINE_SOON, true)) {
    msgs.push({ code: M.DEADLINE_SOON });
    ctx.update();
  } else if (token(ctx, M.TIMED_OUT, true)) {
    msgs.push({ code: M.TIMED_OUT });
    ctx.update();
  } else if (token(ctx, M.NOT_IGNORED, true)) {
    msgs.push({ code: M.NOT_IGNORED });
    ctx.update();
  } else if (token(ctx, M.BAD_FORMAT, true)) {
    msgs.push({ code: M.BAD_FORMAT });
    ctx.update();
  } else if (token(ctx, M.UNKNOWN_COMMAND, true)) {
    msgs.push({ code: M.UNKNOWN_COMMAND });
    ctx.update();
  } else if (token(ctx, M.OUT_OF_MEMORY, true)) {
    msgs.push({ code: M.OUT_OF_MEMORY });
    ctx.update();
  } else if (token(ctx, M.INTERNAL_ERROR, true)) {
    msgs.push({ code: M.INTERNAL_ERROR });
    ctx.update();
  } else if (token(ctx, M.PAUSED, true)) {
    msgs.push({ code: M.PAUSED });
    ctx.update();
  } else if (token(ctx, M.TOUCHED, true)) {
    msgs.push({ code: M.TOUCHED });
    ctx.update();
  }

  ctx.offset = 0;
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
              if (ctx.buf.length - ctx.offset >= len.value) {
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
          if (ctx.buf.length - ctx.offset >= len.value) {
            res.value = ctx.buf.slice(ctx.offset, ctx.offset + len.value);
            ctx.offset += len.value; // skip bytes len
            if (crlf(ctx)) {
              return true;
            }
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
    } else if (crlf(ctx)) {
      return true;
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
      // <id>
      if (integer(ctx, id)) {
        if (space(ctx)) {
          const len: Partial<R<number>> = {};
          // <bytes>
          if (integer(ctx, len)) {
            if (crlf(ctx)) {
              if (ctx.buf.length - ctx.offset >= len.value) {
                res.value = [id.value, ctx.buf.slice(ctx.offset, ctx.offset + len.value)];
                ctx.offset += len.value; // skip bytes
                if (crlf(ctx)) {
                  return true;
                } else {
                  let data;
                  if (id.value) {
                    data = { id: id.value };
                  }
                  ctx.clear();
                  throw new BeanstalkClientError(`Malformed ${M.RESERVED} response message`, data);
                }
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
