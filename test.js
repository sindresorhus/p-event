import EventEmitter from 'events';
import test from 'ava';
import delay from 'delay';
import m from '.';

test('event to promise', async t => {
	const emitter = new EventEmitter();

	delay(200).then(() => {
		emitter.emit('🦄', '🌈');
	});

	t.is(await m(emitter, '🦄'), '🌈');
});

test('error event rejects the promise', async t => {
	const emitter = new EventEmitter();

	delay(200).then(() => {
		emitter.emit('error', new Error('💩'));
	});

	await t.throws(m(emitter, '🦄'), '💩');
});

test('`rejectionEvents` option', async t => {
	const emitter = new EventEmitter();

	delay(200).then(() => {
		emitter.emit('bar', new Error('💩'));
	});

	await t.throws(m(emitter, '🦄', {
		rejectionEvents: ['foo', 'bar']
	}), '💩');
});

test('`multiArgs` option on resolve', async t => {
	const emitter = new EventEmitter();

	delay(200).then(() => {
		emitter.emit('🦄', '🌈', '🌈');
	});

	t.deepEqual(await m(emitter, '🦄', {
		multiArgs: true
	}), ['🌈', '🌈']);
});

test('`multiArgs` option on reject', async t => {
	const emitter = new EventEmitter();

	delay(200).then(() => {
		emitter.emit('error', '💩', '💩');
	});

	t.deepEqual(await m(emitter, 'error', {
		multiArgs: true
	}), ['💩', '💩']);
});

test('`.cancel()` method', t => {
	const emitter = new EventEmitter();
	const promise = m(emitter, '🦄');
	t.is(emitter.listenerCount('🦄'), 1);
	promise.cancel();
	t.is(emitter.listenerCount('🦄'), 0);
});

test('`.cancel()` method with `timeout` option', t => {
	const emitter = new EventEmitter();
	const promise = m(emitter, '🦄', {timeout: 250});
	t.is(emitter.listenerCount('🦄'), 1);
	promise.cancel();
	t.is(emitter.listenerCount('🦄'), 0);
});

test('error on incompatible emitter', async t => {
	await t.throws(m({}, '🦄'), /not compatible/);
});

test('works with DOM events', async t => {
	const emitter = new EventEmitter();
	emitter.addEvenListener = emitter.addListener;
	emitter.removeEvenListener = emitter.removeListener;
	delete emitter.on;
	delete emitter.addListener;
	delete emitter.removeListener;

	delay(200).then(() => {
		emitter.emit('🦄', '🌈');
	});

	t.is(await m(emitter, '🦄'), '🌈');
});

test('event to promise - error', async t => {
	const emitter = new EventEmitter();

	delay(200).then(() => {
		emitter.emit('error', new Error('💩'));
	});

	t.deepEqual(await m(emitter, 'error'), new Error('💩'));
});

test('`timeout` option rejects when short enough', async t => {
	const emitter = new EventEmitter();
	const timeout = 50;

	delay(200).then(() => {
		emitter.emit('🦄', '🌈');
	});

	await t.throws(m(emitter, '🦄', {
		timeout
	}), `Promise timed out after ${timeout} milliseconds`);

	t.is(emitter.listenerCount('🦄'), 0);
});

test('`timeout` option resolves when long enough', async t => {
	const emitter = new EventEmitter();

	delay(200).then(() => {
		emitter.emit('🦄', '🌈');
	});

	t.is(await m(emitter, '🦄', {
		timeout: 250
	}), '🌈');
});

test('filter function to match event', async t => {
	const emitter = new EventEmitter();

	delay(200).then(() => {
		emitter.emit('🦄', 1);
		emitter.emit('🦄', 2);
		emitter.emit('🦄', 4);
		emitter.emit('🦄', 3);
	});

	t.is(await m(emitter, '🦄', x => x >= 3), 4);
});

test('filter option to match event', async t => {
	const emitter = new EventEmitter();

	delay(200).then(() => {
		emitter.emit('🦄', 1);
		emitter.emit('🦄', 2);
		emitter.emit('🦄', 4);
		emitter.emit('🦄', 3);
	});

	t.is(await m(emitter, '🦄', {
		filter: x => x >= 3
	}), 4);
});

test('filter option caught with error', async t => {
	const emitter = new EventEmitter();

	delay(200).then(() => {
		emitter.emit('🦄', 1);
		emitter.emit('🦄', 2);
		emitter.emit('error', new Error('💩'));
		emitter.emit('🦄', 4);
		emitter.emit('🦄', 3);
	});

	await t.throws(m(emitter, '🦄', {
		filter: x => x >= 3
	}), '💩');
});

test('filter option to match event with `multiArgs`', async t => {
	const emitter = new EventEmitter();

	delay(200).then(() => {
		emitter.emit('🦄', 1, 1);
		emitter.emit('🦄', 2, 2);
		emitter.emit('🦄', 4, 3);
		emitter.emit('🦄', 3, 4);
	});

	t.deepEqual(await m(emitter, '🦄', {
		filter: x => x[0] >= 3 && x[1] >= x[0],
		multiArgs: true
	}), [3, 4]);
});

test('filter option returned with `multiArgs`', async t => {
	const emitter = new EventEmitter();

	delay(200).then(() => {
		emitter.emit('🦄', 1, 1);
		emitter.emit('🦄', 2, 2);
		emitter.emit('error', 10000, '💩');
		emitter.emit('🦄', 4, 3);
		emitter.emit('🦄', 3, 4);
	});

	t.deepEqual(await m(emitter, 'error', {
		filter: x => (x[0] > 9999) && (x[1] === '💩'),
		multiArgs: true
	}), [10000, '💩']);
});
