export interface IOptions {
  dummy: string;
}

export async function app(opts: IOptions): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(`Hello ${opts.dummy}`), 50);
  });
}