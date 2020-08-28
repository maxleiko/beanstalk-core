## bsc

A template to bootstrap a Node.js CJS app written in TypeScript with ESLint & Jest all wired-up

### Usage
```sh
git clone git@github.com:maxleiko/bsc.git
cd bsc
git remote set-url origin <YOUR_REPO_URL>
yarn
```

### Available scripts:
 - `clean`: clean the generated bundle
 - `lint`: lints the `src` folder using `ESLint`
 - `test`: runs the test directly from TypeScript sources using `mocha`
 - `build`: bundles the whole app into `dist/index.js` using `@vercel/ncc`
 - `package`: creates a standalone binary using `nexe`
 - `start`: builds & runs your CLI app
 - `docker`: builds a `Docker` image targetting `alpine`
