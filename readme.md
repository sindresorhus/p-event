# p-event [![Build Status](https://travis-ci.org/sindresorhus/p-event.svg?branch=master)](https://travis-ci.org/sindresorhus/p-event)

> Promisify an event by waiting for it to be emitted

Useful when you need only one event emission and want to use it with promises or await it in an async function.


## Install

```
$ npm install --save p-event
```


## Usage

```js
const pEvent = require('p-event');
const emitter = require('./some-event-emitter');

pEvent(emitter, 'finish')
	// Called when `emitter` emits a `finish` event
	.then(result => {
		console.log(result);
	})
	// Called when `emitter` emits an `error` event
	.catch(error => {
		console.error(error);
	});
```

```js
const pEvent = require('p-event');

pEvent(document, 'DOMContentLoaded').then(() => {
	console.log('😎');
});
```


## API

### pEvent(emitter, event, [options])

Returns a `Promise` that is fulfilled when `emitter` emits an event matching `event`, or rejects if `emitter` emits any of the events defined in the `rejectionEvents` option.

The returned promise has a `.cancel()` method, which when called, removes the event listeners and causes the promise to never be settled.

#### emitter

Type: `Object`

Event emitter object.

Should have either a `.on()`/`.addListener()`/`.addEventListener()` and `.off()`/`.removeListener()`/`.removeEventListener()` method, like the [Node.js `EventEmitter`](https://nodejs.org/api/events.html) and [DOM events](https://developer.mozilla.org/en-US/docs/Web/Events).

#### event

Type: `string`

Name of the event to listen to.

If the same event is defined both here and in `rejectionEvents`, this one takes priority.

#### options

Type: `Object`

##### rejectionEvents

Type: `Array`<br>
Default: `['error']`

Events that will reject the promise.

##### multiArgs

Type: `boolean`<br>
Default: `false`

By default, the promisified function will only return the second argument from the callback, which works fine for most APIs. This option can be useful for modules like `kue` that return multiple arguments. Turning this on will make it return an array of all arguments from the callback, excluding the error argument, instead of just the second argument. This also applies to rejections, where it returns an array of all the callback arguments, including the error.

**ES7**
```js
import kue from 'kue';
import pEvent from 'p-event';

const queue = kue.createQueue();
(async () => {
	const [id, type] = await pEvent(queue, 'job enqueue', { multiArgs: true });
})();
```
**ES6**

```js
const kue = require('kue');
const pEvent = require('p-event');

const queue = kue.createQueue();
pEvent(queue, 'job enqueue', { multiArgs: true }).then(result => {
	const [id, type] = result;
});
```


## Before and after

```js
const fs = require('fs');

function getOpenReadStream(file, callback) {
	const stream = fs.createReadStream(file);

	stream.on('open', () => {
		callback(null, stream);
	});

	stream.on('error', error => {
		callback(error);
	});
}

getOpenReadStream('unicorn.txt', (error, stream) => {
	if (error) {
		console.error(error);
		return;
	}

	console.log('File descriptor:', stream.fd);
	stream.pipe(process.stdout);
});
```

```js
const fs = require('fs');
const pEvent = require('p-event');

async function getOpenReadStream(file) {
	const stream = fs.createReadStream(file);
	await pEvent(stream, 'open');
	return stream;
}

getOpenReadStream('unicorn.txt')
	.then(stream => {
		console.log('File descriptor:', stream.fd);
		stream.pipe(process.stdout);
	})
	.catch(console.error);
```


## Related

- [pify](https://github.com/sindresorhus/pify) - Promisify a callback-style function
- [p-map](https://github.com/sindresorhus/p-map) - Map over promises concurrently
- [More…](https://github.com/sindresorhus/promise-fun)


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
