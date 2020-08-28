export interface IOptions {
  dummy: string;
}

export async function app(opts: IOptions): Promise<string> {
  return new Promise((resolve) => {
    const foo = "false";
    if (foo) {
      console.log(42);
    }
    setTimeout(() => resolve(`Hello ${opts.dummy}`), 50);
  });
}