/// <reference lib="esnext"/>

export type AddRemoveListener<Arguments extends unknown[]> = (
	event: string | symbol,
	listener: (
		...args: Arguments,
	) => void
) => void;

export interface Emitter<EmittedType extends unknown[]> {
	on?: AddRemoveListener<EmittedType>;
	addListener?: AddRemoveListener<EmittedType>;
	addEventListener?: AddRemoveListener<EmittedType>;
	off?: AddRemoveListener<EmittedType>;
	removeListener?: AddRemoveListener<EmittedType>;
	removeEventListener?: AddRemoveListener<EmittedType>;
}

export type FilterFunction<ElementType extends unknown[]> = (...args: ElementType) => boolean;

export interface CancelablePromise<ResolveType> extends Promise<ResolveType> {
	cancel(): void;
}

/**
 * Promisify an event by waiting for it to be emitted.
 *
 * @param emitter - Event emitter object. Should have either a `.on()`/`.addListener()`/`.addEventListener()` and `.off()`/`.removeListener()`/`.removeEventListener()` method, like the [Node.js `EventEmitter`](https://nodejs.org/api/events.html) and [DOM events](https://developer.mozilla.org/en-US/docs/Web/Events).
 * @param event - Name of the event or events to listen to. If the same event is defined both here and in `rejectionEvents`, this one takes priority. **Note**: `event` is a string for a single event type, for example, `'data'`. To listen on multiple events, pass an array of strings, such as `['started', 'stopped']`.
 * @returns A `Promise` that is fulfilled when emitter emits an event matching `event`, or rejects if emitter emits any of the events defined in the `rejectionEvents` option. The returned promise has a `.cancel()` method, which when called, removes the event listeners and causes the promise to never be settled.
 */
declare function pEvent<EmittedType extends unknown[]>(
	emitter: Emitter<EmittedType>,
	event: string | symbol | (string | symbol)[],
	options: MultiArgumentsOptions<EmittedType>
): CancelablePromise<EmittedType>;
declare function pEvent<EmittedType>(
	emitter: Emitter<[EmittedType]>,
	event: string | symbol | (string | symbol)[],
	filter: FilterFunction<[EmittedType]>
): CancelablePromise<EmittedType>;
declare function pEvent<EmittedType>(
	emitter: Emitter<[EmittedType]>,
	event: string | symbol | (string | symbol)[],
	options?: Options<[EmittedType]>
): CancelablePromise<EmittedType>;

export default pEvent;

/**
 * Wait for multiple event emissions. Returns an array.
 */
export function multiple<EmittedType extends unknown[]>(
	emitter: Emitter<EmittedType>,
	event: string | symbol | (string | symbol)[],
	options: MultipleMultiArgumentsOptions<EmittedType>
): CancelablePromise<EmittedType[]>;
export function multiple<EmittedType>(
	emitter: Emitter<[EmittedType]>,
	event: string | symbol | (string | symbol)[],
	options: MultipleOptions<[EmittedType]>
): CancelablePromise<EmittedType[]>;

/**
 * @returns An [async iterator](http://2ality.com/2016/10/asynchronous-iteration.html) that lets you asynchronously iterate over events of `event` emitted from `emitter`. The iterator ends when `emitter` emits an event matching any of the events defined in `resolutionEvents`, or rejects if `emitter` emits any of the events defined in the `rejectionEvents` option.
 */
export function iterator<EmittedType extends unknown[]>(
	emitter: Emitter<EmittedType>,
	event: string | symbol | (string | symbol)[],
	options: IteratorMultiArgumentsOptions<EmittedType>
): AsyncIterableIterator<EmittedType>;
export function iterator<EmittedType>(
	emitter: Emitter<[EmittedType]>,
	event: string | symbol | (string | symbol)[],
	filter: FilterFunction<[EmittedType]>
): AsyncIterableIterator<EmittedType>;
export function iterator<EmittedType>(
	emitter: Emitter<[EmittedType]>,
	event: string | symbol | (string | symbol)[],
	options?: IteratorOptions<[EmittedType]>
): AsyncIterableIterator<EmittedType>;

export interface Options<EmittedType extends unknown[]> {
	/**
	 * Events that will reject the promise.
	 *
	 * @default ['error']
	 */
	readonly rejectionEvents?: (string | symbol)[];

	/**
	 * By default, the promisified function will only return the first argument from the event callback, which works fine for most APIs. This option can be useful for APIs that return multiple arguments in the callback. Turning this on will make it return an array of all arguments from the callback, instead of just the first argument. This also applies to rejections.
	 *
	 * @default false
	 *
	 * @example
	 *
	 * const pEvent = require('p-event');
	 * const emitter = require('./some-event-emitter');
	 *
	 * (async () => {
	 * 	const [foo, bar] = await pEvent(emitter, 'finish', {multiArgs: true});
	 * })();
	 */
	readonly multiArgs?: boolean;

	/**
	 * Time in milliseconds before timing out.
	 *
	 * @default Infinity
	 */
	readonly timeout?: number;

	/**
	 * Filter function for accepting an event.
	 *
	 * @example
	 *
	 * const pEvent = require('p-event');
	 * const emitter = require('./some-event-emitter');
	 *
	 * (async () => {
	 * 	const result = await pEvent(emitter, '🦄', value => value > 3);
	 * 	// Do something with first 🦄 event with a value greater than 3
	 * })();
	 */
	readonly filter?: FilterFunction<EmittedType>;
}

export interface MultiArgumentsOptions<EmittedType extends unknown[]> extends Options<EmittedType> {
	readonly multiArgs: true;
}

export interface MultipleOptions<EmittedType extends unknown[]> extends Options<EmittedType> {
	/**
	 * The number of times the event needs to be emitted before the promise resolves.
	 */
	readonly count: number;

	/**
	 * Whether to resolve the promise immediately. Emitting one of the `rejectionEvents` won't throw an error.
	 *
	 * **Note**: The returned array will be mutated when an event is emitted.
	 *
	 * @example
	 *
	 * const emitter = new EventEmitter();
	 *
	 * const promise = multiple(emitter, 'hello', {
	 * 	resolveImmediately: true,
	 * 	count: Infinity
	 * });
	 *
	 * const result = await promise;
	 * console.log(result);
	 * //=> []
	 *
	 * emitter.emit('hello', 'Jack');
	 * console.log(result);
	 * //=> ['Jack']
	 *
	 * emitter.emit('hello', 'Mark');
	 * console.log(result);
	 * //=> ['Jack', 'Mark']
	 *
	 * // Stops listening
	 * emitter.emit('error', new Error('😿'));
	 *
	 * emitter.emit('hello', 'John');
	 * console.log(result);
	 * //=> ['Jack', 'Mark']
	 */
	readonly resolveImmediately?: boolean;
}

export interface MultipleMultiArgumentsOptions<EmittedType extends unknown[]> extends MultipleOptions<EmittedType> {
	readonly multiArgs: true;
}

export interface IteratorOptions<EmittedType extends unknown[]> extends Options<EmittedType> {
	/**
	 * Maximum number of events for the iterator before it ends. When the limit is reached, the iterator will be marked as `done`. This option is useful to paginate events, for example, fetching 10 events per page.
	 *
	 * @default Infinity
	 */
	limit?: number;

	/**
	 * Events that will end the iterator.
	 *
	 * @default []
	 */
	resolutionEvents?: (string | symbol)[];
}

export interface IteratorMultiArgumentsOptions<EmittedType extends unknown[]>
	extends IteratorOptions<EmittedType> {
	multiArgs: true;
}
