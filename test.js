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

test('`rejectionMultiArgs` option enabled - pEvent', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', 'arg1', 'arg2', 'arg3');
	})();

	try {
		await pEvent(emitter, '🦄', {
			rejectionMultiArgs: true,
			rejectionEvents: ['error'],
		});
		t.fail('Should have rejected');
	} catch (error) {
		t.deepEqual(error, ['arg1', 'arg2', 'arg3']);
	}
});

test('`rejectionMultiArgs` option disabled (default) - pEvent', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', 'arg1', 'arg2', 'arg3');
	})();

	try {
		await pEvent(emitter, '🦄', {
			rejectionMultiArgs: false,
			rejectionEvents: ['error'],
		});
		t.fail('Should have rejected');
	} catch (error) {
		t.is(error, 'arg1');
	}
});

test('`rejectionMultiArgs` option enabled - pEventMultiple', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', 'arg1', 'arg2', 'arg3');
	})();

	try {
		await pEventMultiple(emitter, '🦄', {
			rejectionMultiArgs: true,
			rejectionEvents: ['error'],
			count: 2,
		});
		t.fail('Should have rejected');
	} catch (error) {
		t.deepEqual(error, ['arg1', 'arg2', 'arg3']);
	}
});

test('`rejectionMultiArgs` option enabled - pEventIterator', async t => {
	const {pEventIterator} = await import('./index.js');
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', 'arg1', 'arg2', 'arg3');
	})();

	const iterator = pEventIterator(emitter, '🦄', {
		rejectionMultiArgs: true,
		rejectionEvents: ['error'],
	});

	try {
		// eslint-disable-next-line no-unused-vars
		for await (const value of iterator) {
			// Should not reach here
			t.fail('Should have rejected');
		}

		t.fail('Expected rejection');
	} catch (error) {
		t.deepEqual(error, ['arg1', 'arg2', 'arg3']);
	}
});

test('`rejectionMultiArgs` default behavior preserves backward compatibility', async t => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', new Error('test error'));
	})();

	try {
		await pEvent(emitter, '🦄', {
			rejectionEvents: ['error'],
		});
		t.fail('Should have rejected');
	} catch (error) {
		t.is(error.message, 'test error');
	}
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

test('`.cancel()` method clears timeout', async t => {
	const emitter = new EventEmitter();
	const promise = pEvent(emitter, '🦄', {timeout: 50});
	promise.cancel();

	// Wait longer than timeout to ensure it doesn't fire
	await delay(100);

	// If we get here without a timeout error, the test passes
	t.pass('Timeout was properly cleared');
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

	try {
		await pEvent(emitter, '🦄', {signal: AbortSignal.timeout(5)});
		t.fail('Expected rejection');
	} catch (error) {
		t.is(error.message, 'The operation was aborted due to timeout');
	}

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

test('async filter function works', async t => {
	const emitter = new EventEmitter();

	const asyncFilter = async value => {
		await delay(10);
		return value % 2 === 0; // Only even numbers
	};

	(async () => {
		await delay(100);
		emitter.emit('test', 1);
		emitter.emit('test', 2);
		emitter.emit('test', 3);
		emitter.emit('test', 4);
	})();

	t.is(await pEvent(emitter, 'test', {filter: asyncFilter}), 2);
});

test('async filter function with pEventMultiple', async t => {
	const emitter = new EventEmitter();

	const asyncFilter = async value => {
		await delay(5);
		return value > 10;
	};

	(async () => {
		await delay(100);
		emitter.emit('test', 5);
		emitter.emit('test', 15);
		emitter.emit('test', 8);
		emitter.emit('test', 20);
		emitter.emit('test', 25);
	})();

	const result = await pEventMultiple(emitter, 'test', {
		filter: asyncFilter,
		count: 2,
	});

	t.deepEqual(result, [15, 20]);
});

test('filter function that throws rejects the promise', async t => {
	const emitter = new EventEmitter();

	const buggyFilter = value => {
		if (value === 2) {
			throw new Error('Filter error');
		}

		return value > 5;
	};

	(async () => {
		await delay(100);
		emitter.emit('test', 1);
		emitter.emit('test', 2); // This will throw and reject the promise
	})();

	await t.throwsAsync(pEvent(emitter, 'test', {filter: buggyFilter}), {
		message: 'Filter error',
	});
});

test('async filter function that throws rejects the promise', async t => {
	const emitter = new EventEmitter();

	const asyncFilter = async value => {
		await delay(5);
		if (value === 2) {
			throw new Error('Async filter error');
		}

		return value > 5;
	};

	(async () => {
		await delay(100);
		emitter.emit('test', 1);
		emitter.emit('test', 2); // This will throw and reject the promise
	})();

	await t.throwsAsync(pEvent(emitter, 'test', {filter: asyncFilter}), {
		message: 'Async filter error',
	});
});

for (const asynchronous of [false, true]) {
	test(`AsyncIterator - ${asynchronous ? 'async' : 'sync'} resolution filter rejects a pending next call`, async t => {
		const emitter = new EventEmitter();
		const error = new Error('Resolution filter failed');

		const filter = () => {
			throw error;
		};

		const iterator = pEventIterator(emitter, 'data', {
			resolutionEvents: ['end'],
			filter: asynchronous ? async value => filter(value) : filter,
		});
		const first = iterator.next();
		const second = iterator.next();
		const rejection = t.throwsAsync(first, {is: error});

		emitter.emit('end');

		await rejection;
		t.deepEqual(await second, {done: true, value: undefined});
		t.deepEqual(await iterator.next(), {done: true, value: undefined});
		t.is(emitter.listenerCount('data'), 0);
		t.is(emitter.listenerCount('end'), 0);
		t.is(emitter.listenerCount('error'), 0);
	});
}

for (const pendingRead of [false, true]) {
	test(`AsyncIterator - concurrent resolution filter failures with ${pendingRead ? 'a pending read' : 'no pending read'}`, async t => {
		const emitter = new EventEmitter();
		const firstError = new Error('First filter failure');
		const secondError = new Error('Second filter failure');
		const iterator = pEventIterator(emitter, 'data', {
			resolutionEvents: ['end'],
			async filter(error) {
				throw error;
			},
		});
		const rejection = pendingRead ? t.throwsAsync(iterator.next(), {is: firstError}) : undefined;

		emitter.emit('end', firstError);
		emitter.emit('end', secondError);
		await Promise.resolve();

		await (pendingRead ? rejection : t.throwsAsync(iterator.next(), {is: firstError}));

		t.deepEqual(await iterator.next(), {done: true, value: undefined});
		t.is(emitter.listenerCount('data'), 0);
		t.is(emitter.listenerCount('end'), 0);
		t.is(emitter.listenerCount('error'), 0);
	});
}

test('AsyncIterator - a pending resolution filter cannot replace a rejection event error', async t => {
	const emitter = new EventEmitter();
	const error = new Error('Rejection event');
	const iterator = pEventIterator(emitter, 'data', {
		resolutionEvents: ['end'],
		async filter() {
			throw new Error('Late filter failure');
		},
	});

	emitter.emit('end');
	emitter.emit('error', error);
	await Promise.resolve();

	await t.throwsAsync(iterator.next(), {is: error});
	t.deepEqual(await iterator.next(), {done: true, value: undefined});
});
