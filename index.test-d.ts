// `tsd` used to load the `esnext` lib, which has `Array.fromAsync()`.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference lib="esnext.array" />
import process from 'node:process';
import {EventEmitter} from 'node:events';
import type * as readline from 'node:readline';
import fs from 'node:fs';
import {expectTypeOf, expectError} from 'nz';
import {
	pEvent,
	pEventMultiple,
	pEventIterator,
	type CancelablePromise,
	type TypedEventEmitter,
} from './index.js';

class NodeEmitter extends EventEmitter {
	override on(_event: 'finish', _listener: (number: number, string: string) => void) {
		return this;
	}

	override addListener(
		_event: 'finish',
		_listener: (number: number, string: string) => void,
	) {
		return this;
	}

	addEventListener(
		_event: 'finish',
		_listener: (number: number, string: string) => void,
	) {
		return this;
	}

	override off(_event: 'finish', _listener: (number: number, string: string) => void) {
		return this;
	}

	override removeListener(
		_event: 'finish',
		_listener: (number: number, string: string) => void,
	) {
		return this;
	}

	removeEventListener(
		_event: 'finish',
		_listener: (number: number, string: string) => void,
	) {
		return this;
	}
}

class DomEmitter implements EventTarget {
	addEventListener(
		_type: 'foo',
		_listener: EventListenerOrEventListenerObject,
		_options?: boolean | AddEventListenerOptions,
	): void {} // eslint-disable-line @typescript-eslint/no-empty-function

	dispatchEvent(_event: Event): boolean {
		return false;
	}

	removeEventListener(
		_type: 'foo',
		_listener: EventListenerOrEventListenerObject,
		_options?: boolean | AddEventListenerOptions,
	): void {} // eslint-disable-line @typescript-eslint/no-empty-function
}

expectTypeOf(pEvent(new NodeEmitter(), 'finish')).toBe<CancelablePromise<number>>();
expectTypeOf(pEvent(new NodeEmitter(), '🦄', value => value > 3)).toBe<CancelablePromise<number>>();
expectTypeOf(pEvent(new DomEmitter(), 'finish')).toBe<CancelablePromise<Event>>();
expectTypeOf(pEvent(document, 'DOMContentLoaded')).toBe<CancelablePromise<Event>>();

expectTypeOf(pEvent(new NodeEmitter(), 'finish', {rejectionEvents: ['error']})).toBe<CancelablePromise<number>>();
expectTypeOf(pEvent(new NodeEmitter(), 'finish', {timeout: 1})).toBe<CancelablePromise<number>>();
expectTypeOf(pEvent(new NodeEmitter(), 'finish', {filter: value => value > 3})).toBe<CancelablePromise<number>>();
expectTypeOf(pEvent(new NodeEmitter(), 'finish', {multiArgs: true})).toBe<CancelablePromise<[number, string]>>();
void pEvent(new NodeEmitter(), 'finish', {
	multiArgs: true,
	filter: ([_, string]: [number, string]) => string === '🦄',
});

pEvent(new NodeEmitter(), 'finish').cancel();

expectTypeOf(pEventMultiple(new NodeEmitter(), 'hello', {count: Infinity})).toBe<CancelablePromise<number[]>>();
expectTypeOf(pEventMultiple(new NodeEmitter(), 'hello', {
	resolveImmediately: true,
	count: Infinity,
})).toBe<CancelablePromise<number[]>>();
expectTypeOf(pEventMultiple(new NodeEmitter(), 'hello', {
	count: Infinity,
	multiArgs: true,
})).toBe<CancelablePromise<Array<[number, string]>>>();
void pEventMultiple(new NodeEmitter(), 'finish', {
	count: Infinity,
	multiArgs: true,
	filter: ([_, string]: [number, string]) => string === '🦄',
});

expectTypeOf(pEventIterator(new NodeEmitter(), 'finish')).toBe<AsyncIterableIterator<number>>();
expectTypeOf(pEventIterator(new NodeEmitter(), '🦄', value => value > 3)).toBe<AsyncIterableIterator<number>>();

expectTypeOf(pEventIterator(new NodeEmitter(), 'finish', {limit: 1})).toBe<AsyncIterableIterator<number>>();
expectTypeOf(pEventIterator(new NodeEmitter(), 'finish', {resolutionEvents: ['finish']})).toBe<AsyncIterableIterator<number>>();
expectTypeOf(pEventIterator(new NodeEmitter(), 'finish', {multiArgs: true})).toBe<AsyncIterableIterator<[number, string]>>();

// The iterator has no promise to time out, so `timeout` was accepted by the type and then ignored at runtime.
expectError(pEventIterator(new NodeEmitter(), 'finish', {timeout: 1}));
void pEventIterator(new NodeEmitter(), 'finish', {
	multiArgs: true,
	filter: ([_, string]: [number, string]) => string === '🦄',
});

async function getOpenReadStream(file: string): Promise<NodeJS.ReadableStream> {
	const stream = fs.createReadStream(file) as NodeJS.ReadableStream;
	await pEvent(stream, 'open');
	return stream;
}

const stream = await getOpenReadStream('unicorn.txt');
stream.pipe(process.stdout);

const result = await pEvent(new NodeEmitter(), 'finish');
if (result === 1) {
	throw new Error('Emitter finished with an error');
}

// TypedEventEmitter tests
type MyEvents = {
	data: [buffer: Uint8Array];
	message: [text: string, id: number];
};

declare const typedEmitter: TypedEventEmitter<MyEvents>;

// PEvent with TypedEventEmitter
expectTypeOf(pEvent(typedEmitter, 'data')).toBe<CancelablePromise<Uint8Array>>();
expectTypeOf(pEvent(typedEmitter, 'message')).toBe<CancelablePromise<string>>();
expectTypeOf(pEvent(typedEmitter, 'message', {multiArgs: true})).toBe<CancelablePromise<[string, number]>>();
expectTypeOf(pEvent(typedEmitter, 'data', value => value.length > 0)).toBe<CancelablePromise<Uint8Array>>();

// PEventMultiple with TypedEventEmitter
expectTypeOf(pEventMultiple(typedEmitter, 'data', {count: 3})).toBe<CancelablePromise<Uint8Array[]>>();
expectTypeOf(pEventMultiple(typedEmitter, 'message', {count: 3, multiArgs: true})).toBe<CancelablePromise<Array<[string, number]>>>();

// PEventIterator with TypedEventEmitter
expectTypeOf(pEventIterator(typedEmitter, 'data')).toBe<AsyncIterableIterator<Uint8Array>>();
expectTypeOf(pEventIterator(typedEmitter, 'message', {multiArgs: true})).toBe<AsyncIterableIterator<[string, number]>>();
expectTypeOf(pEventIterator(typedEmitter, 'data', value => value.length > 0)).toBe<AsyncIterableIterator<Uint8Array>>();

// TypedEventEmitter with symbol keys
const symbolEvent = Symbol('myEvent');
type SymbolEvents = {
	[symbolEvent]: [value: number];
};

declare const symbolEmitter: TypedEventEmitter<SymbolEvents>;
expectTypeOf(pEvent(symbolEmitter, symbolEvent)).toBe<CancelablePromise<number>>();

// Readline tests
declare const rl: readline.Interface;

// PEvent with readline
expectTypeOf(pEvent(rl, 'line')).toBe<CancelablePromise<string>>();
expectTypeOf(pEvent(rl, 'history')).toBe<CancelablePromise<string[]>>();
expectTypeOf(pEvent(rl, 'line', {multiArgs: true})).toBe<CancelablePromise<[string]>>();
expectTypeOf(pEvent(rl, 'line', line => line.length > 0)).toBe<CancelablePromise<string>>();

// PEventMultiple with readline
expectTypeOf(pEventMultiple(rl, 'line', {count: 5})).toBe<CancelablePromise<string[]>>();
expectTypeOf(pEventMultiple(rl, 'line', {count: 5, multiArgs: true})).toBe<CancelablePromise<Array<[string]>>>();

// PEventIterator with readline
expectTypeOf(pEventIterator(rl, 'line')).toBe<AsyncIterableIterator<string>>();
expectTypeOf(pEventIterator(rl, 'line', {multiArgs: true})).toBe<AsyncIterableIterator<[string]>>();
expectTypeOf(pEventIterator(rl, 'line', line => line.length > 0)).toBe<AsyncIterableIterator<string>>();

// Overload resolution for shapes that are easy to get wrong.
declare const looseEmitter: {
	on(event: string, listener: (...arguments_: unknown[]) => void): void;
	off(event: string, listener: (...arguments_: unknown[]) => void): void;
};

expectTypeOf(pEvent(looseEmitter, 'anything', {})).toBe<CancelablePromise<unknown>>();
expectTypeOf(pEvent(looseEmitter, 'anything', {multiArgs: false})).toBe<CancelablePromise<unknown>>();
expectTypeOf(pEventMultiple(looseEmitter, 'anything', {count: 1, multiArgs: true})).toBe<CancelablePromise<unknown[][]>>();
expectTypeOf(pEventIterator(looseEmitter, 'anything', {limit: 1, multiArgs: true})).toBe<AsyncIterableIterator<unknown[]>>();

// `multiArgs: false` must not select the multi-argument overload.
expectTypeOf(pEvent(new NodeEmitter(), 'finish', {multiArgs: false})).toBe<CancelablePromise<number>>();

// The returned iterator is a real async iterable, so it can be drained or looped over.
const drain = async () => Array.fromAsync(pEventIterator(new NodeEmitter(), 'finish', {limit: 2}));

expectTypeOf(drain).toBe<() => Promise<number[]>>();

// `.cancel()` is available on every returned promise, including the ones the types narrow.
pEventMultiple(new NodeEmitter(), 'finish', {count: 1}).cancel();

// An emitter missing its removal method is still assignable, since that is a runtime check rather than a type one.
declare const addOnly: {
	on(event: string, listener: (...arguments_: unknown[]) => void): void;
};

void pEvent(addOnly, 'anything');

// An exhaustive pass over the option forms, so a wrong resolved type has nowhere to hide.
type Events = {
	data: [buffer: Uint8Array];
	message: [text: string, id: number];
	silent: [value?: undefined];
};

declare const typed: TypedEventEmitter<Events>;
expectTypeOf(pEvent(typed, 'data')).toBe<CancelablePromise<Uint8Array>>();
expectTypeOf(pEvent(typed, 'data', {})).toBe<CancelablePromise<Uint8Array>>();
expectTypeOf(pEvent(typed, 'data', {multiArgs: false})).toBe<CancelablePromise<Uint8Array>>();
expectTypeOf(pEvent(typed, 'data', {rejectionEvents: ['error']})).toBe<CancelablePromise<Uint8Array>>();
expectTypeOf(pEvent(typed, 'data', {timeout: 1})).toBe<CancelablePromise<Uint8Array>>();
expectTypeOf(pEvent(typed, 'data', {signal: AbortSignal.timeout(1)})).toBe<CancelablePromise<Uint8Array>>();
expectTypeOf(pEvent(typed, 'data', {multiArgs: true})).toBe<CancelablePromise<[Uint8Array]>>();
expectTypeOf(pEvent(typed, 'data', {multiArgs: true, rejectionEvents: ['error']})).toBe<CancelablePromise<[Uint8Array]>>();
expectTypeOf(pEvent(typed, 'data', {multiArgs: true, rejectionMultiArgs: true})).toBe<CancelablePromise<[Uint8Array]>>();
expectTypeOf(pEvent(typed, 'data', {multiArgs: true, timeout: 1})).toBe<CancelablePromise<[Uint8Array]>>();

// An event with no arguments carries nothing, so its first argument is `undefined`.
expectTypeOf(pEvent(typed, 'silent')).toBe<CancelablePromise<undefined>>();

// An array of names falls back to the loose overload, which is the documented limitation.
expectTypeOf(pEvent(typed, ['data'])).toBe<CancelablePromise<unknown>>();
expectTypeOf(pEvent(typed, ['data', 'message'])).toBe<CancelablePromise<unknown>>();
expectTypeOf(pEvent(typed, ['data', 'message'], {multiArgs: true})).toBe<CancelablePromise<unknown[]>>();

// The multiple and iterator forms.
expectTypeOf(pEventMultiple(typed, 'data', {count: 1})).toBe<CancelablePromise<Uint8Array[]>>();
expectTypeOf(pEventMultiple(typed, 'data', {count: 1, multiArgs: true})).toBe<CancelablePromise<Array<[Uint8Array]>>>();
expectTypeOf(pEventIterator(typed, 'data')).toBe<AsyncIterableIterator<Uint8Array>>();
expectTypeOf(pEventIterator(typed, 'data', {limit: 1})).toBe<AsyncIterableIterator<Uint8Array>>();
expectTypeOf(pEventIterator(typed, 'data', {resolutionEvents: ['message']})).toBe<AsyncIterableIterator<Uint8Array>>();
expectTypeOf(pEventIterator(typed, 'data', {multiArgs: true})).toBe<AsyncIterableIterator<[Uint8Array]>>();
expectTypeOf(pEventIterator(typed, 'data', {multiArgs: true, limit: 1})).toBe<AsyncIterableIterator<[Uint8Array]>>();

// The positional filter form.
expectTypeOf(pEvent(typed, 'data', value => value.length > 0)).toBe<CancelablePromise<Uint8Array>>();
expectTypeOf(pEventIterator(typed, 'data', value => value.length > 0)).toBe<AsyncIterableIterator<Uint8Array>>();

// Readline, one name and the array form.
// A `history` event carries one argument that is itself an array, so each item is that array.
expectTypeOf(pEventMultiple(rl, 'history', {count: 1})).toBe<CancelablePromise<string[][]>>();
expectTypeOf(pEventIterator(rl, 'line', {limit: 1})).toBe<AsyncIterableIterator<string>>();
expectTypeOf(pEvent(rl, ['line'])).toBe<CancelablePromise<unknown>>();
expectTypeOf(pEvent(rl, ['line', 'history'])).toBe<CancelablePromise<unknown>>();

// A DOM emitter, whose listener only receives an Event.
class Dom implements EventTarget {
	addEventListener(_type: 'done', _listener: EventListenerOrEventListenerObject, _options?: boolean | AddEventListenerOptions): void {
		// Only the shape matters here, so nothing is done.
	}

	removeEventListener(_type: 'done', _listener: EventListenerOrEventListenerObject, _options?: boolean | AddEventListenerOptions): void {
		// Only the shape matters here, so nothing is done.
	}

	dispatchEvent(_event: Event): boolean {
		return false;
	}
}

expectTypeOf(pEvent(new Dom(), 'done')).toBe<CancelablePromise<Event>>();
// With `multiArgs` the value is the whole argument list.
expectTypeOf(pEvent(new Dom(), 'done', {multiArgs: true})).toBe<CancelablePromise<[evt: Event]>>();
expectTypeOf(pEventIterator(new Dom(), 'done', {limit: 1})).toBe<AsyncIterableIterator<Event>>();

// A plain Node emitter with no event map.
expectTypeOf(pEvent(new EventEmitter(), 'anything')).toBe<CancelablePromise<unknown>>();
expectTypeOf(pEvent(new EventEmitter(), 'anything', {multiArgs: true})).toBe<CancelablePromise<unknown[]>>();

type GridEvents = {
	data: [value: string, tail: string];
};

declare const gridTyped: TypedEventEmitter<GridEvents>;

// The whole option grid, checked against what a run of each shape actually resolved to. With `multiArgs` the definitions keep the argument list as a labelled tuple, which is narrower than a plain array and is what the runtime hands over.
expectTypeOf(pEvent(gridTyped, 'data')).toBe<CancelablePromise<string>>();
expectTypeOf(pEvent(gridTyped, 'data', {multiArgs: true})).toBe<CancelablePromise<[value: string, tail: string]>>();
expectTypeOf(pEvent(gridTyped, 'data', {rejectionEvents: ['error']})).toBe<CancelablePromise<string>>();
expectTypeOf(pEvent(gridTyped, 'data', {rejectionMultiArgs: true})).toBe<CancelablePromise<string>>();
expectTypeOf(pEvent(gridTyped, 'data', {multiArgs: true, rejectionMultiArgs: true})).toBe<CancelablePromise<[value: string, tail: string]>>();
expectTypeOf(pEvent(gridTyped, 'data', {multiArgs: true, filter: () => true})).toBe<CancelablePromise<[value: string, tail: string]>>();
expectTypeOf(pEvent(gridTyped, 'data', {filter: () => true})).toBe<CancelablePromise<string>>();

expectTypeOf(pEvent(gridTyped, 'data', () => true)).toBe<CancelablePromise<string>>();
expectTypeOf(pEvent(new Dom(), 'done', () => true)).toBe<CancelablePromise<Event>>();

expectTypeOf(pEventMultiple(gridTyped, 'data', {count: 1})).toBe<CancelablePromise<string[]>>();
expectTypeOf(pEventMultiple(gridTyped, 'data', {count: 1, multiArgs: true})).toBe<CancelablePromise<Array<[value: string, tail: string]>>>();
expectTypeOf(pEventMultiple(gridTyped, 'data', {count: 1, multiArgs: true, rejectionMultiArgs: true})).toBe<CancelablePromise<Array<[value: string, tail: string]>>>();
expectTypeOf(pEventMultiple(gridTyped, 'data', {count: 1, rejectionEvents: ['error']})).toBe<CancelablePromise<string[]>>();
expectTypeOf(pEventMultiple(gridTyped, 'data', {count: 1, filter: () => true})).toBe<CancelablePromise<string[]>>();

expectTypeOf(pEventIterator(gridTyped, 'data')).toBe<AsyncIterableIterator<string>>();
expectTypeOf(pEventIterator(gridTyped, 'data', {multiArgs: true})).toBe<AsyncIterableIterator<[value: string, tail: string]>>();
expectTypeOf(pEventIterator(gridTyped, 'data', {limit: 1, multiArgs: true})).toBe<AsyncIterableIterator<[value: string, tail: string]>>();
expectTypeOf(pEventIterator(gridTyped, 'data', {multiArgs: true, rejectionMultiArgs: true})).toBe<AsyncIterableIterator<[value: string, tail: string]>>();
expectTypeOf(pEventIterator(gridTyped, 'data', {rejectionEvents: ['error']})).toBe<AsyncIterableIterator<string>>();
expectTypeOf(pEventIterator(new Dom(), 'done', () => true)).toBe<AsyncIterableIterator<Event>>();

expectTypeOf(pEventMultiple(rl, 'line', {count: 1, multiArgs: true})).toBe<CancelablePromise<Array<[string]>>>();
expectTypeOf(pEventIterator(rl, 'line', {limit: 1, multiArgs: true})).toBe<AsyncIterableIterator<[string]>>();
