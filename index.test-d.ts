import process from 'node:process';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import {expectType} from 'tsd';
import {pEvent, pEventMultiple, pEventIterator, type CancelablePromise} from './index.js';

class NodeEmitter extends EventEmitter {
	on(_event: 'finish', _listener: (number: number, string: string) => void) {
		return this;
	}

	addListener(
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

	off(_event: 'finish', _listener: (number: number, string: string) => void) {
		return this;
	}

	removeListener(
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
expectType<CancelablePromise<number>>(
	pEvent(new NodeEmitter(), '🦄', value => value > 3),
);
expectType<CancelablePromise<Event>>(pEvent(new DomEmitter(), 'finish'));
expectType<CancelablePromise<Event>>(pEvent(document, 'DOMContentLoaded'));

expectType<CancelablePromise<number>>(
	pEvent(new NodeEmitter(), 'finish', {rejectionEvents: ['error']}),
);
expectType<CancelablePromise<number>>(
	pEvent(new NodeEmitter(), 'finish', {timeout: 1}),
);
expectType<CancelablePromise<number>>(
	pEvent(new NodeEmitter(), 'finish', {filter: value => value > 3}),
);
expectType<CancelablePromise<[number, string]>>(
	pEvent(new NodeEmitter(), 'finish', {multiArgs: true}),
);
void pEvent(new NodeEmitter(), 'finish', {
	multiArgs: true,
	filter: ([_, string]: [number, string]) => string === '🦄',
});

pEvent(new NodeEmitter(), 'finish').cancel();

expectType<CancelablePromise<number[]>>(
	pEventMultiple(new NodeEmitter(), 'hello', {count: Number.POSITIVE_INFINITY}),
);
expectType<CancelablePromise<number[]>>(
	pEventMultiple(new NodeEmitter(), 'hello', {
		resolveImmediately: true,
		count: Number.POSITIVE_INFINITY,
	}),
);
expectType<CancelablePromise<Array<[number, string]>>>(
	pEventMultiple(new NodeEmitter(), 'hello', {
		count: Number.POSITIVE_INFINITY,
		multiArgs: true,
	}),
);
void pEventMultiple(new NodeEmitter(), 'finish', {
	count: Number.POSITIVE_INFINITY,
	multiArgs: true,
	filter: ([_, string]: [number, string]) => string === '🦄',
});

expectType<AsyncIterableIterator<number>>(
	pEventIterator(new NodeEmitter(), 'finish'),
);
expectType<AsyncIterableIterator<number>>(
	pEventIterator(new NodeEmitter(), '🦄', value => value > 3),
);

expectType<AsyncIterableIterator<number>>(
	pEventIterator(new NodeEmitter(), 'finish', {limit: 1}),
);
expectType<AsyncIterableIterator<number>>(
	pEventIterator(new NodeEmitter(), 'finish', {resolutionEvents: ['finish']}),
);
expectType<AsyncIterableIterator<[number, string]>>(
	pEventIterator(new NodeEmitter(), 'finish', {multiArgs: true}),
);
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
