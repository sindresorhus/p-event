/// <reference types="node"/>

import {expectType} from 'tsd-check';
import pEvent, {multiple, iterator, CancelablePromise} from '.';
import {EventEmitter} from 'events';
import * as fs from 'fs';

class NodeEmitter extends EventEmitter {
	on(event: 'finish', listener: (number: number, string: string) => void) {
		return this;
	}
	addListener(
		event: 'finish',
		listener: (number: number, string: string) => void
	) {
		return this;
	}
	addEventListener(
		event: 'finish',
		listener: (number: number, string: string) => void
	) {
		return this;
	}
	off(event: 'finish', listener: (number: number, string: string) => void) {
		return this;
	}
	removeListener(
		event: 'finish',
		listener: (number: number, string: string) => void
	) {
		return this;
	}
	removeEventListener(
		event: 'finish',
		listener: (number: number, string: string) => void
	) {
		return this;
	}
}

class DomEmitter implements EventTarget {
	addEventListener(
		type: 'foo',
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions
	): void {}

	dispatchEvent(event: Event): boolean {
		return false;
	}

	removeEventListener(
		type: 'foo',
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions
	): void {}
}

expectType<CancelablePromise<number>>(pEvent(new NodeEmitter(), 'finish'));
expectType<CancelablePromise<number>>(
	pEvent(new NodeEmitter(), '🦄', value => value > 3)
);
expectType<CancelablePromise<Event>>(pEvent(new DomEmitter(), 'finish'));
expectType<CancelablePromise<Event>>(pEvent(document, 'DOMContentLoaded'));

expectType<CancelablePromise<number>>(
	pEvent(new NodeEmitter(), 'finish', {rejectionEvents: ['error']})
);
expectType<CancelablePromise<number>>(
	pEvent(new NodeEmitter(), 'finish', {timeout: 1})
);
expectType<CancelablePromise<number>>(
	pEvent(new NodeEmitter(), 'finish', {filter: value => value > 3})
);
expectType<CancelablePromise<(string | number)[]>>(
	pEvent(new NodeEmitter(), 'finish', {multiArgs: true})
);

pEvent(new NodeEmitter(), 'finish').cancel();

expectType<CancelablePromise<number[]>>(
	multiple(new NodeEmitter(), 'hello', {count: Infinity})
);
expectType<CancelablePromise<number[]>>(
	multiple(new NodeEmitter(), 'hello', {
		resolveImmediately: true,
		count: Infinity
	})
);
expectType<CancelablePromise<(string | number)[][]>>(
	multiple(new NodeEmitter(), 'hello', {
		count: Infinity,
		multiArgs: true
	})
);

expectType<AsyncIterableIterator<number>>(
	iterator(new NodeEmitter(), 'finish')
);
expectType<AsyncIterableIterator<number>>(
	iterator(new NodeEmitter(), '🦄', value => value > 3)
);

expectType<AsyncIterableIterator<number>>(
	iterator(new NodeEmitter(), 'finish', {limit: 1})
);
expectType<AsyncIterableIterator<number>>(
	iterator(new NodeEmitter(), 'finish', {resolutionEvents: ['finish']})
);
expectType<AsyncIterableIterator<(string | number)[]>>(
	iterator(new NodeEmitter(), 'finish', {multiArgs: true})
);

async function getOpenReadStream(file: string) {
	const stream = fs.createReadStream(file);
	await pEvent(stream, 'open');
	return stream;
}

const stream = await getOpenReadStream('unicorn.txt');
stream.pipe(process.stdout);

const result = await pEvent(new NodeEmitter(), 'finish');
if (result === 1) {
	throw new Error('Emitter finished with an error');
}
