## @beanstalk/core

Yet another Beanstalkd library. With 0 dependency.

### Installation
```sh
yarn add @beanstalk/core
```

### Usage
#### PUT
```ts
import { BeanstalkClient } from '@beanstalk/core';

/**
 * Usage: node put.js
 */
async function main() {
  const client = new BeanstalkClient();
  await client.connect(); // defaults to localhost:11300

  const id = await client.put('Hello World');
  console.log(`Job created with '${id}'`);

  await client.quit();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

#### RESERVE
```ts
import { BeanstalkClient } from '@beanstalk/core';

/**
 * Usage: node reserve.js > out
 */
async function main() {
  const client = new BeanstalkClient();
  await client.connect(); // defaults to localhost:11300

  await client.watch('my-tube');
  await client.ignore('default'); // 'default' is watched by default

  // hangs until a job gets ready on 'my-tube'
  const [id, payload] = await client.reserve();
  console.error(`Job ID: ${id}`);
  await new Promise((resolve, reject) => {
    process.stdout.write(payload, (err) => err ? reject(err) : resolve());
  });

  await client.quit();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

### Available scripts:
 - `clean`: clean the generated bundle
 - `lint`: lints the `src` folder using `ESLint`
 - `test`: runs the test directly from TypeScript sources using `mocha`
 - `compile`: compiles the TypeScript `src` into `lib`
 - `build`: executes `test`, `clean` and `compile`
