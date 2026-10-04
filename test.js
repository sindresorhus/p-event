import EventEmitter from 'node:events';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {setTimeout as delay} from 'node:timers/promises';
import {pEvent, pEventMultiple, pEventIterator} from './index.js';

const remainingListenerCounts = emitter => [
	emitter.listenerCount('data'),
	emitter.listenerCount('end'),
	emitter.listenerCount('error'),
];

test('event to promise', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈');
	})();

	assert.equal(await pEvent(emitter, '🦄'), '🌈');
});

test('event to promise with multiple event names', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(100);
		emitter.emit('🦄', '🌈');
	})();

	assert.equal(await pEvent(emitter, ['🦄', '🌈']), '🌈');

	(async () => {
		await delay(100);
		emitter.emit('🌈', '🦄');
	})();

	assert.equal(await pEvent(emitter, ['🦄', '🌈']), '🦄');
});

test('error event rejects the promise', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', new Error('💩'));
	})();

	await assert.rejects(pEvent(emitter, '🦄'), {message: '💩'});
});

test('`rejectionEvents` option', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('bar', new Error('💩'));
	})();

	await assert.rejects(pEvent(emitter, '🦄', {
		rejectionEvents: ['foo', 'bar'],
	}), {
		message: '💩',
	});
});

test('`multiArgs` option on resolve', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈', '🌈');
	})();

	assert.deepEqual(await pEvent(emitter, '🦄', {
		multiArgs: true,
	}), ['🌈', '🌈']);
});

test('`multiArgs` option on reject', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', '💩', '💩');
	})();

	assert.deepEqual(await pEvent(emitter, 'error', {
		multiArgs: true,
	}), ['💩', '💩']);
});

test('`rejectionMultiArgs` option enabled - pEvent', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', 'arg1', 'arg2', 'arg3');
	})();

	await assert.rejects(pEvent(emitter, '🦄', {
		rejectionMultiArgs: true,
		rejectionEvents: ['error'],
	}), error => {
		assert.deepEqual(error, ['arg1', 'arg2', 'arg3']);
		return true;
	});
});

test('`rejectionMultiArgs` option disabled (default) - pEvent', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', 'arg1', 'arg2', 'arg3');
	})();

	await assert.rejects(pEvent(emitter, '🦄', {
		rejectionMultiArgs: false,
		rejectionEvents: ['error'],
	}), error => {
		assert.equal(error, 'arg1');
		return true;
	});
});

test('`rejectionMultiArgs` option enabled - pEventMultiple', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', 'arg1', 'arg2', 'arg3');
	})();

	await assert.rejects(pEventMultiple(emitter, '🦄', {
		rejectionMultiArgs: true,
		rejectionEvents: ['error'],
		count: 2,
	}), error => {
		assert.deepEqual(error, ['arg1', 'arg2', 'arg3']);
		return true;
	});
});

test('`rejectionMultiArgs` option enabled - pEventIterator', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', 'arg1', 'arg2', 'arg3');
	})();

	const iterator = pEventIterator(emitter, '🦄', {
		rejectionMultiArgs: true,
		rejectionEvents: ['error'],
	});
	const seen = [];

	await assert.rejects((async () => {
		for await (const value of iterator) {
			seen.push(value);
		}
	})(), error => {
		assert.deepEqual(error, ['arg1', 'arg2', 'arg3']);
		return true;
	});
	assert.deepEqual(seen, []);
});

test('`rejectionMultiArgs` default behavior preserves backward compatibility', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', new Error('test error'));
	})();

	await assert.rejects(pEvent(emitter, '🦄', {
		rejectionEvents: ['error'],
	}), {message: 'test error'});
});

test('`.cancel()` method', () => {
	const emitter = new EventEmitter();
	const promise = pEvent(emitter, '🦄');
	assert.equal(emitter.listenerCount('🦄'), 1);
	promise.cancel();
	assert.equal(emitter.listenerCount('🦄'), 0);
});

test('`.cancel()` method with `timeout` option', () => {
	const emitter = new EventEmitter();
	const promise = pEvent(emitter, '🦄', {timeout: 250});
	assert.equal(emitter.listenerCount('🦄'), 1);
	promise.cancel();
	assert.equal(emitter.listenerCount('🦄'), 0);
});

test('`.cancel()` method clears timeout', async () => {
	const emitter = new EventEmitter();
	const promise = pEvent(emitter, '🦄', {timeout: 50});
	promise.cancel();

	// Wait longer than timeout to ensure it doesn't fire
	await delay(100);

	// Getting here without a timeout error is what the test asserts.
	assert.equal(emitter.listenerCount('🦄'), 0);
});

test('error on incompatible emitter', async () => {
	await assert.rejects(pEvent({}, '🦄'), {
		message: /not compatible/v,
	});
});

test('works with DOM events', async () => {
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

	assert.equal(await pEvent(emitter, '🦄'), '🌈');
});

test('event to promise - error', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('error', new Error('💩'));
	})();

	assert.deepEqual(await pEvent(emitter, 'error'), new Error('💩'));
});

test('`timeout` option rejects when short enough', async () => {
	const emitter = new EventEmitter();
	const timeout = 50;

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈');
	})();

	await assert.rejects(pEvent(emitter, '🦄', {
		timeout,
	}), {
		message: `Promise timed out after ${timeout} milliseconds`,
	});

	assert.equal(emitter.listenerCount('🦄'), 0);
});

test('`timeout` option resolves when long enough', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈');
	})();

	assert.equal(await pEvent(emitter, '🦄', {
		timeout: 250,
	}), '🌈');
});

test('filter function to match event', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', 1);
		emitter.emit('🦄', 2);
		emitter.emit('🦄', 4);
		emitter.emit('🦄', 3);
	})();

	assert.equal(await pEvent(emitter, '🦄', x => x >= 3), 4);
});

test('filter option to match event', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', 1);
		emitter.emit('🦄', 2);
		emitter.emit('🦄', 4);
		emitter.emit('🦄', 3);
	})();

	assert.equal(await pEvent(emitter, '🦄', {
		filter: x => x >= 3,
	}), 4);
});

test('filter option caught with error', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', 1);
		emitter.emit('🦄', 2);
		emitter.emit('error', new Error('💩'));
		emitter.emit('🦄', 4);
		emitter.emit('🦄', 3);
	})();

	await assert.rejects(pEvent(emitter, '🦄', {
		filter: x => x >= 3,
	}), {
		message: '💩',
	});
});

test('filter option to match event with `multiArgs`', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', 1, 1);
		emitter.emit('🦄', 2, 2);
		emitter.emit('🦄', 4, 3);
		emitter.emit('🦄', 3, 4);
	})();

	assert.deepEqual(await pEvent(emitter, '🦄', {
		filter: x => x[0] >= 3 && x[1] >= x[0],
		multiArgs: true,
	}), [3, 4]);
});

test('filter option returned with `multiArgs`', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', 1, 1);
		emitter.emit('🦄', 2, 2);
		emitter.emit('error', 10_000, '💩');
		emitter.emit('🦄', 4, 3);
		emitter.emit('🦄', 3, 4);
	})();

	assert.deepEqual(await pEvent(emitter, 'error', {
		filter: x => (x[0] > 9999) && (x[1] === '💩'),
		multiArgs: true,
	}), [10_000, '💩']);
});

test('AbortSignal rejects when aborted', async () => {
	const emitter = new EventEmitter();

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈');
	})();

	await assert.rejects(pEvent(emitter, '🦄', {signal: AbortSignal.timeout(5)}), {
		message: 'The operation was aborted due to timeout',
	});

	assert.equal(emitter.listenerCount('🦄'), 0);
});

test('AbortSignal that is already aborted rejects immediately', async () => {
	const emitter = new EventEmitter();
	const controller = new AbortController();
	controller.abort(new Error('reason'));

	(async () => {
		await delay(200);
		emitter.emit('🦄', '🌈');
	})();

	await assert.rejects(pEvent(emitter, '🦄', {signal: controller.signal}), {
		message: 'reason',
	});
	assert.equal(emitter.listenerCount('🦄'), 0);
});

test('event to AsyncIterator', async () => {
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

	assert.deepEqual(await iterator.next(), {done: false, value: '🌈'});
	assert.deepEqual(await iterator.next(), {done: false, value: 'Something else.'});
	assert.deepEqual(await iterator.next(), {done: false, value: 'Some third thing.'});
});

test('event to AsyncIterator implements return', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄');

	assert.ok(iterator.return('x') instanceof Promise);
	assert.deepEqual(await iterator.return('y'), {done: true, value: 'y'});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('event to AsyncIterator with multiple event names', async () => {
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

	assert.deepEqual(await iterator.next(), {done: false, value: '🌈'});
	assert.deepEqual(await iterator.next(), {done: false, value: 'Something else.'});
	assert.deepEqual(await iterator.next(), {done: false, value: 'Some third thing.'});
});

test('event to AsyncIterator (backpressure)', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄');

	emitter.emit('🦄', '🌈');
	emitter.emit('🦄', 'Something else.');
	emitter.emit('🦄', 'Some third thing.');

	assert.deepEqual(await iterator.next(), {done: false, value: '🌈'});
	assert.deepEqual(await iterator.next(), {done: false, value: 'Something else.'});
	assert.deepEqual(await iterator.next(), {done: false, value: 'Some third thing.'});
});

test('event to AsyncIterator - option limit', async () => {
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

	assert.deepEqual(await iterator.next(), {done: false, value: '🌈'});
	assert.deepEqual(await iterator.next(), {done: false, value: 'Something else.'});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('event to AsyncIterator (backpressure - limit)', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄', {limit: 2});

	emitter.emit('🦄', '🌈');
	emitter.emit('🦄', 'Something else.');
	emitter.emit('🦄', 'Some third thing.');

	assert.deepEqual(await iterator.next(), {done: false, value: '🌈'});
	assert.deepEqual(await iterator.next(), {done: false, value: 'Something else.'});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('event to AsyncIterator - option limit = 0', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄', {limit: 0});

	(async () => {
		await delay(50);
		emitter.emit('🦄', '🌈');
	})();

	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('`limit` option should be a non-negative integer or Infinity', () => {
	const message = 'The `limit` option should be a non-negative integer or Infinity';

	assert.throws(() => {
		pEventIterator(null, null, {limit: 'a'});
	}, {message});

	assert.throws(() => {
		pEventIterator(null, null, {limit: -100});
	}, {message});

	assert.throws(() => {
		pEventIterator(null, null, {limit: 3.5});
	}, {message});
});

test('error event rejects the next promise and finishes the iterator', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄');

	(async () => {
		await delay(200);
		emitter.emit('error', new Error('💩'));
	})();

	await assert.rejects(iterator.next(), {message: '💩'});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('resolve event resolves pending promises and finishes the iterator', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄', {resolutionEvents: ['end']});

	(async () => {
		await delay(200);
		emitter.emit('end');
	})();

	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('resolve event resolves pending promises and finishes the iterator - when filter is set', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, '🦄', {resolutionEvents: ['end'], filter: Boolean});

	(async () => {
		await delay(200);
		emitter.emit('end');
	})();

	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('AsyncIterator - AbortSignal rejects when aborted', async () => {
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

	assert.deepEqual(await iterator.next(), {done: false, value: '🌈'});
	assert.deepEqual(await iterator.next(), {done: false, value: 'Something else.'});
	await assert.rejects(iterator.next(), {message: 'reason'});
	assert.equal(emitter.listenerCount('🦄'), 0);
});

test('AsyncIterator - AbortSignal that is already aborted rejects immediately', () => {
	const emitter = new EventEmitter();
	const controller = new AbortController();
	controller.abort(new Error('reason'));
	assert.throws(() => pEventIterator(emitter, '🦄', {signal: controller.signal}), {message: 'reason'});
	assert.equal(emitter.listenerCount('🦄'), 0);
});

test('.multiple()', async () => {
	const emitter = new EventEmitter();

	const promise = pEventMultiple(emitter, '🌂', {
		count: 3,
	});

	emitter.emit('🌂', '🌞');
	emitter.emit('🌂', '🌞');
	emitter.emit('🌂', '🌞');
	emitter.emit('🌂', '🌞');

	assert.deepEqual(await promise, ['🌞', '🌞', '🌞']);
});

test('.multiple() with an array of event names', async () => {
	const emitter = new EventEmitter();

	const promise = pEventMultiple(emitter, ['🌂', '🌞'], {
		count: 3,
	});

	emitter.emit('🌂', '🌞');
	emitter.emit('🌞', '🌂');
	emitter.emit('🌞', '🌂');
	emitter.emit('🌂', '🌞');

	assert.deepEqual(await promise, ['🌞', '🌂', '🌂']);
});

test('.multiple() - `resolveImmediately` option', async () => {
	const emitter = new EventEmitter();

	const promise = pEventMultiple(emitter, '🌂', {
		resolveImmediately: true,
		count: Infinity,
	});

	const result = await promise;
	assert.deepEqual(result, []);

	emitter.emit('🌂', '🌞');
	emitter.emit('🌂', '🌞');
	emitter.emit('🌂', '🌞');
	emitter.emit('🌂', '🌞');

	assert.deepEqual(result, ['🌞', '🌞', '🌞', '🌞']);
});

test('`count` option should be a zero or more', async () => {
	await assert.rejects(
		pEventMultiple(null, null, {count: -1}),
		{
			message: 'The `count` option should be at least 0 or more',
		},
	);
});

test('async filter function works', async () => {
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

	assert.equal(await pEvent(emitter, 'test', {filter: asyncFilter}), 2);
});

test('async filter function with pEventMultiple', async () => {
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

	assert.deepEqual(result, [15, 20]);
});

test('filter function that throws rejects the promise', async () => {
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

	await assert.rejects(pEvent(emitter, 'test', {filter: buggyFilter}), {
		message: 'Filter error',
	});
});

test('async filter function that throws rejects the promise', async () => {
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

	await assert.rejects(pEvent(emitter, 'test', {filter: asyncFilter}), {
		message: 'Async filter error',
	});
});

// The emitter is created by the test so it can assert on the listener cleanup afterwards.
const rejectPendingNextWithResolutionFilter = async (emitter, asynchronous) => {
	const expected = new Error('Resolution filter failed');

	const filter = () => {
		throw expected;
	};

	const iterator = pEventIterator(emitter, 'data', {
		resolutionEvents: ['end'],
		filter: asynchronous ? async value => filter(value) : filter,
	});
	const first = iterator.next();
	const second = iterator.next();
	let reason;
	const rejection = assert.rejects(first, error => {
		reason = error;
		return error === expected;
	});

	emitter.emit('end');

	await rejection;
	assert.deepEqual(await second, {done: true, value: undefined});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});

	return reason;
};

test('AsyncIterator - sync resolution filter rejects a pending next call', async () => {
	const emitter = new EventEmitter();
	const reason = await rejectPendingNextWithResolutionFilter(emitter, false);

	assert.equal(reason.message, 'Resolution filter failed');
	assert.deepEqual(remainingListenerCounts(emitter), [0, 0, 0]);
});

test('AsyncIterator - async resolution filter rejects a pending next call', async () => {
	const emitter = new EventEmitter();
	const reason = await rejectPendingNextWithResolutionFilter(emitter, true);

	assert.equal(reason.message, 'Resolution filter failed');
	assert.deepEqual(remainingListenerCounts(emitter), [0, 0, 0]);
});

// The emitter is created by the test so it can assert on the listener cleanup afterwards.
const rejectConcurrentResolutionFilterFailures = async (emitter, pendingRead) => {
	const firstError = new Error('First filter failure');
	const secondError = new Error('Second filter failure');
	const iterator = pEventIterator(emitter, 'data', {
		resolutionEvents: ['end'],
		async filter(error) {
			throw error;
		},
	});
	let reason;
	const rejection = pendingRead
		? assert.rejects(iterator.next(), error => {
			reason = error;
			return error === firstError;
		})
		: undefined;

	emitter.emit('end', firstError);
	emitter.emit('end', secondError);
	await Promise.resolve();

	await (pendingRead
		? rejection
		: assert.rejects(iterator.next(), error => {
			reason = error;
			return error === firstError;
		}));

	assert.deepEqual(await iterator.next(), {done: true, value: undefined});

	return reason;
};

test('AsyncIterator - concurrent resolution filter failures with no pending read', async () => {
	const emitter = new EventEmitter();
	const reason = await rejectConcurrentResolutionFilterFailures(emitter, false);

	assert.equal(reason.message, 'First filter failure');
	assert.deepEqual(remainingListenerCounts(emitter), [0, 0, 0]);
});

test('AsyncIterator - concurrent resolution filter failures with a pending read', async () => {
	const emitter = new EventEmitter();
	const reason = await rejectConcurrentResolutionFilterFailures(emitter, true);

	assert.equal(reason.message, 'First filter failure');
	assert.deepEqual(remainingListenerCounts(emitter), [0, 0, 0]);
});

test('AsyncIterator - a pending resolution filter cannot replace a rejection event error', async () => {
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

	await assert.rejects(iterator.next(), error_ => error_ === error);
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});
