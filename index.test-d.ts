import process from 'node:process';
import {EventEmitter} from 'node:events';
import type * as readline from 'node:readline';
import fs from 'node:fs';
import {
	expectType,
	expectError,
} from 'tsd';
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

expectType<CancelablePromise<number>>(pEvent(new NodeEmitter(), 'finish'));
expectType<CancelablePromise<number>>(pEvent(new NodeEmitter(), '🦄', value => value > 3));
expectType<CancelablePromise<Event>>(pEvent(new DomEmitter(), 'finish'));
expectType<CancelablePromise<Event>>(pEvent(document, 'DOMContentLoaded'));

expectType<CancelablePromise<number>>(pEvent(new NodeEmitter(), 'finish', {rejectionEvents: ['error']}));
expectType<CancelablePromise<number>>(pEvent(new NodeEmitter(), 'finish', {timeout: 1}));
expectType<CancelablePromise<number>>(pEvent(new NodeEmitter(), 'finish', {filter: value => value > 3}));
expectType<CancelablePromise<[number, string]>>(pEvent(new NodeEmitter(), 'finish', {multiArgs: true}));
void pEvent(new NodeEmitter(), 'finish', {
	multiArgs: true,
	filter: ([_, string]: [number, string]) => string === '🦄',
});

pEvent(new NodeEmitter(), 'finish').cancel();

expectType<CancelablePromise<number[]>>(pEventMultiple(new NodeEmitter(), 'hello', {count: Infinity}));
expectType<CancelablePromise<number[]>>(pEventMultiple(new NodeEmitter(), 'hello', {
	resolveImmediately: true,
	count: Infinity,
}));
expectType<CancelablePromise<Array<[number, string]>>>(pEventMultiple(new NodeEmitter(), 'hello', {
	count: Infinity,
	multiArgs: true,
}));
void pEventMultiple(new NodeEmitter(), 'finish', {
	count: Infinity,
	multiArgs: true,
	filter: ([_, string]: [number, string]) => string === '🦄',
});

expectType<AsyncIterableIterator<number>>(pEventIterator(new NodeEmitter(), 'finish'));
expectType<AsyncIterableIterator<number>>(pEventIterator(new NodeEmitter(), '🦄', value => value > 3));

expectType<AsyncIterableIterator<number>>(pEventIterator(new NodeEmitter(), 'finish', {limit: 1}));
expectType<AsyncIterableIterator<number>>(pEventIterator(new NodeEmitter(), 'finish', {resolutionEvents: ['finish']}));
expectType<AsyncIterableIterator<[number, string]>>(pEventIterator(new NodeEmitter(), 'finish', {multiArgs: true}));

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
expectType<CancelablePromise<Uint8Array>>(pEvent(typedEmitter, 'data'));
expectType<CancelablePromise<string>>(pEvent(typedEmitter, 'message'));
expectType<CancelablePromise<[string, number]>>(pEvent(typedEmitter, 'message', {multiArgs: true}));
expectType<CancelablePromise<Uint8Array>>(pEvent(typedEmitter, 'data', value => value.length > 0));

// PEventMultiple with TypedEventEmitter
expectType<CancelablePromise<Uint8Array[]>>(pEventMultiple(typedEmitter, 'data', {count: 3}));
expectType<CancelablePromise<Array<[string, number]>>>(pEventMultiple(typedEmitter, 'message', {count: 3, multiArgs: true}));

// PEventIterator with TypedEventEmitter
expectType<AsyncIterableIterator<Uint8Array>>(pEventIterator(typedEmitter, 'data'));
expectType<AsyncIterableIterator<[string, number]>>(pEventIterator(typedEmitter, 'message', {multiArgs: true}));
expectType<AsyncIterableIterator<Uint8Array>>(pEventIterator(typedEmitter, 'data', value => value.length > 0));

// TypedEventEmitter with symbol keys
const symbolEvent = Symbol('myEvent');
type SymbolEvents = {
	[symbolEvent]: [value: number];
};

declare const symbolEmitter: TypedEventEmitter<SymbolEvents>;
expectType<CancelablePromise<number>>(pEvent(symbolEmitter, symbolEvent));

// Readline tests
declare const rl: readline.Interface;

// PEvent with readline
expectType<CancelablePromise<string>>(pEvent(rl, 'line'));
expectType<CancelablePromise<string[]>>(pEvent(rl, 'history'));
expectType<CancelablePromise<[string]>>(pEvent(rl, 'line', {multiArgs: true}));
expectType<CancelablePromise<string>>(pEvent(rl, 'line', line => line.length > 0));

// PEventMultiple with readline
expectType<CancelablePromise<string[]>>(pEventMultiple(rl, 'line', {count: 5}));
expectType<CancelablePromise<Array<[string]>>>(pEventMultiple(rl, 'line', {count: 5, multiArgs: true}));

// PEventIterator with readline
expectType<AsyncIterableIterator<string>>(pEventIterator(rl, 'line'));
expectType<AsyncIterableIterator<[string]>>(pEventIterator(rl, 'line', {multiArgs: true}));
expectType<AsyncIterableIterator<string>>(pEventIterator(rl, 'line', line => line.length > 0));

// Overload resolution for shapes that are easy to get wrong.
declare const looseEmitter: {
	on(event: string, listener: (...arguments_: unknown[]) => void): void;
	off(event: string, listener: (...arguments_: unknown[]) => void): void;
};

expectType<CancelablePromise<unknown>>(pEvent(looseEmitter, 'anything', {}));
expectType<CancelablePromise<unknown>>(pEvent(looseEmitter, 'anything', {multiArgs: false}));
expectType<CancelablePromise<unknown[][]>>(pEventMultiple(looseEmitter, 'anything', {count: 1, multiArgs: true}));
expectType<AsyncIterableIterator<unknown[]>>(pEventIterator(looseEmitter, 'anything', {limit: 1, multiArgs: true}));

// `multiArgs: false` must not select the multi-argument overload.
expectType<CancelablePromise<number>>(pEvent(new NodeEmitter(), 'finish', {multiArgs: false}));

// The returned iterator is a real async iterable, so it can be drained or looped over.
const drain = async () => Array.fromAsync(pEventIterator(new NodeEmitter(), 'finish', {limit: 2}));

expectType<() => Promise<number[]>>(drain);

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
expectType<CancelablePromise<Uint8Array>>(pEvent(typed, 'data'));
expectType<CancelablePromise<Uint8Array>>(pEvent(typed, 'data', {}));
expectType<CancelablePromise<Uint8Array>>(pEvent(typed, 'data', {multiArgs: false}));
expectType<CancelablePromise<Uint8Array>>(pEvent(typed, 'data', {rejectionEvents: ['error']}));
expectType<CancelablePromise<Uint8Array>>(pEvent(typed, 'data', {timeout: 1}));
expectType<CancelablePromise<Uint8Array>>(pEvent(typed, 'data', {signal: AbortSignal.timeout(1)}));
expectType<CancelablePromise<[Uint8Array]>>(pEvent(typed, 'data', {multiArgs: true}));
expectType<CancelablePromise<[Uint8Array]>>(pEvent(typed, 'data', {multiArgs: true, rejectionEvents: ['error']}));
expectType<CancelablePromise<[Uint8Array]>>(pEvent(typed, 'data', {multiArgs: true, rejectionMultiArgs: true}));
expectType<CancelablePromise<[Uint8Array]>>(pEvent(typed, 'data', {multiArgs: true, timeout: 1}));

// An event with no arguments carries nothing, so its first argument is `undefined`.
expectType<CancelablePromise<undefined>>(pEvent(typed, 'silent'));

// An array of names falls back to the loose overload, which is the documented limitation.
expectType<CancelablePromise<unknown>>(pEvent(typed, ['data']));
expectType<CancelablePromise<unknown>>(pEvent(typed, ['data', 'message']));
expectType<CancelablePromise<unknown[]>>(pEvent(typed, ['data', 'message'], {multiArgs: true}));

// The multiple and iterator forms.
expectType<CancelablePromise<Uint8Array[]>>(pEventMultiple(typed, 'data', {count: 1}));
expectType<CancelablePromise<Array<[Uint8Array]>>>(pEventMultiple(typed, 'data', {count: 1, multiArgs: true}));
expectType<AsyncIterableIterator<Uint8Array>>(pEventIterator(typed, 'data'));
expectType<AsyncIterableIterator<Uint8Array>>(pEventIterator(typed, 'data', {limit: 1}));
expectType<AsyncIterableIterator<Uint8Array>>(pEventIterator(typed, 'data', {resolutionEvents: ['message']}));
expectType<AsyncIterableIterator<[Uint8Array]>>(pEventIterator(typed, 'data', {multiArgs: true}));
expectType<AsyncIterableIterator<[Uint8Array]>>(pEventIterator(typed, 'data', {multiArgs: true, limit: 1}));

// The positional filter form.
expectType<CancelablePromise<Uint8Array>>(pEvent(typed, 'data', value => value.length > 0));
expectType<AsyncIterableIterator<Uint8Array>>(pEventIterator(typed, 'data', value => value.length > 0));

// Readline, one name and the array form.
// A `history` event carries one argument that is itself an array, so each item is that array.
expectType<CancelablePromise<string[][]>>(pEventMultiple(rl, 'history', {count: 1}));
expectType<AsyncIterableIterator<string>>(pEventIterator(rl, 'line', {limit: 1}));
expectType<CancelablePromise<unknown>>(pEvent(rl, ['line']));
expectType<CancelablePromise<unknown>>(pEvent(rl, ['line', 'history']));

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

expectType<CancelablePromise<Event>>(pEvent(new Dom(), 'done'));
// With `multiArgs` the value is the whole argument list.
expectType<CancelablePromise<[evt: Event]>>(pEvent(new Dom(), 'done', {multiArgs: true}));
expectType<AsyncIterableIterator<Event>>(pEventIterator(new Dom(), 'done', {limit: 1}));

// A plain Node emitter with no event map.
expectType<CancelablePromise<unknown>>(pEvent(new EventEmitter(), 'anything'));
expectType<CancelablePromise<unknown[]>>(pEvent(new EventEmitter(), 'anything', {multiArgs: true}));

type GridEvents = {
	data: [value: string, tail: string];
};

declare const gridTyped: TypedEventEmitter<GridEvents>;

// The whole option grid, checked against what a run of each shape actually resolved to. With `multiArgs` the definitions keep the argument list as a labelled tuple, which is narrower than a plain array and is what the runtime hands over.
expectType<CancelablePromise<string>>(pEvent(gridTyped, 'data'));
expectType<CancelablePromise<[value: string, tail: string]>>(pEvent(gridTyped, 'data', {multiArgs: true}));
expectType<CancelablePromise<string>>(pEvent(gridTyped, 'data', {rejectionEvents: ['error']}));
expectType<CancelablePromise<string>>(pEvent(gridTyped, 'data', {rejectionMultiArgs: true}));
expectType<CancelablePromise<[value: string, tail: string]>>(pEvent(gridTyped, 'data', {multiArgs: true, rejectionMultiArgs: true}));
expectType<CancelablePromise<[value: string, tail: string]>>(pEvent(gridTyped, 'data', {multiArgs: true, filter: () => true}));
expectType<CancelablePromise<string>>(pEvent(gridTyped, 'data', {filter: () => true}));

expectType<CancelablePromise<string>>(pEvent(gridTyped, 'data', () => true));
expectType<CancelablePromise<Event>>(pEvent(new Dom(), 'done', () => true));

expectType<CancelablePromise<string[]>>(pEventMultiple(gridTyped, 'data', {count: 1}));
expectType<CancelablePromise<Array<[value: string, tail: string]>>>(pEventMultiple(gridTyped, 'data', {count: 1, multiArgs: true}));
expectType<CancelablePromise<Array<[value: string, tail: string]>>>(pEventMultiple(gridTyped, 'data', {count: 1, multiArgs: true, rejectionMultiArgs: true}));
expectType<CancelablePromise<string[]>>(pEventMultiple(gridTyped, 'data', {count: 1, rejectionEvents: ['error']}));
expectType<CancelablePromise<string[]>>(pEventMultiple(gridTyped, 'data', {count: 1, filter: () => true}));

expectType<AsyncIterableIterator<string>>(pEventIterator(gridTyped, 'data'));
expectType<AsyncIterableIterator<[value: string, tail: string]>>(pEventIterator(gridTyped, 'data', {multiArgs: true}));
expectType<AsyncIterableIterator<[value: string, tail: string]>>(pEventIterator(gridTyped, 'data', {limit: 1, multiArgs: true}));
expectType<AsyncIterableIterator<[value: string, tail: string]>>(pEventIterator(gridTyped, 'data', {multiArgs: true, rejectionMultiArgs: true}));
expectType<AsyncIterableIterator<string>>(pEventIterator(gridTyped, 'data', {rejectionEvents: ['error']}));
expectType<AsyncIterableIterator<Event>>(pEventIterator(new Dom(), 'done', () => true));

expectType<CancelablePromise<Array<[string]>>>(pEventMultiple(rl, 'line', {count: 1, multiArgs: true}));
expectType<AsyncIterableIterator<[string]>>(pEventIterator(rl, 'line', {limit: 1, multiArgs: true}));
