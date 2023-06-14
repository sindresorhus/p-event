import EventEmitter from 'node:events';
import test from 'ava';
import delay from 'delay';
import {pEvent, pEventMultiple, pEventIterator} from './index.js';

test('event to promise', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈');
	})();

	t.is(await pEvent(emitter, '🦄'), '🌈');
});

test('event to promise with multiple event names', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(100);
		emitter.emit('🦄', '🌈');
	})();

	t.is(await pEvent(emitter, ['🦄', '🌈']), '🌈');

	(async () => {
		await delay(100);
		emitter.emit('🌈', '🦄');
	})();

	t.is(await pEvent(emitter, ['🦄', '🌈']), '🦄');
});

test('error event rejects the promise', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', new Error('💩'));
	})();

	await t.throwsAsync(pEvent(emitter, '🦄'), {message: '💩'});
});

test('`rejectionEvents` option', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('bar', new Error('💩'));
	})();

	await t.throwsAsync(pEvent(emitter, '🦄', {
		rejectionEvents: ['foo', 'bar'],
	}), {
		message: '💩',
	});
});

test('`multiArgs` option on resolve', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈', '🌈');
	})();

	t.deepEqual(await pEvent(emitter, '🦄', {
		multiArgs: true,
	}), ['🌈', '🌈']);
});

test('`multiArgs` option on reject', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', '💩', '💩');
	})();

	t.deepEqual(await pEvent(emitter, 'error', {
		multiArgs: true,
	}), ['💩', '💩']);
});

test('`.cancel()` method', t => {
	const emitter = new EventEmitter();
	const promise = pEvent(emitter, '🦄');
	t.is(emitter.listenerCount('🦄'), 1);
	promise.cancel();
	t.is(emitter.listenerCount('🦄'), 0);
});

test('`.cancel()` method with `timeout` option', t => {
	const emitter = new EventEmitter();
	const promise = pEvent(emitter, '🦄', {timeout: 250});
	t.is(emitter.listenerCount('🦄'), 1);
	promise.cancel();
	t.is(emitter.listenerCount('🦄'), 0);
});

test('error on incompatible emitter', async t => {
	await t.throwsAsync(pEvent({}, '🦄'), {
		message: /not compatible/,
	});
});

test('works with DOM events', async t => {
	const emitter = new EventEmitter();
	emitter.addEvenListener = emitter.addListener;
	emitter.removeEvenListener = emitter.removeListener;
	delete emitter.on;
	delete emitter.addListener;
	delete emitter.removeListener;

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈');
	})();

	t.is(await pEvent(emitter, '🦄'), '🌈');
});

test('event to promise - error', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', new Error('💩'));
	})();

	t.deepEqual(await pEvent(emitter, 'error'), new Error('💩'));
});

test('`timeout` option rejects when short enough', async t => {
	const emitter = new EventEmitter();
	const timeout = 50;

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈');
	})();

	await t.throwsAsync(pEvent(emitter, '🦄', {
		timeout,
	}), {
		message: `Promise timed out after ${timeout} milliseconds`,
	});

	t.is(emitter.listenerCount('🦄'), 0);
});

test('`timeout` option resolves when long enough', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈');
	})();

	t.is(await pEvent(emitter, '🦄', {
		timeout: 250,
	}), '🌈');
});

test('filter function to match event', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', 1);
		emitter.emit('🦄', 2);
		emitter.emit('🦄', 4);
		emitter.emit('🦄', 3);
	})();

	t.is(await pEvent(emitter, '🦄', x => x >= 3), 4);
});

test('filter option to match event', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', 1);
		emitter.emit('🦄', 2);
		emitter.emit('🦄', 4);
		emitter.emit('🦄', 3);
	})();

	t.is(await pEvent(emitter, '🦄', {
		filter: x => x >= 3,
	}), 4);
});

test('filter option caught with error', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', 1);
		emitter.emit('🦄', 2);
		emitter.emit('error', new Error('💩'));
		emitter.emit('🦄', 4);
		emitter.emit('🦄', 3);
	})();

	await t.throwsAsync(pEvent(emitter, '🦄', {
		filter: x => x >= 3,
	}), {
		message: '💩',
	});
});

test('filter option to match event with `multiArgs`', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', 1, 1);
		emitter.emit('🦄', 2, 2);
		emitter.emit('🦄', 4, 3);
		emitter.emit('🦄', 3, 4);
	})();

	t.deepEqual(await pEvent(emitter, '🦄', {
		filter: x => x[0] >= 3 && x[1] >= x[0],
		multiArgs: true,
	}), [3, 4]);
});

test('filter option returned with `multiArgs`', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', 1, 1);
		emitter.emit('🦄', 2, 2);
		emitter.emit('error', 10_000, '💩');
		emitter.emit('🦄', 4, 3);
		emitter.emit('🦄', 3, 4);
	})();

	t.deepEqual(await pEvent(emitter, 'error', {
		filter: x => (x[0] > 9999) && (x[1] === '💩'),
		multiArgs: true,
	}), [10_000, '💩']);
});

test('AbortSignal rejects when aborted', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈');
	})();

	await t.throwsAsync(pEvent(emitter, '🦄', {signal: AbortSignal.timeout(5)}), {
		message: 'The operation was aborted due to timeout',
	});
	t.is(emitter.listenerCount('🦄'), 0);
});

test('AbortSignal that is already aborted rejects immediately', async t => {
	const emitter = new EventEmitter();
	const controller = new AbortController();
	controller.abort(new Error('reason'));

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈');
	})();

	await t.throwsAsync(pEvent(emitter, '🦄', {signal: controller.signal}), {
		message: 'reason',
	});
	t.is(emitter.listenerCount('🦄'), 0);
});

test('event to AsyncIterator', async t => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄');

	(async () => {
		await delay(50);
		emitter.emit('🦄', '🌈');
	})();

	(async () => {
		await delay(100);
		emitter.emit('🦄', 'Something else.');
	})();

	(async () => {
		await delay(150);
		emitter.emit('🦄', 'Some third thing.');
	})();

	t.deepEqual(await iterator.next(), {done: false, value: '🌈'});
	t.deepEqual(await iterator.next(), {done: false, value: 'Something else.'});
	t.deepEqual(await iterator.next(), {done: false, value: 'Some third thing.'});
});

test('event to AsyncIterator implements return', async t => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄');

	t.true(iterator.return('x') instanceof Promise);
	t.deepEqual(await iterator.return('y'), {done: true, value: 'y'});
	t.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('event to AsyncIterator with multiple event names', async t => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, ['🦄', '🌈']);

	(async () => {
		await delay(50);
		emitter.emit('🦄', '🌈');
	})();

	(async () => {
		await delay(100);
		emitter.emit('🌈', 'Something else.');
	})();

	(async () => {
		await delay(150);
		emitter.emit('🦄', 'Some third thing.');
	})();

	t.deepEqual(await iterator.next(), {done: false, value: '🌈'});
	t.deepEqual(await iterator.next(), {done: false, value: 'Something else.'});
	t.deepEqual(await iterator.next(), {done: false, value: 'Some third thing.'});
});

test('event to AsyncIterator (backpressure)', async t => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄');

	emitter.emit('🦄', '🌈');
	emitter.emit('🦄', 'Something else.');
	emitter.emit('🦄', 'Some third thing.');

	t.deepEqual(await iterator.next(), {done: false, value: '🌈'});
	t.deepEqual(await iterator.next(), {done: false, value: 'Something else.'});
	t.deepEqual(await iterator.next(), {done: false, value: 'Some third thing.'});
});

test('event to AsyncIterator - option limit', async t => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄', {limit: 2});

	(async () => {
		await delay(50);
		emitter.emit('🦄', '🌈');
	})();

	(async () => {
		await delay(100);
		emitter.emit('🦄', 'Something else.');
	})();

	(async () => {
		await delay(150);
		emitter.emit('🦄', 'Some third thing.');
	})();

	t.deepEqual(await iterator.next(), {done: false, value: '🌈'});
	t.deepEqual(await iterator.next(), {done: false, value: 'Something else.'});
	t.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('event to AsyncIterator (backpressure - limit)', async t => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄', {limit: 2});

	emitter.emit('🦄', '🌈');
	emitter.emit('🦄', 'Something else.');
	emitter.emit('🦄', 'Some third thing.');

	t.deepEqual(await iterator.next(), {done: false, value: '🌈'});
	t.deepEqual(await iterator.next(), {done: false, value: 'Something else.'});
	t.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('event to AsyncIterator - option limit = 0', async t => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄', {limit: 0});

	(async () => {
		await delay(50);
		emitter.emit('🦄', '🌈');
	})();

	t.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('`limit` option should be a non-negative integer or Infinity', t => {
	const message = 'The `limit` option should be a non-negative integer or Infinity';

	t.throws(() => {
		pEventIterator(null, null, {limit: 'a'});
	}, {message});

	t.throws(() => {
		pEventIterator(null, null, {limit: -100});
	}, {message});

	t.throws(() => {
		pEventIterator(null, null, {limit: 3.5});
	}, {message});
});

test('error event rejects the next promise and finishes the iterator', async t => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄');

	(async () => {
		await delay(200);
		emitter.emit('error', new Error('💩'));
	})();

	await t.throwsAsync(iterator.next(), {message: '💩'});
	t.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('resolve event resolves pending promises and finishes the iterator', async t => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄', {resolutionEvents: ['end']});

	(async () => {
		await delay(200);
		emitter.emit('end');
	})();

	await t.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('resolve event resolves pending promises and finishes the iterator - when filter is set', async t => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄', {resolutionEvents: ['end'], filter: Boolean});

	(async () => {
		await delay(200);
		emitter.emit('end');
	})();

	await t.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('AsyncIterator - AbortSignal rejects when aborted', async t => {
	const emitter = new EventEmitter();
	const controller = new AbortController();
	const iterator = pEventIterator(emitter, '🦄', {signal: controller.signal});

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈');
		emitter.emit('🦄', 'Something else.');
		await delay(1);
		controller.abort(new Error('reason'));
		emitter.emit('🦄', 'Some third thing.');
	})();

	t.deepEqual(await iterator.next(), {done: false, value: '🌈'});
	t.deepEqual(await iterator.next(), {done: false, value: 'Something else.'});
	await t.throwsAsync(iterator.next(), {message: 'reason'});
	t.is(emitter.listenerCount('🦄'), 0);
});

test('AsyncIterator - AbortSignal that is already aborted rejects immediately', t => {
	const emitter = new EventEmitter();
	const controller = new AbortController();
	controller.abort(new Error('reason'));
	t.throws(() => pEventIterator(emitter, '🦄', {signal: controller.signal}), {message: 'reason'});
	t.is(emitter.listenerCount('🦄'), 0);
});

test('.multiple()', async t => {
	const emitter = new EventEmitter();

	const promise = pEventMultiple(emitter, '🌂', {
		count: 3,
	});

	emitter.emit('🌂', '🌞');
	emitter.emit('🌂', '🌞');
	emitter.emit('🌂', '🌞');
	emitter.emit('🌂', '🌞');

	t.deepEqual(await promise, ['🌞', '🌞', '🌞']);
});

test('.multiple() with an array of event names', async t => {
	const emitter = new EventEmitter();

	const promise = pEventMultiple(emitter, ['🌂', '🌞'], {
		count: 3,
	});

	emitter.emit('🌂', '🌞');
	emitter.emit('🌞', '🌂');
	emitter.emit('🌞', '🌂');
	emitter.emit('🌂', '🌞');

	t.deepEqual(await promise, ['🌞', '🌂', '🌂']);
});

test('.multiple() - `resolveImmediately` option', async t => {
	const emitter = new EventEmitter();

	const promise = pEventMultiple(emitter, '🌂', {
		resolveImmediately: true,
		count: Number.POSITIVE_INFINITY,
	});

	const result = await promise;
	t.deepEqual(result, []);

	emitter.emit('🌂', '🌞');
	emitter.emit('🌂', '🌞');
	emitter.emit('🌂', '🌞');
	emitter.emit('🌂', '🌞');

	t.deepEqual(result, ['🌞', '🌞', '🌞', '🌞']);
});

test('`count` option should be a zero or more', async t => {
	await t.throwsAsync(
		pEventMultiple(null, null, {count: -1}),
		{
			message: 'The `count` option should be at least 0 or more',
		},
	);
});
