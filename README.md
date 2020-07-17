## tpl-node-app

A template to bootstrap a Node.js CJS app written in TypeScript with ESLint & Jest all wired-up

### Usage
```sh
git clone git@github.com:maxleiko/tpl-node-app.git
cd tpl-node-app
git remote set-url origin <YOUR_REPO_URL>
yarn
```

### Available scripts:
 - `clean`: removes the generated `./build` directory
 - `compile`: compiles `./src` with TypeScript
 - `build`: triggers `clean` and `compile`
 - `lint`: lint your files using ESLint
 - `test`: runs the tests using Jest
