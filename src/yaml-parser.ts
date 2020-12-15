import { ParseContext, R } from './internal_types';
import { string, colon, lf, scalar, space, char } from './parse-utils';
import { Scalar } from './types';

export class YAMLParseError extends Error {}

export function yamlList(buf: Buffer): string[] {
  const ctx = new ParseContext(buf);
  const list: string[] = [];
  if (yamlStart(ctx)) {
    while (ctx.offset < ctx.buf.length) {
      const res: Partial<R<string>> = {};
      while (yamlListEntry(ctx, res)) {
        list.push(res.value);
      }
    }
  } else {
    throw new YAMLParseError(`Expecting '---', found '${ctx.buf[ctx.offset]}'`);
  }
  return list;
}

export function yamlMap(buf: Buffer): Record<string, Scalar> {
  const map: Record<string, Scalar> = {};
  const ctx = new ParseContext(buf);
  if (yamlStart(ctx)) {
    while (ctx.offset < ctx.buf.length) {
      const res: Partial<R<[string, Scalar]>> = {};
      while (yamlMapEntry(ctx, res)) {
        map[res.value[0]] = res.value[1];
      }
    }
  } else {
    throw new YAMLParseError(`Expecting '---', found '${ctx.buf[ctx.offset]}'`);
  }
  return map;
}

function yamlStart(ctx: ParseContext): boolean {
  const start = ctx.offset;
  if (char(ctx, 45)) {
    if (char(ctx, 45)) {
      if (char(ctx, 45)) {
        if (lf(ctx)) {
          return true;
        }
      }
    }
  }
  ctx.offset = start;
  return false;
}

function yamlListEntry(ctx: ParseContext, res: Partial<R<string>>): res is R<string> {
  const start = ctx.offset;
  // '- '
  if (yamlListEntryStart(ctx)) {
    // '\n'
    if (string(ctx, 10, res)) {
      if (lf(ctx)) {
        return true;
      }
    }
  }
  ctx.offset = start;
  return false;
}

function yamlListEntryStart(ctx: ParseContext): boolean {
  const start = ctx.offset;
  // '-'
  if (char(ctx, 45)) {
    if (space(ctx)) {
      return true;
    }
  }
  ctx.offset = start;
  return false;
}

function yamlMapEntry(ctx: ParseContext, res: Partial<R<[string, Scalar]>>): res is R<[string, Scalar]> {
  const key: Partial<R<string>> = {};
  if (string(ctx, 58, key)) {
    // 58: ':'
    if (colon(ctx)) {
      if (space(ctx)) {
        const value: Partial<R<Scalar>> = {};
        if (scalar(ctx, 10, value)) {
          if (lf(ctx)) {
            res.value = [key.value, value.value];
            return true;
          }
        }
      }
    }
  }
  return false;
}
