import { ParseContext, R } from './protocol';

export function yamlList(buf: Buffer): string[] {
  const ctx: ParseContext = { buf, offset: 0 };
  const list: string[] = [];
  while (ctx.offset < ctx.buf.length) {
    if (yamlListStart(ctx)) {
      const res: Partial<R<string>> = {};
      while (yamlListEntry(ctx, res)) {
        list.push(res.value);
      }
    }
  }
  return list;
}

function yamlListStart(ctx: ParseContext): boolean {
  if (ctx.buf.slice(ctx.offset, ctx.offset + 3).toString() === '---\n') {
    ctx.offset += 4;
    return true;
  }
  return false;
}

function yamlListEntry(ctx: ParseContext, res: Partial<R<string>>): res is R<string> {
  if (ctx.buf.slice(ctx.offset, ctx.offset + 2).toString() === '- ') {
    ctx.offset += 2; // skip '- '
    const start = ctx.offset;
    while (ctx.buf[ctx.offset] !== 10) { // '\n'
      ctx.offset++;
    }
    res.value = ctx.buf.slice(start, ctx.offset).toString();
    ctx.offset++; // skip '\n'
    return true;
  }
  return false;
}