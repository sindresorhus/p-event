export type AddRemoveListener<EventName extends string | symbol, Arguments extends unknown[]> = (
	event: EventName,
	listener: (...arguments: Arguments) => void
) => void;

export type Emitter<EventName extends string | symbol, EmittedType extends unknown[]> = {
	on?: AddRemoveListener<EventName, EmittedType>;
	addListener?: AddRemoveListener<EventName, EmittedType>;
	addEventListener?: AddRemoveListener<EventName, EmittedType>;
	off?: AddRemoveListener<EventName, EmittedType>;
	removeListener?: AddRemoveListener<EventName, EmittedType>;
	removeEventListener?: AddRemoveListener<EventName, EmittedType>;
};

// Helper to detect EventEmitter-like objects
type NodeEventEmitter<EventMap extends Record<string | symbol, unknown[]> = Record<string | symbol, unknown[]>> = {
	on(event: string | symbol, listener: (...args: unknown[]) => void): unknown;
	off?(event: string | symbol, listener: (...args: unknown[]) => void): unknown;
};

export type FilterFunction<ElementType extends unknown | unknown[]> = (
	value: ElementType
) => boolean | Promise<boolean>;

export type CancelablePromise<ResolveType> = {
	cancel(): void;
} & Promise<ResolveType>;

export type Options<EmittedType extends unknown | unknown[]> = {
	/**
	Events that will reject the promise.

	@default ['error']
	*/
	readonly rejectionEvents?: ReadonlyArray<string | symbol>;

	/**
	By default, rejection events will only return the first argument from the event callback. Turning this on will make it return an array of all arguments from the rejection event callback.

	@default false

	@example
	```
	import {pEvent} from 'p-event';
	import emitter from './some-event-emitter';

	try {
		await pEvent(emitter, 'finish', {rejectionMultiArgs: true});
	} catch (error) {
		// If rejection event emits multiple arguments, error will be an array
		console.log(error); // ['error', 'details', 'code']
	}
	```
	*/
	readonly rejectionMultiArgs?: boolean;

	/**
	By default, the promisified function will only return the first argument from the event callback, which works fine for most APIs. This option can be useful for APIs that return multiple arguments in the callback. Turning this on will make it return an array of all arguments from the callback, instead of just the first argument.

	@default false

	@example
	```
	import {pEvent} from 'p-event';
	import emitter from './some-event-emitter';

	const [foo, bar] = await pEvent(emitter, 'finish', {multiArgs: true});
	```
	*/
	readonly multiArgs?: boolean;

	/**
	The time in milliseconds before timing out.

	@default Infinity
	*/
	readonly timeout?: number;

	/**
	A filter function for accepting an event. Can be synchronous or asynchronous.

	@example
	```
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
	*/
	readonly filter?: FilterFunction<EmittedType>;

	/**
	An [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) to abort waiting for the event.
	*/
	readonly signal?: AbortSignal | undefined;
};

export type MultiArgumentsOptions<EmittedType extends unknown[]> = {
	readonly multiArgs: true;
} & Options<EmittedType>;

export type MultipleOptions<EmittedType extends unknown | unknown[]> = {
	/**
	The number of times the event needs to be emitted before the promise resolves.
	*/
	readonly count: number;

	/**
	Whether to resolve the promise immediately. Emitting one of the `rejectionEvents` won't throw an error.

	__Note__: The returned array will be mutated when an event is emitted.

	@example
	```
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
	*/
	readonly resolveImmediately?: boolean;
} & Options<EmittedType>;

export type MultipleMultiArgumentsOptions<EmittedType extends unknown[]> = {
	readonly multiArgs: true;
} & MultipleOptions<EmittedType>;

export type IteratorOptions<EmittedType extends unknown | unknown[]> = {
	/**
	The maximum number of events for the iterator before it ends. When the limit is reached, the iterator will be marked as `done`. This option is useful to paginate events, for example, fetching 10 events per page.

	@default Infinity
	*/
	readonly limit?: number;

	/**
	Events that will end the iterator.

	@default []
	*/
	readonly resolutionEvents?: ReadonlyArray<string | symbol>;
} & Options<EmittedType>;

export type IteratorMultiArgumentsOptions<EmittedType extends unknown[]> = {
	multiArgs: true;
} & IteratorOptions<EmittedType>;

/**
Promisify an event by waiting for it to be emitted.

@param emitter - Event emitter object. Should have either a `.on()`/`.addListener()`/`.addEventListener()` and `.off()`/`.removeListener()`/`.removeEventListener()` method, like the [Node.js `EventEmitter`](https://nodejs.org/api/events.html) and [DOM events](https://developer.mozilla.org/en-US/docs/Web/Events).
@param event - Name of the event or events to listen to. If the same event is defined both here and in `rejectionEvents`, this one takes priority.*Note**: `event` is a string for a single event type, for example, `'data'`. To listen on multiple events, pass an array of strings, such as `['started', 'stopped']`.
@returns Fulfills when emitter emits an event matching `event`, or rejects if emitter emits any of the events defined in the `rejectionEvents` option. The returned promise has a `.cancel()` method, which when called, removes the event listeners and causes the promise to never be settled.

@example
```
import {pEvent} from 'p-event';
import emitter from './some-event-emitter';

// In Node.js:
try {
	const result = await pEvent(emitter, 'finish');

	// `emitter` emitted a `finish` event
	console.log(result);
} catch (error) {
	// `emitter` emitted an `error` event
	console.error(error);
}

// In the browser:
await pEvent(document, 'DOMContentLoaded');
console.log('😎');
```
*/
export function pEvent<EventName extends string | symbol, EmittedType extends unknown[]>(
	emitter: Emitter<EventName, EmittedType>,
	event: string | symbol | ReadonlyArray<string | symbol>,
	options: MultiArgumentsOptions<EmittedType>
): CancelablePromise<EmittedType>;
export function pEvent<EventName extends string | symbol, EmittedType>(
	emitter: Emitter<EventName, [EmittedType]>,
	event: string | symbol | ReadonlyArray<string | symbol>,
	filter: FilterFunction<EmittedType>
): CancelablePromise<EmittedType>;
export function pEvent<EventName extends string | symbol, EmittedType>(
	emitter: Emitter<EventName, [EmittedType]>,
	event: string | symbol | ReadonlyArray<string | symbol>,
	options?: Options<EmittedType>
): CancelablePromise<EmittedType>;

// Node.js EventEmitter overloads for @types/node v22 compatibility
export function pEvent<EventMap extends Record<string | symbol, unknown[]>, K extends keyof EventMap>(
	emitter: NodeEventEmitter<EventMap>,
	event: K,
	options: MultiArgumentsOptions<EventMap[K]>
): CancelablePromise<EventMap[K]>;
export function pEvent<EventMap extends Record<string | symbol, unknown[]>, K extends keyof EventMap>(
	emitter: NodeEventEmitter<EventMap>,
	event: K,
	filter: FilterFunction<EventMap[K][0]>
): CancelablePromise<EventMap[K][0]>;
export function pEvent<EventMap extends Record<string | symbol, unknown[]>, K extends keyof EventMap>(
	emitter: NodeEventEmitter<EventMap>,
	event: K,
	options?: Options<EventMap[K][0]>
): CancelablePromise<EventMap[K][0]>;
export function pEvent(
	emitter: NodeEventEmitter,
	event: string | symbol | ReadonlyArray<string | symbol>,
	options: MultiArgumentsOptions<unknown[]>
): CancelablePromise<unknown[]>;
export function pEvent(
	emitter: NodeEventEmitter,
	event: string | symbol | ReadonlyArray<string | symbol>,
	filter: FilterFunction<unknown>
): CancelablePromise<unknown>;
export function pEvent(
	emitter: NodeEventEmitter,
	event: string | symbol | ReadonlyArray<string | symbol>,
	options?: Options<unknown>
): CancelablePromise<unknown>;

/**
Wait for multiple event emissions.
*/
export function pEventMultiple<EventName extends string | symbol, EmittedType extends unknown[]>(
	emitter: Emitter<EventName, EmittedType>,
	event: string | symbol | ReadonlyArray<string | symbol>,
	options: MultipleMultiArgumentsOptions<EmittedType>
): CancelablePromise<EmittedType[]>;
export function pEventMultiple<EventName extends string | symbol, EmittedType>(
	emitter: Emitter<EventName, [EmittedType]>,
	event: string | symbol | ReadonlyArray<string | symbol>,
	options: MultipleOptions<EmittedType>
): CancelablePromise<EmittedType[]>;

// Node.js EventEmitter overloads for @types/node v22 compatibility
export function pEventMultiple<EventMap extends Record<string | symbol, unknown[]>, K extends keyof EventMap>(
	emitter: NodeEventEmitter<EventMap>,
	event: K,
	options: MultipleMultiArgumentsOptions<EventMap[K]>
): CancelablePromise<Array<EventMap[K]>>;
export function pEventMultiple<EventMap extends Record<string | symbol, unknown[]>, K extends keyof EventMap>(
	emitter: NodeEventEmitter<EventMap>,
	event: K,
	options: MultipleOptions<EventMap[K][0]>
): CancelablePromise<Array<EventMap[K][0]>>;
export function pEventMultiple(
	emitter: NodeEventEmitter,
	event: string | symbol | ReadonlyArray<string | symbol>,
	options: MultipleMultiArgumentsOptions<unknown[]>
): CancelablePromise<unknown[][]>;
export function pEventMultiple(
	emitter: NodeEventEmitter,
	event: string | symbol | ReadonlyArray<string | symbol>,
	options: MultipleOptions<unknown>
): CancelablePromise<unknown[]>;

/**
@returns An [async iterator](https://2ality.com/2016/10/asynchronous-iteration.html) that lets you asynchronously iterate over events of `event` emitted from `emitter`. The iterator ends when `emitter` emits an event matching any of the events defined in `resolutionEvents`, or rejects if `emitter` emits any of the events defined in the `rejectionEvents` option.

@example
```
import {pEventIterator} from 'p-event';
import emitter from './some-event-emitter';

const asyncIterator = pEventIterator(emitter, 'data', {
	resolutionEvents: ['finish']
});

for await (const event of asyncIterator) {
	console.log(event);
}
```
*/
export function pEventIterator<EventName extends string | symbol, EmittedType extends unknown[]>(
	emitter: Emitter<EventName, EmittedType>,
	event: string | symbol | ReadonlyArray<string | symbol>,
	options: IteratorMultiArgumentsOptions<EmittedType>
): AsyncIterableIterator<EmittedType>;
export function pEventIterator<EventName extends string | symbol, EmittedType>(
	emitter: Emitter<EventName, [EmittedType]>,
	event: string | symbol | ReadonlyArray<string | symbol>,
	filter: FilterFunction<EmittedType>
): AsyncIterableIterator<EmittedType>;
export function pEventIterator<EventName extends string | symbol, EmittedType>(
	emitter: Emitter<EventName, [EmittedType]>,
	event: string | symbol | ReadonlyArray<string | symbol>,
	options?: IteratorOptions<EmittedType>
): AsyncIterableIterator<EmittedType>;

// Node.js EventEmitter overloads for @types/node v22 compatibility
export function pEventIterator<EventMap extends Record<string | symbol, unknown[]>, K extends keyof EventMap>(
	emitter: NodeEventEmitter<EventMap>,
	event: K,
	options: IteratorMultiArgumentsOptions<EventMap[K]>
): AsyncIterableIterator<EventMap[K]>;
export function pEventIterator<EventMap extends Record<string | symbol, unknown[]>, K extends keyof EventMap>(
	emitter: NodeEventEmitter<EventMap>,
	event: K,
	filter: FilterFunction<EventMap[K][0]>
): AsyncIterableIterator<EventMap[K][0]>;
export function pEventIterator<EventMap extends Record<string | symbol, unknown[]>, K extends keyof EventMap>(
	emitter: NodeEventEmitter<EventMap>,
	event: K,
	options?: IteratorOptions<EventMap[K][0]>
): AsyncIterableIterator<EventMap[K][0]>;
export function pEventIterator(
	emitter: NodeEventEmitter,
	event: string | symbol | ReadonlyArray<string | symbol>,
	options: IteratorMultiArgumentsOptions<unknown[]>
): AsyncIterableIterator<unknown[]>;
export function pEventIterator(
	emitter: NodeEventEmitter,
	event: string | symbol | ReadonlyArray<string | symbol>,
	filter: FilterFunction<unknown>
): AsyncIterableIterator<unknown>;
export function pEventIterator(
	emitter: NodeEventEmitter,
	event: string | symbol | ReadonlyArray<string | symbol>,
	options?: IteratorOptions<unknown>
): AsyncIterableIterator<unknown>;

export {TimeoutError} from 'p-timeout';
