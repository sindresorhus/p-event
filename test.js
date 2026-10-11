import EventEmitter, {getEventListeners} from 'node:events';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {setTimeout as delay} from 'node:timers/promises';
import {spawnSync} from 'node:child_process';
import process from 'node:process';
import {
	pEvent,
	pEventMultiple,
	pEventIterator,
	TimeoutError,
} from './index.js';

const abortListenerCount = signal => getEventListeners(signal, 'abort').length;

// Turns a settled promise into a value, so several outcomes can be compared with one assertion.
const settledMessage = promise => promise.then(() => 'resolved').catch(error => error.message);

// Counts the calls to `off`, which is the removal method an `EventEmitter` offers, so a test can see how often the listening was stopped.
const countRemovals = emitter => {
	const counter = {removals: 0};
	const nativeOff = emitter.off.bind(emitter);
	emitter.off = (...arguments_) => {
		counter.removals++;
		return nativeOff(...arguments_);
	};

	return counter;
};

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
	let rejection;
	promise.catch(error => {
		rejection = error;
	});

	promise.cancel();

	// Long enough for the deadline to have fired, so a timer that outlived `.cancel()` would show up here.
	await delay(100);

	assert.equal(rejection, undefined);
	assert.deepEqual(emitter.eventNames(), []);
});

test('error on incompatible emitter', async () => {
	await assert.rejects(pEvent({}, '🦄'), {
		message: /not compatible/v,
	});
});

test('works with DOM events', async () => {
	// The names were misspelled, so `addEventListener` was never installed, and `delete` cannot hide the `on` inherited from the prototype. The test never reached the DOM path.
	class CountingEventTarget extends EventTarget {
		listenerCount = 0;

		addEventListener(...arguments_) {
			this.listenerCount++;
			super.addEventListener(...arguments_);
		}

		removeEventListener(...arguments_) {
			this.listenerCount--;
			super.removeEventListener(...arguments_);
		}
	}

	const target = new CountingEventTarget();

	(async () => {
		await delay(100);
		target.dispatchEvent(new Event('🦄'));
	})();

	const event = await pEvent(target, '🦄');
	assert.equal(event.type, '🦄');
	assert.equal(target.listenerCount, 0);
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

test('`count` option should be a whole number', async () => {
	// A fractional or string count can never equal the number of collected items, so the promise would never settle. The `timeout` turns that into a quick failure.
	const messages = await Promise.all([1.5, '2', NaN].map(count => settledMessage(pEventMultiple(new EventEmitter(), 'test', {count, timeout: 50}))));
	assert.deepEqual(messages, Array.from({length: 3}, () => 'The `count` option should be at least 0 or more'));
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
	assert.deepEqual(emitter.eventNames(), []);
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
	const rejection = assert.rejects(first, error => error === expected);

	emitter.emit('end');

	await rejection;
	assert.deepEqual(await second, {done: true, value: undefined});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
};

test('AsyncIterator - sync resolution filter rejects a pending next call', async () => {
	const emitter = new EventEmitter();
	await rejectPendingNextWithResolutionFilter(emitter, false);
	assert.deepEqual(emitter.eventNames(), []);
});

test('AsyncIterator - async resolution filter rejects a pending next call', async () => {
	const emitter = new EventEmitter();
	await rejectPendingNextWithResolutionFilter(emitter, true);
	assert.deepEqual(emitter.eventNames(), []);
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
	const isFirstError = error => error === firstError;
	const pending = pendingRead ? iterator.next() : undefined;

	emitter.emit('end', firstError);
	emitter.emit('end', secondError);
	await Promise.resolve();

	await assert.rejects(pending ?? iterator.next(), isFirstError);
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
};

test('AsyncIterator - concurrent resolution filter failures with no pending read', async () => {
	const emitter = new EventEmitter();
	await rejectConcurrentResolutionFilterFailures(emitter, false);
	assert.deepEqual(emitter.eventNames(), []);
});

test('AsyncIterator - concurrent resolution filter failures with a pending read', async () => {
	const emitter = new EventEmitter();
	await rejectConcurrentResolutionFilterFailures(emitter, true);
	assert.deepEqual(emitter.eventNames(), []);
});

test('AsyncIterator - a pending resolution filter cannot replace a rejection event error', async () => {
	const emitter = new EventEmitter();
	const error = new Error('Rejection event');
	let filterCalls = 0;
	const iterator = pEventIterator(emitter, 'data', {
		resolutionEvents: ['end'],
		async filter() {
			filterCalls++;
			throw new Error('Late filter failure');
		},
	});

	emitter.emit('end');
	emitter.emit('error', error);
	await Promise.resolve();

	await assert.rejects(iterator.next(), error_ => error_ === error);
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
	// The rejection ended the iteration first, so the queued resolution step does not call user code at all.
	assert.equal(filterCalls, 0);
});

test('the resolution event payload reaches the filter as an argument list with `multiArgs`', async () => {
	// The filter is written for the `multiArgs` shape, so handing it a bare first argument would make the destructuring throw and reject the iteration.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {
		resolutionEvents: ['end'],
		multiArgs: true,
		filter: ([value]) => value !== 'skip',
	});

	emitter.emit('data', 'skip');
	emitter.emit('data', 'keep', 'tail');
	emitter.emit('end');

	assert.deepEqual(await Array.fromAsync(iterator), [['keep', 'tail']]);
});

test('`count` option of 0 resolves immediately without a listener', async () => {
	// The validator accepts `count >= 0`, but zero was only compared after an event, so the promise never settled and the listener leaked.
	const emitter = new EventEmitter();
	const promise = pEventMultiple(emitter, 'test', {count: 0});

	assert.deepEqual(await promise, []);
	assert.equal(emitter.listenerCount('test'), 0);

	emitter.emit('test', 1);
	assert.equal(emitter.listenerCount('test'), 0);
});

test('`pEventMultiple` stops collecting once cancelled', async () => {
	// A filter that was still pending pushed its value after `.cancel()`, so the result array of a `resolveImmediately` promise kept growing after the caller stopped listening.
	const emitter = new EventEmitter();
	const {promise: gate, resolve: release} = Promise.withResolvers();
	const promise = pEventMultiple(emitter, 'test', {
		count: Infinity,
		resolveImmediately: true,
		async filter() {
			await gate;
			return true;
		},
	});

	assert.deepEqual(await promise, []);

	// The filter is already running by the time the caller cancels, so its result arrives too late to be wanted.
	emitter.emit('test', 'dropped');
	await delay(0);
	promise.cancel();
	emitter.emit('test', 'dropped too');
	release();

	await delay(0);
	assert.deepEqual(await promise, []);
});

test('a filter that throws after `.cancel()` does not settle the promise', async () => {
	// `.cancel()` is documented to leave the promise unsettled, so a filter that was still running must not reject it afterwards.
	const emitter = new EventEmitter();
	const {promise: gate, resolve: release} = Promise.withResolvers();
	const promise = pEvent(emitter, 'test', async () => {
		await gate;
		throw new Error('late filter failure');
	});
	let outcome = 'unsettled';
	promise.then(() => {
		outcome = 'resolved';
	}).catch(() => {
		outcome = 'rejected';
	});

	emitter.emit('test', 1);
	// The filter has to be running when the caller cancels.
	await delay(0);
	promise.cancel();
	release();
	await delay(0);

	assert.equal(outcome, 'unsettled');
});

test('`pEventMultiple` keeps emission order with an async filter', async () => {
	// Each event ran its own filter concurrently, so the results were ordered by filter duration rather than by emission.
	const emitter = new EventEmitter();
	const promise = pEventMultiple(emitter, 'test', {
		count: 3,
		async filter(value) {
			await delay(value === 1 ? 30 : (value === 2 ? 20 : 10));
			return true;
		},
	});

	emitter.emit('test', 1);
	emitter.emit('test', 2);
	emitter.emit('test', 3);

	assert.deepEqual(await promise, [1, 2, 3]);
});

test('a repeated event name counts a single emission once', async () => {
	// The same listener was registered once per occurrence, so one emission pushed the value twice and `count` was reached by a single emission.
	const emitter = new EventEmitter();
	const promise = pEventMultiple(emitter, ['test', 'test'], {count: 2});

	assert.equal(emitter.listenerCount('test'), 1);

	emitter.emit('test', 'once');
	emitter.emit('test', 'twice');

	assert.deepEqual(await promise, ['once', 'twice']);
});

test('a repeated event name reaches the iterator once', async () => {
	// The handler ran twice per emission, so `limit` was reached after half the expected events.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, ['test', 'test'], {limit: 2});

	assert.equal(emitter.listenerCount('test'), 1);

	emitter.emit('test', 'once');
	assert.deepEqual(await iterator.next(), {done: false, value: 'once'});

	emitter.emit('test', 'twice');
	assert.deepEqual(await iterator.next(), {done: false, value: 'twice'});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('a repeated rejection event registers one listener', () => {
	const emitter = new EventEmitter();
	const promise = pEventMultiple(emitter, 'test', {
		count: 1,
		rejectionEvents: ['error', 'error'],
	});

	assert.equal(emitter.listenerCount('error'), 1);
	promise.cancel();
	assert.equal(emitter.listenerCount('error'), 0);
});

test('the iterator treats the main event as a value, not a rejection', async () => {
	// The rejection handler was registered even though the main event had priority, so the emission also armed a pending rejection.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'error');

	emitter.emit('error', 'boom');
	assert.deepEqual(await iterator.next(), {done: false, value: 'boom'});

	const pending = iterator.next();
	emitter.emit('error', 'again');
	assert.deepEqual(await pending, {done: false, value: 'again'});
});

test('the iterator does not end on a resolution event that is also the main event', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {resolutionEvents: ['data']});

	emitter.emit('data', 'one');
	assert.deepEqual(await iterator.next(), {done: false, value: 'one'});

	const pending = iterator.next();
	emitter.emit('data', 'two');
	assert.deepEqual(await pending, {done: false, value: 'two'});
});

test('the iterator registers one handler for an event listed as both resolution and rejection', async () => {
	// Both handlers used to be registered. Only the listener count shows that, because `EventEmitter` runs them in registration order and the rejection one comes first.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {
		resolutionEvents: ['end'],
		rejectionEvents: ['end'],
	});

	assert.equal(emitter.listenerCount('end'), 1);

	const pending = iterator.next();
	emitter.emit('end', new Error('boom'));

	await assert.rejects(pending, {message: 'boom'});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('the iterator returns the resolution event payload as its final value', async () => {
	// Like the return value of a generator, the payload comes with the first `{done: true}` result only, after every buffered value, and later reads get `undefined`.
	const emitter = new EventEmitter();

	const withPendingReads = pEventIterator(emitter, 'data', {resolutionEvents: ['end']});
	const reads = [withPendingReads.next(), withPendingReads.next()];
	emitter.emit('end', 'finished');
	assert.deepEqual(await Promise.all(reads), [{done: true, value: 'finished'}, {done: true, value: undefined}]);

	const withBufferedValue = pEventIterator(emitter, 'data', {resolutionEvents: ['end']});
	emitter.emit('data', 'value');
	emitter.emit('end', 'finished');
	// Lets the resolution step run first, so the payload is already waiting when the buffered value is read.
	await Promise.resolve();
	assert.deepEqual([await withBufferedValue.next(), await withBufferedValue.next(), await withBufferedValue.next()], [
		{done: false, value: 'value'},
		{done: true, value: 'finished'},
		{done: true, value: undefined},
	]);

	assert.deepEqual(emitter.eventNames(), []);
});

test('the iterator returns the resolution event payload with `multiArgs`', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {resolutionEvents: ['end'], multiArgs: true});

	emitter.emit('end', 'a', 'b');

	assert.deepEqual(await iterator.next(), {done: true, value: ['a', 'b']});
});

test('the iterator does not return a resolution event payload that the filter drops', async () => {
	// The event still ends the iteration, but the filter decides whether its payload is handed over.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {
		resolutionEvents: ['end'],
		filter: value => value !== 'dropped',
	});

	emitter.emit('end', 'dropped');

	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
	assert.deepEqual(emitter.eventNames(), []);
});

test('a resolution event payload is dropped when the iteration ends while its filter runs', async () => {
	// The filter is still deciding about the payload when something else ends the iteration, so its verdict comes too late to hand the payload over.
	const endWhileFiltering = async end => {
		const emitter = new EventEmitter();
		const controller = new AbortController();
		const {promise: gate, resolve: release} = Promise.withResolvers();
		const iterator = pEventIterator(emitter, 'data', {
			resolutionEvents: ['end'],
			signal: controller.signal,
			async filter() {
				await gate;
				return true;
			},
		});

		emitter.emit('end', 'payload');
		await delay(0);
		const firstRead = await end({emitter, controller, iterator});
		release();
		await delay(0);

		return [firstRead, await iterator.next()];
	};

	const outcomes = await Promise.all([
		endWhileFiltering(({iterator}) => iterator.return('stopped')),
		endWhileFiltering(({emitter, iterator}) => {
			emitter.emit('error', new Error('boom'));
			return settledMessage(iterator.next());
		}),
		endWhileFiltering(({controller, iterator}) => {
			controller.abort(new Error('aborted'));
			return settledMessage(iterator.next());
		}),
	]);

	const done = {done: true, value: undefined};
	assert.deepEqual(outcomes, [[{done: true, value: 'stopped'}, done], ['boom', done], ['aborted', done]]);
});

test('`return()` discards a resolution event payload that was not read yet', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {resolutionEvents: ['end']});

	emitter.emit('end', 'finished');
	await Promise.resolve();

	assert.deepEqual(await iterator.return('stopped'), {done: true, value: 'stopped'});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('`timeout` stops listening when the promise resolved immediately', async () => {
	// The promise was already fulfilled, so `pTimeout` cleared its timer before it fired and the listener stayed attached forever.
	const emitter = new EventEmitter();
	const promise = pEventMultiple(emitter, 'test', {
		count: Infinity,
		resolveImmediately: true,
		timeout: 30,
	});

	assert.deepEqual(await promise, []);
	assert.equal(emitter.listenerCount('test'), 1);

	await delay(60);
	assert.equal(emitter.listenerCount('test'), 0);

	emitter.emit('test', 'ignored');
	assert.deepEqual(await promise, []);
});

test('`.cancel()` clears the `resolveImmediately` timeout', async () => {
	const emitter = new EventEmitter();
	const counter = countRemovals(emitter);

	const promise = pEventMultiple(emitter, 'test', {
		count: Infinity,
		resolveImmediately: true,
		timeout: 30,
	});

	promise.cancel();
	assert.equal(counter.removals, 2);

	// The deadline is gone too, so it cannot cancel a second time.
	await delay(60);
	assert.equal(counter.removals, 2);
	assert.equal(emitter.listenerCount('test'), 0);
});

test('`.cancel()` is callable on a promise that failed to start', async () => {
	// The setup threw before `cancel` was assigned, so the documented `.cancel()` was `undefined` and calling it crashed the caller.
	const countPromise = pEventMultiple(new EventEmitter(), 'test', {count: -1});
	assert.equal(typeof countPromise.cancel, 'function');
	await assert.rejects(countPromise, {message: /count/v});
	countPromise.cancel();

	const controller = new AbortController();
	controller.abort(new Error('already aborted'));
	const abortedPromise = pEvent(new EventEmitter(), 'test', {signal: controller.signal});
	assert.equal(typeof abortedPromise.cancel, 'function');
	await assert.rejects(abortedPromise, {message: 'already aborted'});
	abortedPromise.cancel();

	// With a `timeout` the promise is wrapped by `p-timeout`, and the wrapper gets its own `.cancel()`.
	const incompatible = await Promise.all([{count: 1}, {count: 1, timeout: 100}].map(async options => {
		const promise = pEventMultiple({}, 'test', options);
		const cancelType = typeof promise.cancel;
		const message = await settledMessage(promise);
		promise.cancel();
		return [cancelType, message];
	}));
	assert.deepEqual(incompatible, [['function', 'Emitter is not compatible'], ['function', 'Emitter is not compatible']]);
});

test('`count` of zero still rejects an incompatible emitter', async () => {
	// The zero-count shortcut returned before the emitter was looked at, so a bad emitter passed silently.
	await assert.rejects(pEventMultiple({}, 'test', {count: 0}), {
		message: /not compatible/v,
	});
});

test('a `limit` of zero iterator still has `return`', async () => {
	// The shortcut only defined `next`, so the same consumer that calls `return()` on any other iterator crashed on this one.
	// Nothing is attached, so a custom emitter is not asked to remove anything either.
	const calls = [];
	const emitter = {
		on(name) {
			calls.push(['on', name]);
		},
		off(name) {
			calls.push(['off', name]);
		},
	};
	const iterator = pEventIterator(emitter, 'test', {limit: 0});

	assert.deepEqual(await iterator.return('stopped'), {done: true, value: 'stopped'});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
	assert.deepEqual(calls, []);
});

test('`limit` of zero still rejects an incompatible emitter', () => {
	assert.throws(() => pEventIterator({}, 'test', {limit: 0}), {
		message: /not compatible/v,
	});
});

test('the iterator keeps emission order with an async filter', async () => {
	// Each event ran its own filter concurrently, so the values came out ordered by filter duration.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'test', {
		async filter(value) {
			await delay(value === 1 ? 30 : 5);
			return true;
		},
	});

	emitter.emit('test', 1);
	emitter.emit('test', 2);

	assert.deepEqual(await iterator.next(), {done: false, value: 1});
	assert.deepEqual(await iterator.next(), {done: false, value: 2});
});

test('the iterator reaches `limit` with an async filter', async () => {
	// `isLimitReached` was read after the filter settled, so whichever event settled first cancelled the iteration and the other value was lost.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'test', {
		limit: 2,
		async filter(value) {
			await delay(value === 1 ? 30 : 5);
			return true;
		},
	});

	emitter.emit('test', 1);
	emitter.emit('test', 2);

	assert.deepEqual(await iterator.next(), {done: false, value: 1});
	assert.deepEqual(await iterator.next(), {done: false, value: 2});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('the iterator drops a value whose filter settles after it ended', async () => {
	// The filter was still running when the iterator ended, and its value was queued afterwards, so `next()` handed it back on a finished iterator.
	const emitter = new EventEmitter();
	const {promise: gate, resolve: release} = Promise.withResolvers();
	const iterator = pEventIterator(emitter, 'data', {
		async filter() {
			await gate;
			return true;
		},
	});

	emitter.emit('data', 'late');
	// The rejection has to land while the filter is running, so the value is handed over after the iteration has already ended.
	await delay(0);
	emitter.emit('error', new Error('boom'));

	await assert.rejects(iterator.next(), {message: 'boom'});

	release();
	await delay(0);
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('the iterator is done after `return()` even with values still queued', async () => {
	// `return()` only detached the listeners, so `next()` kept handing out queued values and the pending rejection afterwards.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data');

	emitter.emit('data', 'a');
	emitter.emit('data', 'b');
	emitter.emit('error', new Error('boom'));

	assert.deepEqual(await iterator.return('stopped'), {done: true, value: 'stopped'});
	assert.deepEqual([await iterator.next(), await iterator.next()], [
		{done: true, value: undefined},
		{done: true, value: undefined},
	]);
});

test('an abort reason is not wrapped by `rejectionMultiArgs`', async () => {
	// The abort reused the rejection handler, so `rejectionMultiArgs` turned the reason into a one element array.
	const reason = new Error('stop');
	const controller = new AbortController();
	const promise = pEvent(new EventEmitter(), 'test', {
		signal: controller.signal,
		rejectionMultiArgs: true,
	});

	setTimeout(() => {
		controller.abort(reason);
	}, 5);

	await assert.rejects(promise, error => error === reason);
});

test('an abort reason is not wrapped for the iterator either', async () => {
	const reason = new Error('stop');
	const controller = new AbortController();
	const iterator = pEventIterator(new EventEmitter(), 'test', {
		signal: controller.signal,
		rejectionMultiArgs: true,
	});

	setTimeout(() => {
		controller.abort(reason);
	}, 5);

	await assert.rejects(iterator.next(), error => error === reason);
});

test('the listener is removed with the same family it was added with', () => {
	// The two lookups were independent, so `addEventListener` could add a listener that `off` was then asked to remove, leaving it attached.
	const calls = [];
	const hybrid = {
		addEventListener(name, listener) {
			calls.push(['addEventListener', name, listener]);
		},
		on(name, listener) {
			calls.push(['on', name, listener]);
		},
		off(name, listener) {
			calls.push(['off', name, listener]);
		},
	};

	pEvent(hybrid, 'test').cancel();

	const mainEventCalls = calls.filter(([, name]) => name === 'test');
	assert.deepEqual(mainEventCalls.map(([method]) => method), ['on', 'off']);
});

test('the DOM method pair wins when the emitter has all three families', () => {
	const calls = [];
	const hybrid = {
		addEventListener(name, listener) {
			calls.push(['addEventListener', name, listener]);
		},
		removeEventListener(name, listener) {
			calls.push(['removeEventListener', name, listener]);
		},
		// The Node pair throws, so the test fails if it is used instead of the DOM pair.
		on() {
			throw new Error('The DOM pair should have been preferred');
		},
		off() {
			throw new Error('The DOM pair should have been preferred');
		},
	};

	pEvent(hybrid, 'test').cancel();

	const mainEventCalls = calls.filter(([, name]) => name === 'test');
	assert.deepEqual(mainEventCalls.map(([method]) => method), ['addEventListener', 'removeEventListener']);
});

test('the iterator rejects even when values are still queued', async () => {
	// The queue was drained before the pending error was checked, and the last value ended the iteration, so the rejection was never reached and the error vanished entirely.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data');
	const seen = [];

	const consuming = (async () => {
		for await (const value of iterator) {
			seen.push(value);
		}
	})();

	emitter.emit('data', 'a');
	emitter.emit('data', 'b');
	emitter.emit('data', 'c');
	emitter.emit('error', new Error('stream failed'));

	// Every queued value is still delivered, and the rejection follows it.
	await assert.rejects(consuming, {message: 'stream failed'});
	assert.deepEqual(seen, ['a', 'b', 'c']);
});

test('the iterator applies its `filter`', async () => {
	// The positional form was normalized into `options.filter` and then never read, so every event was yielded.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {filter: value => value > 3, limit: 2});
	const consuming = Array.fromAsync(iterator);

	// Emitted one at a time, so the consumer is waiting for each rather than queueing them all.
	const values = [1, 5, 9];
	for (const value of values) {
		// eslint-disable-next-line no-await-in-loop -- the events must be spaced in time.
		await delay(20);
		emitter.emit('data', value);
	}

	// `limit` counts emitted events, so two of the three are seen and only the passing ones are yielded.
	assert.deepEqual(await consuming, [5]);
});

test('the iterator applies a positional `filter`', async () => {
	// The positional form is documented for this entry point too, and it normalises into `options.filter`, so the two forms have to reach the same code. Only the options form was covered, so removing that normalisation broke nothing.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', value => value > 3);
	const consuming = Array.fromAsync(iterator);

	// Spaced out, so the consumer is waiting for each event rather than queueing them all.
	for (const value of [1, 5, 9, 4]) {
		// eslint-disable-next-line no-await-in-loop -- the events must be spaced in time.
		await delay(20);
		emitter.emit('data', value);
	}

	await iterator.return();
	assert.deepEqual(await consuming, [5, 9]);
	assert.deepEqual(emitter.eventNames(), []);
});

test('a throwing `filter` rejects a pending iterator read', async () => {
	// `cancel()` ran before the rejection, so `rejectIterator()` saw a finished iterator and dropped the error.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {
		filter() {
			throw new Error('filter exploded');
		},
	});
	const seen = [];

	const consuming = (async () => {
		for await (const value of iterator) {
			seen.push(value);
		}
	})();

	emitter.emit('data', 1);

	await assert.rejects(consuming, {message: 'filter exploded'});
	assert.deepEqual(seen, []);
});

test('a `filter` that rejects after the iteration ended does not replace the real error', async () => {
	// The neighbouring tests all let the filter succeed once the iteration is over, which only reaches the guard in `acceptValue`. A filter that fails instead lands in `rejectIterator`, and that guard is what stops the late failure from overwriting the rejection event that already ended the iteration with a real reason.
	const emitter = new EventEmitter();
	const {promise: gate, resolve: release} = Promise.withResolvers();

	const iterator = pEventIterator(emitter, 'data', {
		async filter() {
			await gate;
			throw new Error('late filter failure');
		},
	});

	emitter.emit('data', 1);
	// The filter has to be waiting on the gate before the error ends the iteration.
	await delay(0);
	emitter.emit('error', new Error('boom'));
	release();
	await delay(0);
	await delay(0);

	await assert.rejects(iterator.next(), {message: 'boom'});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('the iterator ends when the `limit` event is filtered out', async () => {
	// `isLimitReached` was thrown away with the rejected value, so the limit was never acted on.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {filter: value => value > 10, limit: 2});
	const consuming = Array.fromAsync(iterator);

	// The second emit reaches the limit and the filter drops it, so the iterator must still end.
	for (const value of [5, 1, 99]) {
		// eslint-disable-next-line no-await-in-loop -- the events must be spaced in time so each settles on its own.
		await delay(20);
		emitter.emit('data', value);
	}

	assert.deepEqual(await consuming, []);
});

test('an infinite `timeout` does not stop listening for a `resolveImmediately` promise', async () => {
	// Node clamps an infinite delay to 1 millisecond, so the deadline fired at once and froze the array.
	const emitter = new EventEmitter();
	const promise = pEventMultiple(emitter, 'test', {
		count: Infinity,
		resolveImmediately: true,
		timeout: Infinity,
	});

	assert.deepEqual(await promise, []);
	await delay(50);
	assert.equal(emitter.listenerCount('test'), 1);

	emitter.emit('test', 'still listening');
	assert.deepEqual(await promise, ['still listening']);

	promise.cancel();
});

test('a `timeout` that is not a positive number is rejected either way', async () => {
	// `p-timeout` rejects the deadline from inside its own executor, before it subscribes to the promise, so the listeners were already attached by then and nothing ever removed them.
	const emitter = new EventEmitter();
	const cases = [0, -1, NaN].flatMap(timeout => [true, false].map(resolveImmediately => ({timeout, resolveImmediately})));
	const rejections = await Promise.all(cases.map(({timeout, resolveImmediately}) => settledMessage(pEventMultiple(emitter, 'test', {count: 1, resolveImmediately, timeout}))));

	// The same message whichever path it would have taken, since the check now happens in one place.
	assert.deepEqual(rejections, cases.map(({timeout}) => `Expected the \`timeout\` option to be a positive number, got \`${timeout}\``));

	// The promise has already rejected, so the caller has no reason to cancel it.
	assert.deepEqual(emitter.eventNames(), []);
});

test('a rejection event still beats a resolution event in the same burst', async () => {
	// The resolution handler defers its `cancel()` onto the filter queue, so `isDone` is still false when a rejection arrives right after. An error outranks the end of the iteration, and dropping it would lose a real failure. A value in the same position is dropped instead, since it is not part of this iteration.
	const emitter = new EventEmitter();
	const error = new Error('Rejection event');
	const iterator = pEventIterator(emitter, 'data', {resolutionEvents: ['end']});

	const pending = iterator.next();
	emitter.emit('end');
	emitter.emit('error', error);

	await assert.rejects(pending, error_ => error_ === error);
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
	assert.deepEqual(emitter.eventNames(), []);
});

test('the iterator ignores a value emitted after a resolution event', async () => {
	// `resolveHandler` waited for the queued filters before ending the iteration, so a value emitted later in the same burst was still accepted.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {resolutionEvents: ['finish']});

	const consuming = Array.fromAsync(iterator);

	emitter.emit('data', 'before');
	emitter.emit('finish');
	emitter.emit('data', 'after');

	assert.deepEqual(await consuming, ['before']);
});

// An emitter that hands over its buffered events the moment a listener is attached. The promise can settle while the listeners are still being registered, and anything registered after that is never taken off again.
const replayingEmitter = buffered => {
	const attached = [];

	return {
		attached,
		on(name, listener) {
			attached.push({name, listener});

			for (const value of buffered.get(name) ?? []) {
				listener(value);
			}
		},
		off(name, listener) {
			const index = attached.findIndex(entry => entry.name === name && entry.listener === listener);
			if (index !== -1) {
				attached.splice(index, 1);
			}
		},
	};
};

const attachedNames = emitter => emitter.attached.map(entry => entry.name);

test('a call settled during listener attachment still removes its abort listener', async () => {
	// `cancel()` runs while the listeners are being attached, before `abortHandler` exists. Attaching it after that left it on the caller's signal for good, holding a closure for a promise nobody was waiting on.
	const settleFromTheBuffer = [
		(emitter, signal) => pEvent(emitter, 'data', {signal}),
		(emitter, signal) => pEventMultiple(emitter, 'data', {count: 1, signal}),
		(emitter, signal) => pEventIterator(emitter, 'data', {limit: 1, signal}).next(),
	];

	// Each case needs its own signal, and none of them may be left holding a listener.
	const leftovers = await Promise.all(settleFromTheBuffer.map(async settleOne => {
		const controller = new AbortController();
		const emitter = replayingEmitter(new Map([['data', ['buffered']]]));

		await settleOne(emitter, controller.signal);

		return [abortListenerCount(controller.signal), attachedNames(emitter)];
	}));

	assert.deepEqual(leftovers, Array.from({length: settleFromTheBuffer.length}, () => [0, []]));
});

test('an abort while the listeners are being attached still reaches the caller', async () => {
	// The abort handler was attached after the attachment loop, so an emitter that fires the abort itself from `addListener` left the call waiting for an event that would never come.
	const reason = new Error('during attach');
	const attachAndAbort = start => {
		const controller = new AbortController();
		const emitter = {
			on() {
				controller.abort(reason);
			},
			off() {},
		};

		return start(emitter, controller.signal);
	};

	const starts = [
		(emitter, signal) => pEvent(emitter, 'data', {signal}),
		(emitter, signal) => pEventMultiple(emitter, 'data', {count: 1, signal}),
		(emitter, signal) => pEventIterator(emitter, 'data', {limit: 1, signal}).next(),
	];
	const outcomes = await Promise.all(starts.map(start => settledMessage(attachAndAbort(start))));

	assert.deepEqual(outcomes, ['during attach', 'during attach', 'during attach']);
});

test('an abort from `newListener` does not leave the listener being attached behind', async () => {
	// Node's `EventEmitter` emits `newListener` before it stores the listener, so an abort from there ran the cleanup first, and the listener was stored after it and never removed.
	const starts = [
		(emitter, signal) => pEvent(emitter, 'data', {signal}),
		(emitter, signal) => pEventMultiple(emitter, 'data', {count: 1, signal}),
		(emitter, signal) => pEventIterator(emitter, 'data', {limit: 1, signal}).next(),
	];
	const own = () => {};

	const leftovers = await Promise.all(starts.flatMap(start => ['data', 'error'].map(async abortOn => {
		const controller = new AbortController();
		const emitter = new EventEmitter();
		emitter.on('data', own);
		emitter.on('error', own);
		emitter.on('newListener', eventName => {
			if (eventName === abortOn) {
				controller.abort(new Error('during newListener'));
			}
		});

		const outcome = await settledMessage(start(emitter, controller.signal));

		return [outcome, emitter.listeners('data'), emitter.listeners('error'), abortListenerCount(controller.signal)];
	})));

	assert.deepEqual(leftovers, Array.from({length: starts.length * 2}, () => ['during newListener', [own], [own], 0]));
});

test('an explicitly `undefined` option reads as not set', async () => {
	// The caller's options were spread over the defaults, so an explicit `undefined` replaced each documented default instead of being skipped. That is the shape a partial options object has when a field is optional, and `rejectionEvents` ended up as a listener on the literal name `"undefined"` with no `error` listener at all.
	const emitter = new EventEmitter();
	const promise = pEvent(emitter, 'finish', {rejectionEvents: undefined});

	assert.deepEqual(emitter.eventNames(), ['finish', 'error']);

	emitter.emit('error', new Error('boom'));
	await assert.rejects(promise, {message: 'boom'});

	const other = new EventEmitter();
	const iterator = pEventIterator(other, 'data', {resolutionEvents: undefined, rejectionEvents: undefined});

	// The documented default is an empty list, so `end` is not a resolution event here.
	assert.deepEqual(other.eventNames(), ['data', 'error']);
	await iterator.return();
});

test('an explicitly `undefined` `limit` is the documented default', () => {
	// `limit` is optional with a documented default of `Infinity`, so reading it as absent cannot throw.
	const emitter = new EventEmitter();
	pEventIterator(emitter, 'data', {limit: undefined});

	emitter.emit('data', 'a');
	assert.deepEqual(emitter.eventNames(), ['data', 'error']);
});

test('a filter is called without the options object as `this`', async () => {
	// The filter was invoked as a method, so `this` was the options object the library keeps working from.
	const seen = [];
	const emitter = new EventEmitter();
	const promise = pEventMultiple(emitter, 'test', {
		count: 1,
		filter() {
			seen.push(this);
			return true;
		},
	});

	emitter.emit('test', 1);
	assert.deepEqual(await promise, [1]);

	const iterator = pEventIterator(emitter, 'test', {
		limit: 1,
		resolutionEvents: ['end'],
		filter() {
			seen.push(this);
			return true;
		},
	});

	emitter.emit('test', 2);
	assert.deepEqual(await Array.fromAsync(iterator), [2]);

	const ended = pEventIterator(emitter, 'test', {
		resolutionEvents: ['end'],
		filter() {
			seen.push(this);
			return true;
		},
	});

	emitter.emit('end');
	assert.deepEqual(await Array.fromAsync(ended), []);

	// One call each for `pEventMultiple`, an iterator value and an iterator resolution event.
	assert.deepEqual(seen, [undefined, undefined, undefined]);
});

test('the caller\'s options object is never written to', async () => {
	// Writing to a frozen object throws in strict mode, so any write the library makes to the caller's options shows up as a failure.
	const options = Object.freeze({
		rejectionEvents: undefined,
		resolutionEvents: undefined,
		limit: undefined,
		timeout: 1000,
	});
	const emitter = new EventEmitter();

	const single = pEvent(emitter, 'test', options);
	const multiple = pEventMultiple(emitter, 'test', Object.freeze({...options, count: 2}));
	const {timeout: _timeout, ...iteratorOptions} = options;
	const iterator = pEventIterator(emitter, 'test', Object.freeze({...iteratorOptions, limit: 2}));

	emitter.emit('test', 1);
	emitter.emit('test', 2);

	assert.deepEqual(await Promise.all([single, multiple, Array.fromAsync(iterator)]), [1, [1, 2], [1, 2]]);
	assert.deepEqual(emitter.eventNames(), []);
});

test('an unusable emitter always reports that it is not compatible', async () => {
	// Anything the library cannot use has to give the documented message, rather than whatever error comes out of reading a property off it or binding something that is not a function.
	const unusable = [
		undefined,
		null,
		{},
		42,
		'abc',
		{on: 5, off: 5},
		{addEventListener() {}, removeEventListener: 'nope'},
		{addListener() {}, on: 5, off() {}},
	];

	const messages = await Promise.all(unusable.map(emitter => settledMessage(pEvent(emitter, 'data'))));

	assert.deepEqual(messages, Array.from({length: unusable.length}, () => 'Emitter is not compatible'));
});

test('an unusable emitter is rejected the same way by the iterator', () => {
	assert.throws(() => pEventIterator(null, 'data'), {message: 'Emitter is not compatible'});
});

test('a listener attached before the name that settles the promise is removed again', async () => {
	// `other` replays its buffered event while it is being attached, so `data` is already attached by then and `error` is never attached.
	const emitter = replayingEmitter(new Map([['other', ['buffered']]]));
	const promise = pEventMultiple(emitter, ['data', 'other'], {count: 1});

	assert.deepEqual(await promise, ['buffered']);
	assert.deepEqual(attachedNames(emitter), []);
});

test('a caller-owned array of event names is never held on to', () => {
	// The listener map is built once and walked by both the attach and the removal loop, so a later edit to the caller's array cannot make `.cancel()` detach the wrong name and leave the real listener attached.
	const emitter = new EventEmitter();
	const names = ['alpha'];
	const promise = pEvent(emitter, names);

	names[0] = 'beta';
	promise.cancel();

	assert.deepEqual(emitter.eventNames(), []);
});

test('a caller-owned `rejectionEvents` array is never held on to', () => {
	// The same guarantee as the names above, for the rejection events, which are read from the same map.
	const emitter = new EventEmitter();
	const rejectionEvents = ['error'];
	const promise = pEventMultiple(emitter, 'test', {count: 1, rejectionEvents});

	rejectionEvents[0] = 'other';
	promise.cancel();

	assert.deepEqual(emitter.eventNames(), []);
});

// A deadline that nothing can clear only shows up as the process staying alive, so each failure runs in its own process.

test('a call that failed to start arms no deadline', () => {
	const module = new URL('index.js', import.meta.url).href;
	const bodies = [
		'await pEventMultiple({}, \'test\', {count: 1, resolveImmediately: true, timeout: 30_000}).catch(() => {});',
		'await pEventMultiple(new EventEmitter(), \'test\', {count: -1, resolveImmediately: true, timeout: 30_000}).catch(() => {});',
		'await pEventMultiple(new EventEmitter(), \'test\', {count: 1, resolveImmediately: true, timeout: 30_000, signal: AbortSignal.abort(new Error(\'gone\'))}).catch(() => {});',
		// The deadline was gated on a flag the attachment loop had already set, so a call that settled while it was listening armed a timer that nothing could clear.
		'await pEventMultiple({on: (name, listener) => listener(\'buffered\'), off() {}}, \'test\', {count: 1, resolveImmediately: true, timeout: 30_000});',
	];

	const outcomes = bodies.map(body => {
		const script = `
			import {EventEmitter} from 'node:events';
			import {pEventMultiple} from '${module}';
			${body}
		`;

		// A signal here means a timer was still holding the process open, and the exit status shows that the script itself ran.
		const {status, signal} = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {timeout: 10_000});
		return {status, signal};
	});

	assert.deepEqual(outcomes, bodies.map(() => ({status: 0, signal: null})));
});

test('the iterator stops filtering once it has ended', async () => {
	// The queued filter still ran for a value that was waiting when the iteration ended, so user code kept being called for an iteration that was already over.
	const filtered = [];
	const emitter = new EventEmitter();
	const {promise: gate, resolve: release} = Promise.withResolvers();
	const iterator = pEventIterator(emitter, 'data', {
		async filter(value) {
			filtered.push(value);
			await gate;
			return true;
		},
	});

	// The first filter is already running by the time the second value and the error arrive.
	emitter.emit('data', 1);
	await delay(0);
	emitter.emit('data', 2);
	emitter.emit('error', new Error('boom'));

	await assert.rejects(iterator.next(), {message: 'boom'});

	release();
	await delay(0);
	assert.deepEqual(filtered, [1]);
});

test('a spent `resolveImmediately` deadline is not left running', async () => {
	// The deadline was only cleared by the public `.cancel()`, so an internal settle left it running and it cancelled a second time long after everything was done.
	const emitter = new EventEmitter();
	const counter = countRemovals(emitter);

	// A count of zero never listens, so a deadline would have nothing to stop.
	await pEventMultiple(emitter, 'test', {count: 0, resolveImmediately: true, timeout: 30});
	await delay(80);
	assert.equal(counter.removals, 0);

	const promise = pEventMultiple(emitter, 'test', {count: Infinity, resolveImmediately: true, timeout: 30});
	await promise;
	assert.equal(emitter.listenerCount('test'), 1);

	// A rejection event is what stops the listening here, and it takes both listeners off.
	emitter.emit('error', new Error('stop'));
	assert.equal(counter.removals, 2);

	await delay(80);
	assert.equal(counter.removals, 2);
	assert.deepEqual(emitter.eventNames(), []);
});

test('a resolution event waits for a value that is still being filtered', async () => {
	// The value handler queued its filter but the resolution handler awaited its own filter outside that queue, so `end` cancelled the iteration before the value was ever accepted.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {
		resolutionEvents: ['end'],
		async filter(value) {
			await delay(value === undefined ? 0 : 60);
			return true;
		},
	});

	const consuming = Array.fromAsync(iterator);

	emitter.emit('data', 'payload');
	await delay(10);
	emitter.emit('end');

	assert.deepEqual(await consuming, ['payload']);
});

test('the iterator yields values buffered before a resolution event', async () => {
	// Only the limit and a pending rejection forced another read, so a resolution event ended the iteration on the first buffered value and the rest were lost.
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {resolutionEvents: ['end']});

	emitter.emit('data', 'a');
	emitter.emit('data', 'b');
	emitter.emit('end');

	assert.deepEqual(await Array.fromAsync(iterator), ['a', 'b']);
});

test('the readme `resolveImmediately` example behaves as documented', async () => {
	const emitter = new EventEmitter();
	const promise = pEventMultiple(emitter, 'hello', {
		resolveImmediately: true,
		count: Infinity,
	});

	const result = await promise;
	assert.deepEqual(result, []);

	emitter.emit('hello', 'Jack');
	assert.deepEqual(result, ['Jack']);

	emitter.emit('hello', 'Mark');
	assert.deepEqual(result, ['Jack', 'Mark']);

	// Emitting a rejection event stops the listening.
	emitter.emit('error', new Error('😿'));
	emitter.emit('hello', 'John');
	assert.deepEqual(result, ['Jack', 'Mark']);
});

test('`resolveImmediately` with a finite `count` stops collecting at the count', async () => {
	// Every other `resolveImmediately` test uses `count: Infinity`, so the moment the count is reached was never covered. The promise has already resolved by then, so reaching the count still has to stop the collecting and take the listeners off, or the array would keep growing past it for good.
	const collectUpTo = async count => {
		const emitter = new EventEmitter();
		const promise = pEventMultiple(emitter, 'hello', {resolveImmediately: true, count});
		const result = await promise;
		const initial = [...result];

		for (const name of ['Jack', 'Mark', 'John', 'Pete']) {
			emitter.emit('hello', name);
		}

		return [initial, result.length, emitter.eventNames()];
	};

	const counts = [1, 2, 3];
	const collected = await Promise.all(counts.map(count => collectUpTo(count)));

	assert.deepEqual(collected, counts.map(count => [[], count, []]));
});

test('the readme async iteration example behaves as documented', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {resolutionEvents: ['finish']});

	(async () => {
		await delay(30);
		emitter.emit('data', 'one');
		await delay(30);
		emitter.emit('finish');
	})();

	// The readme shows a `for await` loop, and `Array.fromAsync` drives the same async iteration protocol.
	assert.deepEqual(await Array.fromAsync(iterator), ['one']);
});

test('breaking out of a `for await` leaves no listener behind', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data');

	emitter.emit('data', 1);
	emitter.emit('data', 2);

	const seen = [];
	const consuming = (async () => {
		// Breaking out of the loop is the behaviour under test, and `return()` is what the runtime calls for it.
		// eslint-disable-next-line no-unreachable-loop -- The `break` is deliberate.
		for await (const value of iterator) {
			seen.push(value);
			break;
		}
	})();

	await consuming;
	assert.deepEqual(seen, [1]);
	assert.deepEqual(emitter.eventNames(), []);
});

test('every export removes its abort listener once it settles', async () => {
	const settle = [
		(emitter, signal) => {
			const promise = pEvent(emitter, 'finish', {signal});
			emitter.emit('finish', 'value');
			return promise;
		},
		(emitter, signal) => {
			const promise = pEventMultiple(emitter, 'finish', {count: 1, signal});
			emitter.emit('finish', 'value');
			return promise;
		},
		(emitter, signal) => {
			const iterator = pEventIterator(emitter, 'finish', {signal});
			const pending = iterator.next();
			emitter.emit('finish', 'value');
			return pending.then(() => iterator.return());
		},
	];

	// Sequential, so each call settles before the next one registers its listener.
	const settled = [];
	for (const settleOne of settle) {
		const controller = new AbortController();
		const emitter = new EventEmitter();

		// eslint-disable-next-line no-await-in-loop -- The order is the point of the test.
		await settleOne(emitter, controller.signal);

		settled.push([abortListenerCount(controller.signal), emitter.eventNames()]);
	}

	assert.deepEqual(settled, [[0, []], [0, []], [0, []]]);

	// An abort still reaches a pending call.
	const controller = new AbortController();
	const pending = pEvent(new EventEmitter(), 'finish', {signal: controller.signal});
	controller.abort(new Error('stop'));
	await assert.rejects(pending, {message: 'stop'});
	assert.equal(abortListenerCount(controller.signal), 0);
});

test('an emitter with only `addListener` and `removeListener` works', async () => {
	const listeners = new Map();
	const emitter = {
		// An `on` without an `off` cannot remove what it adds, so the complete pair below is the one to use.
		on() {
			throw new Error('The incomplete `on` pair should have been skipped');
		},
		addListener(name, listener) {
			listeners.set(name, listener);
		},
		removeListener(name, listener) {
			if (listeners.get(name) === listener) {
				listeners.delete(name);
			}
		},
	};

	const promise = pEvent(emitter, '🦄');
	assert.deepEqual(listeners.keys().toArray(), ['🦄', 'error']);

	listeners.get('🦄')('🌈');

	assert.equal(await promise, '🌈');
	assert.deepEqual(listeners.keys().toArray(), []);
});

test('symbol event names work for both forms', async () => {
	const first = Symbol('first');
	const second = Symbol('second');
	const emitter = new EventEmitter();
	const promise = pEventMultiple(emitter, [first, second], {count: 2});

	emitter.emit(first, 1);
	emitter.emit(second, 2);

	assert.deepEqual(await promise, [1, 2]);

	const single = pEvent(emitter, first);
	const iterator = pEventIterator(emitter, second, {limit: 1});
	emitter.emit(first, 3);
	emitter.emit(second, 4);

	assert.deepEqual(await Promise.all([single, Array.fromAsync(iterator)]), [3, [4]]);
	assert.deepEqual(emitter.eventNames(), []);
});

test('emissions after `count` is reached are ignored', async () => {
	const emitter = new EventEmitter();
	const promise = pEventMultiple(emitter, 'test', {count: 2});

	emitter.emit('test', 1);
	emitter.emit('test', 2);
	emitter.emit('test', 3);

	assert.deepEqual(await promise, [1, 2]);
});

test('`multiArgs` with `limit` yields every argument of each event', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'test', {limit: 2, multiArgs: true});

	emitter.emit('test', 1, 2);
	emitter.emit('test', 3, 4);

	assert.deepEqual(await iterator.next(), {done: false, value: [1, 2]});
	assert.deepEqual(await iterator.next(), {done: false, value: [3, 4]});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('a listener that the emitter still calls after removing it changes nothing', async () => {
	// Some emitters call a listener that was removed during the same emit, so each handler checks that the call is over instead of relying on the removal.
	const staleEmitter = () => {
		const listeners = new Map();
		return {
			on(name, listener) {
				listeners.set(name, listener);
			},
			off() {},
			emit(name, ...arguments_) {
				listeners.get(name)?.(...arguments_);
			},
		};
	};

	const multipleEmitter = staleEmitter();
	const promise = pEventMultiple(multipleEmitter, 'data', {count: 1});
	multipleEmitter.emit('data', 'first');
	const result = await promise;
	multipleEmitter.emit('data', 'stale');

	const iteratorEmitter = staleEmitter();
	const iterator = pEventIterator(iteratorEmitter, 'data', {limit: 1});
	iteratorEmitter.emit('data', 'first');
	iteratorEmitter.emit('data', 'stale');
	iteratorEmitter.emit('error', new Error('stale'));

	assert.deepEqual(result, ['first']);
	assert.deepEqual([await iterator.next(), await iterator.next()], [
		{done: false, value: 'first'},
		{done: true, value: undefined},
	]);
});

test('cancelling twice is harmless', async () => {
	const emitter = new EventEmitter();
	const promise = pEvent(emitter, 'test');
	promise.cancel();
	promise.cancel();

	assert.deepEqual(emitter.eventNames(), []);

	const iterator = pEventIterator(emitter, 'other');
	assert.deepEqual(await iterator.return(), {done: true, value: undefined});
	assert.deepEqual(await iterator.return('again'), {done: true, value: 'again'});
	assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test('a timeout rejects with a `TimeoutError`', async () => {
	const emitter = new EventEmitter();

	await assert.rejects(pEvent(emitter, 'test', {timeout: 5}), error => {
		assert.ok(error instanceof TimeoutError);
		assert.equal(error.message, 'Promise timed out after 5 milliseconds');
		return true;
	});
});

// Lehmer, so the sequence of rounds is identical on every run and every machine.
const makeRandom = seed => () => {
	seed = (seed * 16_807) % 2_147_483_647;
	return seed / 2_147_483_647;
};

// Most of the bugs in this library were ordering, counting or listener lifetime problems that only show up across a combination of options. Each round picks one combination and checks the result against a model, so a regression cannot hide behind the shapes the other tests happen to use.
const checkRandomRound = async (random, round) => {
	const pick = array => array[Math.floor(random() * array.length)];
	const between = (minimum, maximum) => minimum + Math.floor(random() * (maximum - minimum + 1));

	const kind = pick(['multiple', 'iterator']);
	const target = between(1, 5);
	const hasMultiArgs = random() < 0.4;
	// A repeated name registers the listener twice, which would count one emission twice.
	const names = random() < 0.3 ? ['test', 'test'] : 'test';
	const filterKind = pick(['none', 'sync', 'async']);
	const threshold = between(0, 3);
	// Reported back, so the caller can check that the rounds reached every combination.
	const shape = `${kind} ${filterKind}`;

	const isAcceptedValue = value => filterKind === 'none' || (typeof value === 'number' && value >= threshold);
	const toPayload = value => (hasMultiArgs ? [value, 'tail'] : value);
	const toValue = value => (hasMultiArgs ? value[0] : value);
	const isAcceptedPayload = emitted => isAcceptedValue(toValue(emitted));

	// The asynchronous filter takes a different number of microtask turns per value, so filters that ran concurrently would hand their verdicts back out of order.
	const asyncFilter = async emitted => {
		const value = toValue(emitted);
		for (let turn = 0; turn < (typeof value === 'number' ? value % 4 : 0); turn++) {
			// eslint-disable-next-line no-await-in-loop -- How long the filter takes is the point.
			await Promise.resolve();
		}

		return isAcceptedPayload(emitted);
	};

	const filters = {
		none: undefined,
		sync: isAcceptedPayload,
		async: asyncFilter,
	};

	const raw = Array.from({length: target + between(0, 4)}, () => pick([1, 2, 3, 4, 'a', null, undefined]));
	// `count` counts the values it keeps, while `limit` counts the events it receives.
	const relevant = kind === 'multiple' ? raw : raw.slice(0, target);
	const expected = relevant
		.filter(value => isAcceptedPayload(toPayload(value)))
		.slice(0, target)
		.map(value => toPayload(value));

	// `count` counts the values it keeps, so a burst that does not yield that many leaves it legitimately waiting. `limit` counts the events it receives, and the burst below always emits at least that many, so the iterator always finishes and needs no such escape.
	const canFillCount = expected.length >= target;
	const emitter = new EventEmitter();
	const options = {
		...(filters[filterKind] && {filter: filters[filterKind]}),
		...(hasMultiArgs && {multiArgs: true}),
	};
	const emitAll = () => {
		for (const value of raw) {
			emitter.emit('test', ...(hasMultiArgs ? [value, 'tail'] : [value]));
		}
	};

	if (kind === 'multiple') {
		const promise = pEventMultiple(emitter, names, {...options, count: target});
		emitAll();

		// The burst did not produce enough accepted values, so the promise is still waiting and there is nothing to compare against. Cancelling still has to take every listener off.
		if (!canFillCount) {
			promise.cancel();
			assert.deepEqual(emitter.eventNames(), [], `round ${round} left a listener behind after cancelling`);
			return shape;
		}

		assert.deepEqual(await promise, expected, `round ${round}`);
		assert.deepEqual(emitter.eventNames(), [], `round ${round} left a listener behind`);
		return shape;
	}

	const iterator = pEventIterator(emitter, names, {...options, limit: target});
	emitAll();

	const collected = [];
	for (let index = 0; index < expected.length; index++) {
		// eslint-disable-next-line no-await-in-loop -- The values are already buffered, so this settles at once.
		const result = await iterator.next();
		// A value that was already received is never reported as done, whatever ended the iteration.
		assert.equal(result.done, false, `round ${round} reported done while a value was buffered`);
		collected.push(result.value);
	}

	assert.deepEqual(collected, expected, `round ${round}`);

	assert.deepEqual(await iterator.next(), {done: true, value: undefined}, `round ${round}`);
	assert.deepEqual(emitter.eventNames(), [], `round ${round} left a listener behind`);
	return shape;
};

test('a randomised run collects exactly the right values, in order', async () => {
	// The value checks live in `checkRandomRound`. Several seeds, because each one reaches different combinations and the whole thing costs milliseconds.
	const seeds = [24_301, 7, 99_991];
	const shapes = new Set();

	for (const seed of seeds) {
		const random = makeRandom(seed);
		for (let round = 0; round < 500; round++) {
			// eslint-disable-next-line no-await-in-loop -- The rounds share a generator, so they have to run in order.
			shapes.add(await checkRandomRound(random, round));
		}
	}

	// A generator that got stuck on a few shapes would leave most of the option space unchecked.
	assert.deepEqual([...shapes].toSorted((a, b) => a.localeCompare(b)), ['iterator async', 'iterator none', 'iterator sync', 'multiple async', 'multiple none', 'multiple sync']);
});

test('a filter is not run for a value that arrives after the promise settled', async () => {
	// The queue kept running filters for values that were already waiting, so user code ran for an operation that was over. `acceptItem` stopped the value being collected, but nothing stopped the call.
	const emitter = new EventEmitter();
	const filtered = [];
	const {promise: gate, resolve: release} = Promise.withResolvers();
	const promise = pEventMultiple(emitter, 'test', {
		count: 1,
		async filter(value) {
			filtered.push(value);
			await gate;
			return true;
		},
	});

	emitter.emit('test', 'first');
	// The first filter has to be running before the second value is queued behind it.
	await delay(0);
	emitter.emit('test', 'second');
	release();

	assert.deepEqual(await promise, ['first']);
	await delay(0);
	assert.deepEqual(filtered, ['first']);
});

// A plain emitter that records every add and remove call, so a test can check exactly what the library did with it.
const recordingEmitter = () => {
	const listeners = new Map();
	const calls = [];

	return {
		calls,
		on(name, listener) {
			calls.push(['on', name]);
			listeners.set(name, listener);
		},
		off(name, listener) {
			calls.push(['off', name]);
			if (listeners.get(name) === listener) {
				listeners.delete(name);
			}
		},
		emit(name, ...arguments_) {
			listeners.get(name)?.(...arguments_);
		},
	};
};

const doneResult = {done: true, value: undefined};

test('`pEvent` resolves with only the first argument by default', async () => {
	const emitter = new EventEmitter();
	const promise = pEvent(emitter, 'data');

	emitter.emit('data', 'first', 'second');

	assert.equal(await promise, 'first');
});

test('an event without arguments resolves with `undefined`, or an empty list with `multiArgs`', async () => {
	const emitter = new EventEmitter();
	const single = pEvent(emitter, 'data');
	const multiple = pEvent(emitter, 'data', {multiArgs: true});

	emitter.emit('data');

	assert.deepEqual(await Promise.all([single, multiple]), [undefined, []]);
});

test('a rejection event without arguments rejects with `undefined`', async () => {
	// The iterator keeps a rejection until it is read, so an `undefined` reason must still count as one.
	const emitter = new EventEmitter();
	const promise = pEvent(emitter, 'data');
	const iterator = pEventIterator(emitter, 'data');

	emitter.emit('error');

	await assert.rejects(promise, reason => reason === undefined);
	await assert.rejects(iterator.next(), reason => reason === undefined);
	assert.deepEqual(await iterator.next(), doneResult);
});

test('an empty `rejectionEvents` list attaches no rejection listener', async () => {
	const emitter = new EventEmitter();
	const promise = pEvent(emitter, 'data', {rejectionEvents: []});

	assert.deepEqual(emitter.eventNames(), ['data']);

	emitter.emit('data', 'value');
	assert.equal(await promise, 'value');
});

test('a filter verdict only has to be truthy', async () => {
	const emitter = new EventEmitter();
	const promise = pEventMultiple(emitter, 'data', {
		count: 3,
		filter: ({verdict}) => verdict,
	});

	for (const verdict of [1, 0, 'yes', '', null, {}, undefined, NaN]) {
		emitter.emit('data', {verdict});
	}

	const items = await promise;
	assert.deepEqual(items.map(({verdict}) => verdict), [1, 'yes', {}]);
});

test('the filter is not called for events still queued when the count is reached', async () => {
	const emitter = new EventEmitter();
	const filtered = [];
	const promise = pEventMultiple(emitter, 'data', {
		count: 3,
		filter(value) {
			filtered.push(value);
			return true;
		},
	});

	for (const value of [1, 2, 3, 4, 5]) {
		emitter.emit('data', value);
	}

	assert.deepEqual(await promise, [1, 2, 3]);
	// Gives the queued filters for 4 and 5 the chance to run, so a filter called after the count was reached would show up.
	await delay(0);
	assert.deepEqual(filtered, [1, 2, 3]);
});

test('a filter that throws stops the filters still waiting behind it', async () => {
	const emitter = new EventEmitter();
	const filtered = [];
	const promise = pEventMultiple(emitter, 'data', {
		count: Infinity,
		filter(value) {
			filtered.push(value);
			if (value === 2) {
				throw new Error('second');
			}

			return true;
		},
	});

	for (const value of [1, 2, 3, 4]) {
		emitter.emit('data', value);
	}

	await assert.rejects(promise, {message: 'second'});
	// Gives the queued filters for 3 and 4 the chance to run, so a filter called after the failure would show up.
	await delay(0);
	assert.deepEqual(filtered, [1, 2]);
	assert.deepEqual(emitter.eventNames(), []);
});

test('a rejection event does not wait for a filter that is still running', async () => {
	const emitter = new EventEmitter();
	const {promise: gate, resolve: release} = Promise.withResolvers();
	const promise = pEvent(emitter, 'data', async () => {
		await gate;
		return true;
	});

	emitter.emit('data', 'value');
	emitter.emit('error', new Error('boom'));

	// The gate is still closed, so this only settles if the rejection does not wait for the filter.
	await assert.rejects(promise, {message: 'boom'});
	release();
});

test('cancelling one call leaves another call on the same event listening', async () => {
	const emitter = new EventEmitter();
	const cancelled = pEvent(emitter, 'data');
	const kept = pEvent(emitter, 'data');
	const iterator = pEventIterator(emitter, 'data');

	cancelled.cancel();
	await iterator.return();
	assert.equal(emitter.listenerCount('data'), 1);

	emitter.emit('data', 'value');
	assert.equal(await kept, 'value');
});

test('listeners the caller added to the emitter or the signal are left alone', async () => {
	const emitter = new EventEmitter();
	const controller = new AbortController();
	const own = () => {};
	emitter.on('data', own);
	emitter.on('error', own);
	controller.signal.addEventListener('abort', own);

	const promise = pEvent(emitter, 'data', {signal: controller.signal});
	const iterator = pEventIterator(emitter, 'data', {signal: controller.signal});
	emitter.emit('data', 'value');
	await promise;
	await iterator.return();

	assert.deepEqual([emitter.listeners('data'), emitter.listeners('error'), abortListenerCount(controller.signal)], [[own], [own], 1]);
});

test('a `timeout` with a filter that accepts nothing rejects with a `TimeoutError` and removes the listeners', async () => {
	const emitter = new EventEmitter();
	const promise = pEvent(emitter, 'data', {timeout: 20, filter: () => false});

	emitter.emit('data', 'ignored');

	await assert.rejects(promise, TimeoutError);
	assert.deepEqual(emitter.eventNames(), []);
});

test('an abort before the `timeout` rejects with the abort reason', async () => {
	const emitter = new EventEmitter();
	const controller = new AbortController();
	const promise = pEvent(emitter, 'data', {timeout: 10_000, signal: controller.signal});

	controller.abort(new Error('stopped first'));

	await assert.rejects(promise, {message: 'stopped first'});
	assert.deepEqual([emitter.eventNames(), abortListenerCount(controller.signal)], [[], 0]);
});

test('the `resolveImmediately` deadline stops the listening at exactly the timeout', async t => {
	t.mock.timers.enable({apis: ['setTimeout']});
	const emitter = new EventEmitter();
	const result = await pEventMultiple(emitter, 'data', {count: Infinity, resolveImmediately: true, timeout: 100});

	t.mock.timers.tick(99);
	emitter.emit('data', 'in time');
	t.assert.strictEqual(emitter.listenerCount('data'), 1);

	t.mock.timers.tick(1);
	emitter.emit('data', 'too late');

	t.assert.deepStrictEqual(result, ['in time']);
	t.assert.deepStrictEqual(emitter.eventNames(), []);
});

test('`pEvent` ignores `count` and `resolveImmediately` from the caller', async () => {
	const emitter = new EventEmitter();
	const promise = pEvent(emitter, 'data', {count: 5, resolveImmediately: true});

	// A `resolveImmediately` that got through would have resolved by now, before any event.
	await delay(0);
	emitter.emit('data', 'value');

	assert.equal(await promise, 'value');
});

test('the iterator is its own async iterable', () => {
	const iterator = pEventIterator(new EventEmitter(), 'data');
	assert.equal(iterator[Symbol.asyncIterator](), iterator);
	iterator.return();
});

test('pending reads are fulfilled in the order they were made', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data');
	const reads = [iterator.next(), iterator.next(), iterator.next()];

	emitter.emit('data', 'a');
	emitter.emit('data', 'b');
	emitter.emit('data', 'c');

	const results = await Promise.all(reads);
	assert.deepEqual(results.map(({value}) => value), ['a', 'b', 'c']);
	await iterator.return();
});

test('reaching the `limit` settles every other pending read as done', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {limit: 1});
	const reads = [iterator.next(), iterator.next(), iterator.next()];

	emitter.emit('data', 'only');

	assert.deepEqual(await Promise.all(reads), [{done: false, value: 'only'}, doneResult, doneResult]);
	assert.deepEqual(emitter.eventNames(), []);
});

test('`return()` settles every pending read as done', async () => {
	const iterator = pEventIterator(new EventEmitter(), 'data');
	const reads = [iterator.next(), iterator.next()];

	assert.deepEqual(await iterator.return('stopped'), {done: true, value: 'stopped'});
	assert.deepEqual(await Promise.all(reads), [doneResult, doneResult]);
});

test('the iterator yields only the first argument, and accepts any truthy verdict', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {
		limit: 3,
		filter: value => value.length,
	});

	emitter.emit('data', 'kept', 'ignored');
	emitter.emit('data', '', 'ignored');
	emitter.emit('data', 'also kept', 'ignored');

	assert.deepEqual(await Array.fromAsync(iterator), ['kept', 'also kept']);
});

test('the iterator yields an event without arguments as an `undefined` value', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {limit: 1});

	emitter.emit('data');

	assert.deepEqual([await iterator.next(), await iterator.next()], [{done: false, value: undefined}, doneResult]);
});

test('the iterator `limit` counts events across every name', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, ['a', 'b'], {limit: 2});

	emitter.emit('a', 1);
	emitter.emit('b', 2);
	emitter.emit('a', 3);

	assert.deepEqual(await Array.fromAsync(iterator), [1, 2]);
	assert.deepEqual(emitter.eventNames(), []);
});

test('a `rejectionMultiArgs` reason waits for the next read', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {rejectionMultiArgs: true});

	emitter.emit('error', 'a', 'b');

	await assert.rejects(iterator.next(), reason => {
		assert.deepEqual(reason, ['a', 'b']);
		return true;
	});
});

test('a call that fails its option checks never touches the emitter', async () => {
	const emitter = recordingEmitter();
	const aborted = AbortSignal.abort(new Error('gone'));

	const messages = await Promise.all([
		settledMessage(pEventMultiple(emitter, 'data', {count: -1})),
		settledMessage(pEvent(emitter, 'data', {timeout: 0})),
		settledMessage(pEvent(emitter, 'data', {signal: aborted})),
	]);
	assert.throws(() => pEventIterator(emitter, 'data', {limit: -1}), TypeError);
	assert.throws(() => pEventIterator(emitter, 'data', {signal: aborted}), {message: 'gone'});

	assert.deepEqual(messages, [
		'The `count` option should be at least 0 or more',
		'Expected the `timeout` option to be a positive number, got `0`',
		'gone',
	]);
	assert.deepEqual(emitter.calls, []);
});

test('changing the caller\'s options object after the call has no effect', async () => {
	// The options are copied, and some of them are only read when an event arrives, so a later change to the caller's object would otherwise reach the call.
	const emitter = new EventEmitter();
	const multipleOptions = {count: 2};
	const iteratorOptions = {limit: 2};
	const multiple = pEventMultiple(emitter, 'data', multipleOptions);
	const iterator = pEventIterator(emitter, 'data', iteratorOptions);

	Object.assign(multipleOptions, {count: 1, multiArgs: true});
	Object.assign(iteratorOptions, {multiArgs: true});
	emitter.emit('data', 1, 'tail');
	emitter.emit('data', 2, 'tail');

	assert.deepEqual([await multiple, await Array.fromAsync(iterator)], [[1, 2], [1, 2]]);
});

test('`count` and `limit` accept every safe whole number, and `-0` counts as zero', async () => {
	const emitter = new EventEmitter();
	const largest = pEventMultiple(emitter, 'data', {count: Number.MAX_SAFE_INTEGER, resolveImmediately: true});
	assert.deepEqual(await largest, []);
	largest.cancel();

	const iterator = pEventIterator(emitter, 'data', {limit: Number.MAX_SAFE_INTEGER});
	await iterator.return();

	assert.deepEqual(await pEventMultiple(emitter, 'data', {count: -0}), []);
	assert.deepEqual(await pEventIterator(emitter, 'data', {limit: -0}).next(), doneResult);
	assert.deepEqual(emitter.eventNames(), []);
});

test('`count` and `limit` reject a number past the safe integer range', async () => {
	const emitter = new EventEmitter();

	// The `timeout` makes an accepted count fail quickly instead of waiting for good.
	await assert.rejects(pEventMultiple(emitter, 'data', {count: 2 ** 53, timeout: 50}), {message: 'The `count` option should be at least 0 or more'});
	assert.throws(() => pEventIterator(emitter, 'data', {limit: 2 ** 53}), {message: 'The `limit` option should be a non-negative integer or Infinity'});
	assert.deepEqual(emitter.eventNames(), []);
});

test('a `timeout` rejects at exactly the deadline', async t => {
	t.mock.timers.enable({apis: ['setTimeout']});
	// `setImmediate` is not mocked, so it lets the rejection travel through the promise chain.
	const flush = () => new Promise(resolve => {
		setImmediate(resolve);
	});
	const emitter = new EventEmitter();
	let outcome = 'pending';
	pEvent(emitter, 'data', {timeout: 100}).catch(error => {
		outcome = error.name;
	});

	t.mock.timers.tick(99);
	await flush();
	const beforeDeadline = outcome;

	t.mock.timers.tick(1);
	await flush();

	t.assert.deepStrictEqual([beforeDeadline, outcome, emitter.eventNames()], ['pending', 'TimeoutError', []]);
});

test('an event after the `limit` was reached is not heard, not even a resolution event', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {limit: 1, resolutionEvents: ['end']});

	emitter.emit('data', 'only');
	emitter.emit('end', 'late payload');

	assert.deepEqual([await iterator.next(), await iterator.next()], [{done: false, value: 'only'}, doneResult]);
	assert.deepEqual(emitter.eventNames(), []);
});

test('a filter failure with nothing reading comes after the values before it, and drops the ones after it', async () => {
	const emitter = new EventEmitter();
	const iterator = pEventIterator(emitter, 'data', {
		filter(value) {
			if (value === 'bad') {
				throw new Error('bad value');
			}

			return true;
		},
	});

	emitter.emit('data', 'good');
	emitter.emit('data', 'bad');
	emitter.emit('data', 'never');
	await delay(0);

	assert.deepEqual(await iterator.next(), {done: false, value: 'good'});
	await assert.rejects(iterator.next(), {message: 'bad value'});
	assert.deepEqual(await iterator.next(), doneResult);
	assert.deepEqual(emitter.eventNames(), []);
});
