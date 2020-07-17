import { helloWorld } from '../src';

test('hello world', () => {
  expect(helloWorld()).toEqual('Hello World');
});