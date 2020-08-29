import { ParseContext, R } from './internal_types';
import { string, colon, lf, scalar } from './parse-utils';

export function yamlList(buf: Buffer): string[] {
  const ctx: ParseContext = { buf, offset: 0 };
  const list: string[] = [];
  while (ctx.offset < ctx.buf.length) {
    if (yamlStart(ctx)) {
      const res: Partial<R<string>> = {};
      while (yamlListEntry(ctx, res)) {
        list.push(res.value);
      }
    }
  }
  return list;
}

export function yamlMap(buf: Buffer): Record<string, string | number | boolean> {
  const map: Record<string, string | number | boolean> = {};
  const ctx: ParseContext = { buf, offset: 0 };
  while (ctx.offset < ctx.buf.length) {
    if (yamlStart(ctx)) {
      const res: Partial<R<[string, string | number | boolean]>> = {};
      while (yamlMapEntry(ctx, res)) {
        map[res.value[0]] = res.value[1];
      }
    }
  }
  return map;
}

function yamlStart(ctx: ParseContext): boolean {
  if (ctx.buf.slice(ctx.offset, ctx.offset + 4).toString() === '---\n') {
    ctx.offset += 4;
    return true;
  }
  return false;
}

function yamlListEntry(
  ctx: ParseContext,
  res: Partial<R<string>>
): res is R<string> {
  if (ctx.buf.slice(ctx.offset, ctx.offset + 2).toString() === '- ') {
    ctx.offset += 2; // skip '- '
    const start = ctx.offset;
    while (ctx.offset < ctx.buf.length && ctx.buf[ctx.offset] !== 10) {
      // '\n'
      ctx.offset++;
    }
    res.value = ctx.buf.slice(start, ctx.offset).toString();
    ctx.offset++; // skip '\n'
    return true;
  }
  return false;
}

function yamlMapEntry(
  ctx: ParseContext,
  res: Partial<R<[string, string | number | boolean]>>
): res is R<[string, string | number | boolean]> {
  const key: Partial<R<string>> = {};
  if (string(ctx, 58, key)) { // 58: ':'
    if (colon(ctx)) {
      const value: Partial<R<string | number | boolean>> = {};
      if (scalar(ctx, 10, value)) {
        if (lf(ctx)) {
          res.value = [key.value, value.value];
          return true;
        }
      }
    }
  }
  return false;
}