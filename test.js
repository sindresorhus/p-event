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

test('`.cancel()` method', t => {
	const emitter = new EventEmitter();
	const promise = m(emitter, '🦄');
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
