## @beanstalk/core

![build](https://img.shields.io/github/workflow/status/maxleiko/beanstalk-core/build) | ![npm](https://img.shields.io/npm/v/@beanstalk/core)

[Documentation](https://maxleiko.github.io/beanstalk-core/)

A 0 dependency, full-featured, battle-tested beanstalk client library.  

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