import process from 'node:process';
import {EventEmitter} from 'node:events';
import type * as readline from 'node:readline';
import fs from 'node:fs';
import {expectType} from 'tsd';
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

expectType<CancelablePromise<number[]>>(pEventMultiple(new NodeEmitter(), 'hello', {count: Number.POSITIVE_INFINITY}));
expectType<CancelablePromise<number[]>>(pEventMultiple(new NodeEmitter(), 'hello', {
	resolveImmediately: true,
	count: Number.POSITIVE_INFINITY,
}));
expectType<CancelablePromise<Array<[number, string]>>>(pEventMultiple(new NodeEmitter(), 'hello', {
	count: Number.POSITIVE_INFINITY,
	multiArgs: true,
}));
void pEventMultiple(new NodeEmitter(), 'finish', {
	count: Number.POSITIVE_INFINITY,
	multiArgs: true,
	filter: ([_, string]: [number, string]) => string === '🦄',
});

expectType<AsyncIterableIterator<number>>(pEventIterator(new NodeEmitter(), 'finish'));
expectType<AsyncIterableIterator<number>>(pEventIterator(new NodeEmitter(), '🦄', value => value > 3));

expectType<AsyncIterableIterator<number>>(pEventIterator(new NodeEmitter(), 'finish', {limit: 1}));
expectType<AsyncIterableIterator<number>>(pEventIterator(new NodeEmitter(), 'finish', {resolutionEvents: ['finish']}));
expectType<AsyncIterableIterator<[number, string]>>(pEventIterator(new NodeEmitter(), 'finish', {multiArgs: true}));
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
expectType<CancelablePromise<string>>(pEvent(rl, 'line', line => line.startsWith('>')));

// PEventMultiple with readline
expectType<CancelablePromise<string[]>>(pEventMultiple(rl, 'line', {count: 5}));
expectType<CancelablePromise<Array<[string]>>>(pEventMultiple(rl, 'line', {count: 5, multiArgs: true}));

// PEventIterator with readline
expectType<AsyncIterableIterator<string>>(pEventIterator(rl, 'line'));
expectType<AsyncIterableIterator<[string]>>(pEventIterator(rl, 'line', {multiArgs: true}));
expectType<AsyncIterableIterator<string>>(pEventIterator(rl, 'line', line => line.length > 0));
