# p-event [![Build Status](https://travis-ci.org/sindresorhus/p-event.svg?branch=master)](https://travis-ci.org/sindresorhus/p-event)

> Promisify an event by waiting for it to be emitted

Useful when you need only one event emission and want to use it with promises or await it in an async function.

It's works with any event API in Node.js and the browser (using a bundler).

If you want multiple individual events as they are emitted, this module is not for you, as a Promise is a single value. Instead, just continue using event callback or use [Observables](https://medium.com/@benlesh/learning-observable-by-building-observable-d5da57405d87).


## Install

```
$ npm install p-event
```


## Usage

```js
const pEvent = require('p-event');
const emitter = require('./some-event-emitter');

(async () => {
	try {
		const result = await pEvent(emitter, 'finish');

		// `emitter` emitted a `finish` event
		console.log(result);
	} catch (error) {
		// `emitter` emitted an `error` event
		console.error(error);
	}
})();
```

```js
const pEvent = require('p-event');

(async () => {
	await pEvent(document, 'DOMContentLoaded');
	console.log('😎');
})();
```


## API

### pEvent(emitter, event, [options])
### pEvent(emitter, event, filter)

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

By default, the promisified function will only return the first argument from the event callback, which works fine for most APIs. This option can be useful for APIs that return multiple arguments in the callback. Turning this on will make it return an array of all arguments from the callback, instead of just the first argument. This also applies to rejections.

Example:

```js
const pEvent = require('p-event');
const emitter = require('./some-event-emitter');

(async () => {
	const [foo, bar] = await pEvent(emitter, 'finish', {multiArgs: true});
})();
```

##### timeout

Type: `Number`<br>
Default: `Infinity`

Time in milliseconds before timing out.


##### filter

Type: `Function`

Filter function for accepting an event.

```js
const pEvent = require('p-event');
const emitter = require('./some-event-emitter');

(async () => {
	const result = await pEvent(emitter, '🦄', value => value > 3);
	// Do something with first 🦄 event with a value greater than 3
})();
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

(async () => {
	const stream = await getOpenReadStream('unicorn.txt');
	console.log('File descriptor:', stream.fd);
	stream.pipe(process.stdout);
})().catch(console.error);
```


## Dealing with calls that resolve with an error code

Some functions might use a single event for success and for certain errors.  Promises
make this easy to have combined error handler for both error events and successes
containing values which represent errors.

```js
const pEvent = require('p-event');
const emitter = require('./some-event-emitter');

(async () => {
	try {
		const result = await pEvent(emitter, 'finish');

		if (result === 'unwanted result') {
			throw new Error('Emitter finished with an error');
		}
		// `emitter` emitted a `finish` event with an acceptible value
		console.log(result);
	} catch (error) {
		// `emitter` emitted an `error` event or emitted
		// a `finish` with 'unwanted result'
		console.error(error);
	}
})();
```

This also works while using `.then()`.

```js
	pEvent(emitter, 'finish')
		.then(result => {
			if (result === 'unwanted result') {
				throw new Error('Emitter finished with an error');
			}
			// `emitter` emitted a `finish` event with an acceptible value
			console.log(result);
		})
		.catch(error => {
			// `emitter` emitted an `error` event or emitted
			// a `finish` with 'unwanted result'
			console.error(error);
		});
```

## Related

- [pify](https://github.com/sindresorhus/pify) - Promisify a callback-style function
- [p-map](https://github.com/sindresorhus/p-map) - Map over promises concurrently
- [More…](https://github.com/sindresorhus/promise-fun)


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
