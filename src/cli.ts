#!/usr/bin/env node
import arg from 'arg';
import dotenv from 'dotenv';
import { app, IOptions } from './lib';

function parseArgs(): [string[], IOptions] {
  dotenv.config();

  // prettier-ignore
  const args = arg({
    '--help' : Boolean,
    '--dummy': String,  '-d': '--dummy',
  }, {
    permissive: false, // no unknown args
    argv: process.argv.slice(2),
  });

  // prettier-ignore
  if (args['--help'] || !args._[0]) {
    console.log();
    console.log('   USAGE:');
    console.log('     tpl-node-app');
    console.log();
    console.log('   OPTIONS:');
    console.log('     --help:                Shows this help message');
    console.log(`     -d, --dummy:           Dummy option (default: 'World')`);
    console.log();
    process.exit(0);
  }

  const dummy = args['--dummy'] || process.env.DUMMY || 'World';

  return [
    args._,
    {
      dummy,
    },
  ];
}

async function main() {
  const [args, options] = parseArgs();
  console.log(args);
  await app(options);
}

main().catch((err) => {
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});
