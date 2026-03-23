# p-event

> Promisify an event by waiting for it to be emitted

Useful when you need only one event emission and want to use it with promises or await it in an async function.

It works with any event API in Node.js and the browser (using a bundler).

If you want multiple individual events as they are emitted, you can use the `pEventIterator()` method. [Observables](https://medium.com/@benlesh/learning-observable-by-building-observable-d5da57405d87) can be useful too.

## Install

```sh
npm install p-event
```

## Usage

In Node.js:

```js
import {pEvent} from 'p-event';
import emitter from './some-event-emitter';

try {
	const result = await pEvent(emitter, 'finish');

	// `emitter` emitted a `finish` event
	console.log(result);
} catch (error) {
	// `emitter` emitted an `error` event
	console.error(error);
}
```

In the browser:

```js
import {pEvent} from 'p-event';

await pEvent(document, 'DOMContentLoaded');
console.log('😎');
```

Async iteration:

```js
import {pEventIterator} from 'p-event';
import emitter from './some-event-emitter';

const asyncIterator = pEventIterator(emitter, 'data', {
	resolutionEvents: ['finish']
});

for await (const event of asyncIterator) {
	console.log(event);
}
```

## API

### pEvent(emitter, event, options?)
### pEvent(emitter, event, filter)

Returns a `Promise` that is fulfilled when `emitter` emits an event matching `event`, or rejects if `emitter` emits any of the events defined in the `rejectionEvents` option.

**Note**: `event` is a string for a single event type, for example, `'data'`. To listen on multiple
events, pass an array of strings, such as `['started', 'stopped']`.

The returned promise has a `.cancel()` method, which when called, removes the event listeners and causes the promise to remain unsettled. However, for new code, it's recommended to use the [`signal` option](#signal) instead.

#### emitter

Type: `object`

Event emitter object.

Should have either a `.on()`/`.addListener()`/`.addEventListener()` and `.off()`/`.removeListener()`/`.removeEventListener()` method, like the [Node.js `EventEmitter`](https://nodejs.org/api/events.html) and [DOM events](https://developer.mozilla.org/en-US/docs/Web/Events).

#### event

Type: `string | string[]`

Name of the event or events to listen to.

If the same event is defined both here and in `rejectionEvents`, this one takes priority.

#### options

Type: `object`

##### rejectionEvents

Type: `string[]`\
Default: `['error']`

Events that will reject the promise.

##### multiArgs

Type: `boolean`\
Default: `false`

By default, the promisified function will only return the first argument from the event callback, which works fine for most APIs. This option can be useful for APIs that return multiple arguments in the callback. Turning this on will make it return an array of all arguments from the callback, instead of just the first argument.

Example:

```js
import {pEvent} from 'p-event';
import emitter from './some-event-emitter';

const [foo, bar] = await pEvent(emitter, 'finish', {multiArgs: true});
```

##### rejectionMultiArgs

Type: `boolean`\
Default: `false`

By default, rejection events will only return the first argument from the event callback. Turning this on will make it return an array of all arguments from the rejection event callback.

Example:

```js
import {pEvent} from 'p-event';
import emitter from './some-event-emitter';

try {
	await pEvent(emitter, 'finish', {rejectionMultiArgs: true});
} catch (error) {
	// If rejection event emits multiple arguments, error will be an array
	console.log(error); // ['error', 'details', 'code']
}
```

##### timeout

Type: `number`\
Default: `Infinity`

Time in milliseconds before timing out.

##### filter

Type: `Function`

A filter function for accepting an event. Can be synchronous or asynchronous.

```js
import {pEvent} from 'p-event';
import emitter from './some-event-emitter';

// Synchronous filter
const result = await pEvent(emitter, '🦄', value => value > 3);
// Do something with first 🦄 event with a value greater than 3

// Asynchronous filter (e.g., API validation)
const result2 = await pEvent(emitter, 'data', async value => {
	const isValid = await validateWithAPI(value);
	return isValid;
});
// Do something with first 'data' event that passes async validation
```

> [!NOTE]
> If the filter function throws an error or returns a rejected promise, the promise returned by `pEvent` will be rejected with that error. If you want to handle filter errors gracefully, wrap your filter logic in a try-catch block and return `false` for invalid events.

##### signal

Type: `AbortSignal`

An [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) to abort waiting for the event.

### pEventMultiple(emitter, event, options)

Wait for multiple event emissions. Returns an array.

This method has the same arguments and options as `pEvent()` with the addition of the following options:

#### options

Type: `object`

##### count

*Required*\
Type: `number`

The number of times the event needs to be emitted before the promise resolves.

##### resolveImmediately

Type: `boolean`\
Default: `false`

Whether to resolve the promise immediately. Emitting one of the `rejectionEvents` won't throw an error.

**Note**: The returned array will be mutated when an event is emitted.

Example:

```js
import {pEventMultiple} from 'p-event';

const emitter = new EventEmitter();

const promise = pEventMultiple(emitter, 'hello', {
	resolveImmediately: true,
	count: Infinity
});

const result = await promise;
console.log(result);
//=> []

emitter.emit('hello', 'Jack');
console.log(result);
//=> ['Jack']

emitter.emit('hello', 'Mark');
console.log(result);
//=> ['Jack', 'Mark']

// Stops listening
emitter.emit('error', new Error('😿'));

emitter.emit('hello', 'John');
console.log(result);
//=> ['Jack', 'Mark']
```

### pEventIterator(emitter, event, options?)
### pEventIterator(emitter, event, filter)

Returns an [async iterator](https://2ality.com/2016/10/asynchronous-iteration.html) that lets you asynchronously iterate over events of `event` emitted from `emitter`. The iterator ends when `emitter` emits an event matching any of the events defined in `resolutionEvents`, or rejects if `emitter` emits any of the events defined in the `rejectionEvents` option.

This method has the same arguments and options as `pEvent()` with the addition of the following options:

#### options

Type: `object`

##### limit

Type: `number` *(non-negative integer)*\
Default: `Infinity`

The maximum number of events for the iterator before it ends. When the limit is reached, the iterator will be marked as `done`. This option is useful to paginate events, for example, fetching 10 events per page.

##### resolutionEvents

Type: `string[]`\
Default: `[]`

Events that will end the iterator.

### TypedEventEmitter

A TypeScript helper type for getting typed event inference with `pEvent`. Cast your emitter to `TypedEventEmitter<EventMap>` to get the resolved type inferred from your event map.

> [!NOTE]
> Due to a [TypeScript limitation](https://github.com/microsoft/TypeScript/issues/53750), `pEvent` cannot automatically infer event types from `EventEmitter<T>` subclasses. Use `TypedEventEmitter` as a workaround.

```ts
import {pEvent, type TypedEventEmitter} from 'p-event';
import {EventEmitter} from 'node:events';

type MyEvents = {
	data: [buffer: Uint8Array];
	error: [error: Error];
};

class MyEmitter extends EventEmitter<MyEvents> {}

const emitter = new MyEmitter() as unknown as TypedEventEmitter<MyEvents>;

const buffer = await pEvent(emitter, 'data');
//=> Uint8Array
```

### TimeoutError

Exposed for instance checking and sub-classing.

Example:

```js
import {pEvent} from 'p-event';

try {
	await pEvent(emitter, 'finish');
} catch (error) {
	if (error instanceof pEvent.TimeoutError) {
		// Do something specific for timeout errors
	}
}
```

## Before and after

```js
import fs from 'node:fs';

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
import fs from 'node:fs';
import {pEvent} from 'p-event';

async function getOpenReadStream(file) {
	const stream = fs.createReadStream(file);
	await pEvent(stream, 'open');
	return stream;
}

(async () => {
	const stream = await getOpenReadStream('unicorn.txt');
	console.log('File descriptor:', stream.fd);
	stream.pipe(process.stdout);
})()
	.catch(console.error);
```

## Tips

### Migrating from `.cancel()` to `AbortSignal`

If you're using `.cancel()` in existing code, here's how to migrate to the preferred `AbortSignal` approach:

```js
// Before
const promise = pEvent(emitter, 'finish');
// ... later
promise.cancel();

// After
const controller = new AbortController();
const promise = pEvent(emitter, 'finish', {
	signal: controller.signal
});
// ... later
controller.abort();
```

### Dealing with calls that resolve with an error code

Some functions might use a single event for success and for certain errors. Promises make it easy to have combined error handler for both error events and successes containing values which represent errors.

```js
import {pEvent} from 'p-event';
import emitter from './some-event-emitter';

try {
	const result = await pEvent(emitter, 'finish');

	if (result === 'unwanted result') {
		throw new Error('Emitter finished with an error');
	}

	// `emitter` emitted a `finish` event with an acceptable value
	console.log(result);
} catch (error) {
	// `emitter` emitted an `error` event or
	// emitted a `finish` with 'unwanted result'
	console.error(error);
}
```

## Related

- [pify](https://github.com/sindresorhus/pify) - Promisify a callback-style function
- [p-map](https://github.com/sindresorhus/p-map) - Map over promises concurrently
- [More…](https://github.com/sindresorhus/promise-fun)
