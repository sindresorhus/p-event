import pTimeout from 'p-timeout';

// A filter function can stand in for the options. The options are copied, so a later change to the caller's object cannot reach the call.
const normalizeOptions = options => typeof options === 'function' ? {filter: options} : {...options};

// A `count` or `limit`: a whole number of zero or more, or `Infinity`.
const isCount = value => value === Infinity || (Number.isSafeInteger(value) && value >= 0);

// The removal method has to come from the same family as the one used to add, otherwise the listener is never detached.
const listenerMethodPairs = [
	['addEventListener', 'removeEventListener'],
	['on', 'off'],
	['addListener', 'removeListener'],
];

const normalizeEmitter = emitter => {
	for (const [addMethod, removeMethod] of listenerMethodPairs) {
		const addListener = emitter?.[addMethod];
		const removeListener = emitter?.[removeMethod];

		if (typeof addListener === 'function' && typeof removeListener === 'function') {
			return {
				addListener: addListener.bind(emitter),
				removeListener: removeListener.bind(emitter),
			};
		}
	}

	throw new TypeError('Emitter is not compatible');
};

// Which handler serves each event name. A single name is a list of one. A name claimed by an earlier family keeps that handler, so the main event takes priority over `rejectionEvents`, which in turn takes priority over `resolutionEvents`. Registration and removal both walk the returned map, so they always agree, a repeated name gets one listener, and a later edit to the caller's arrays cannot reach them.
const listenerHandlers = families => {
	const handlers = new Map();

	for (const [names, handler] of families) {
		for (const name of Array.isArray(names) ? names : [names]) {
			if (!handlers.has(name)) {
				handlers.set(name, handler);
			}
		}
	}

	return handlers;
};

// Attaches the abort handler first, so an emitter that fires the abort itself while a listener is being attached still reaches the caller. An emitter that hands over buffered events the moment a listener is attached can end the call part way through, and anything attached after that would never be removed, so attaching stops once the call is done. The call can also end before the emitter stores the listener, since Node's `EventEmitter` emits `newListener` first, so the cleanup misses that listener and it is removed here.
const attachListeners = ({addListener, removeListener, handlers, signal, abortHandler, isDone}) => {
	signal?.addEventListener('abort', abortHandler, {once: true});

	for (const [eventName, listener] of handlers) {
		addListener(eventName, listener);

		if (isDone()) {
			removeListener(eventName, listener);
			return;
		}
	}
};

// `once: true` only detaches the abort handler when the signal fires, so a call that ended another way has to remove it.
const detachListeners = ({removeListener, handlers, signal, abortHandler}) => {
	for (const [eventName, listener] of handlers) {
		removeListener(eventName, listener);
	}

	signal?.removeEventListener('abort', abortHandler);
};

// Filters run one after another, so that an asynchronous one cannot reorder the values or read a `limit` that belongs to a later event. A verdict or a failure that arrives once the call is done is dropped, since the outcome is already decided and a cancelled promise must never settle.
const createFilterQueue = (filter, isDone, onError) => {
	let queue = Promise.resolve();

	return (value, onVerdict) => {
		queue = queue.then(async () => {
			// The call is over, so the filter could only produce a verdict that is discarded.
			if (isDone()) {
				return;
			}

			let isAccepted;
			// The filter's return value is a verdict rather than a rejection, so it is checked instead of caught.
			try {
				isAccepted = filter ? await filter(value) : true;
			} catch (error) {
				if (!isDone()) {
					onError(error);
				}

				return;
			}

			if (!isDone()) {
				onVerdict(isAccepted);
			}
		});
	};
};

export function pEventMultiple(emitter, event, options) {
	// The setup below can throw before `cancel` is assigned, and the returned promise documents a `.cancel()` method, so it starts out as a no-op.
	let cancel = () => {};
	// Set by `cancel()`, which every path that stops listening runs, so an event still going through an asynchronous `filter` can tell that its result is no longer wanted.
	let isDone = false;
	let deadlineTimer;
	const returnValue = new Promise((resolve, reject) => {
		options = normalizeOptions(options);

		// Held in a local so the filter is called on its own, and `this` inside it is not the options object the library works from.
		const {filter} = options;

		if (!isCount(options.count)) {
			throw new TypeError('The `count` option should be at least 0 or more');
		}

		// Checked here, before anything is attached, because `p-timeout` throws for it before it subscribes to this promise, which would leave the listeners attached and this rejection unhandled.
		if (typeof options.timeout === 'number'
			&& !(options.timeout > 0)) {
			throw new TypeError(`Expected the \`timeout\` option to be a positive number, got \`${options.timeout}\``);
		}

		options.signal?.throwIfAborted();

		const {addListener, removeListener} = normalizeEmitter(emitter);

		// A count of zero is already satisfied, so it must not wait for an event or leave a listener behind.
		if (options.count === 0) {
			resolve([]);
			return;
		}

		const items = [];

		// The reason is a single value, so it must not be wrapped the way a rejection event's arguments are.
		const rejectWithReason = reason => {
			cancel();
			reject(reason);
		};

		const queueFilter = createFilterQueue(filter, () => isDone, rejectWithReason);

		const acceptItem = value => {
			items.push(value);

			if (options.count !== items.length) {
				return;
			}

			cancel();
			resolve(items);
		};

		const onItem = (...arguments_) => {
			// The promise is already settled, so the array the caller holds must not keep growing. An emitter can still call a listener it removed during the same emit.
			if (isDone) {
				return;
			}

			const value = options.multiArgs ? arguments_ : arguments_[0];

			if (!filter) {
				acceptItem(value);
				return;
			}

			queueFilter(value, isAccepted => {
				if (isAccepted) {
					acceptItem(value);
				}
			});
		};

		const rejectHandler = (...arguments_) => {
			rejectWithReason(options.rejectionMultiArgs ? arguments_ : arguments_[0]);
		};

		const abortHandler = () => {
			rejectWithReason(options.signal.reason);
		};

		// Allow multiple events. The main event takes priority over a rejection event, as documented. An explicit `undefined` reads as "not set" rather than overriding the default, so a forwarded partial options object does not end up listening for the literal name `"undefined"`.
		const listening = {
			addListener,
			removeListener,
			handlers: listenerHandlers([[event, onItem], [options.rejectionEvents ?? ['error'], rejectHandler]]),
			signal: options.signal,
			abortHandler,
			isDone: () => isDone,
		};

		cancel = () => {
			isDone = true;

			// Stopping the listening on any path has to release the deadline too, or it would hold the event loop open for a timer that can no longer do anything.
			clearTimeout(deadlineTimer);

			detachListeners(listening);
		};

		attachListeners(listening);

		// A call that settled above was already cleaned up by `cancel()`, abort handler included.
		if (isDone || !options.resolveImmediately) {
			return;
		}

		// The promise is fulfilled right away, and `pTimeout` clears its timer as soon as the promise settles, so the deadline is tracked here instead. An infinite deadline has nothing to wait for, and `setTimeout` would clamp it to 1 millisecond.
		if (Number.isFinite(options.timeout)) {
			deadlineTimer = setTimeout(cancel, options.timeout);
		}

		resolve(items);
	});

	returnValue.cancel = cancel;

	// An invalid `timeout` already rejected the promise above, so it must not reach `pTimeout`.
	if (typeof options.timeout === 'number' && options.timeout > 0 && !options.resolveImmediately) {
		const timeout = pTimeout(returnValue, {milliseconds: options.timeout});
		// When cancelling, also clear the timeout timer
		timeout.cancel = () => {
			cancel();
			timeout.clear();
		};

		return timeout;
	}

	return returnValue;
}

export function pEvent(emitter, event, options) {
	const arrayPromise = pEventMultiple(emitter, event, {
		...normalizeOptions(options),
		count: 1,
		resolveImmediately: false,
	});
	const promise = arrayPromise.then(array => array[0]);
	promise.cancel = arrayPromise.cancel;

	return promise;
}

export function pEventIterator(emitter, event, options) {
	options = normalizeOptions(options);

	// Held in a local so the filter is called on its own, and `this` inside it is not the options object the library works from.
	const {filter} = options;

	// An explicit `undefined` reads as "not set" rather than overriding the default.
	const limit = options.limit ?? Infinity;
	if (!isCount(limit)) {
		throw new TypeError('The `limit` option should be a non-negative integer or Infinity');
	}

	options.signal?.throwIfAborted();

	const {addListener, removeListener} = normalizeEmitter(emitter);

	let isDone = false;
	// Set as soon as a resolution event arrives, so no further value can enter the iteration while the queued filters drain.
	let isResolving = false;
	// Wrapped as `{reason}`, so a rejection whose reason is `undefined` still counts as one.
	let pendingError;
	// The payload of the resolution event, held until a read reports the iteration as done. See `cancel()`.
	let resolutionValue;
	const nextQueue = [];
	const valueQueue = [];
	let eventCount = 0;

	const cancel = finalValue => {
		isDone = true;
		detachListeners(listening);

		// The first read that reports the iteration as done carries the payload of the resolution event, the same way a generator's first `{done: true}` result carries its return value. Published versions handed it over like this, and the async iterator protocol allows it, so `next()` callers can still read a final payload such as an exit code. Every read after that one gets `undefined`, as the protocol requires. Without a pending read, the payload waits in `resolutionValue` for the next one.
		resolutionValue = finalValue;
		for (const {resolve} of nextQueue.splice(0)) {
			resolve({done: true, value: resolutionValue});
			resolutionValue = undefined;
		}
	};

	const rejectIterator = reason => {
		if (isDone) {
			return;
		}

		if (nextQueue.length > 0) {
			nextQueue.shift().reject(reason);
		} else {
			pendingError = {reason};
		}

		cancel();
	};

	const queueFilter = createFilterQueue(filter, () => isDone, rejectIterator);

	const acceptValue = value => {
		if (nextQueue.length > 0) {
			nextQueue.shift().resolve({done: false, value});
		} else {
			valueQueue.push(value);
		}
	};

	const valueHandler = (...arguments_) => {
		// The iteration is over, so a value that is still arriving must not be added to the queue. A resolution event ends the iteration, so a value emitted after it does not belong to it, not even in the same burst before the queued filters have drained.
		if (isDone || isResolving) {
			return;
		}

		eventCount++;
		const isLastEvent = eventCount === limit;
		const value = options.multiArgs ? arguments_ : arguments_[0];

		const onVerdict = isAccepted => {
			if (isAccepted) {
				acceptValue(value);
			}

			// A rejected value still counts towards the limit, so the iterator ends either way.
			if (isLastEvent) {
				cancel();
			}
		};

		if (filter) {
			queueFilter(value, onVerdict);
		} else {
			onVerdict(true);
		}
	};

	const rejectHandler = (...arguments_) => {
		rejectIterator(options.rejectionMultiArgs ? arguments_ : arguments_[0]);
	};

	const resolveHandler = (...arguments_) => {
		const value = options.multiArgs ? arguments_ : arguments_[0];
		isResolving = true;

		// The event ends the iteration, so its payload is never yielded as a value. It queues behind the value filters, even without a filter, so that a value which was already received still gets in. The event ends the iteration either way: the verdict only decides whether its payload is handed over as the final value, which is how published versions behaved, and a failure in the filter rejects the iteration.
		queueFilter(value, isAccepted => {
			// `cancel()` settles any pending read, and the first one gets the payload.
			cancel(isAccepted ? value : undefined);
		});
	};

	// The reason is a single value, so it must not be wrapped the way a rejection event's arguments are.
	const abortHandler = () => {
		rejectIterator(options.signal.reason);
	};

	// Allow multiple events. A name that is already handled as a value must not also reject or end the iteration, and a rejection wins over a resolution, so a name never ends up with two handlers. An explicit `undefined` reads as "not set" rather than overriding the default, so a forwarded partial options object does not end up listening for the literal name `"undefined"`.
	const listening = {
		addListener,
		removeListener,
		handlers: listenerHandlers([
			[event, valueHandler],
			[options.rejectionEvents ?? ['error'], rejectHandler],
			[options.resolutionEvents ?? [], resolveHandler],
		]),
		signal: options.signal,
		abortHandler,
		isDone: () => isDone,
	};

	const iterator = {
		[Symbol.asyncIterator]() {
			return this;
		},
		async next() {
			if (valueQueue.length > 0) {
				// A value that was already received is always handed over, so the iteration is never reported done while one is still buffered.
				return {
					done: false,
					value: valueQueue.shift(),
				};
			}

			if (pendingError) {
				const {reason} = pendingError;
				pendingError = undefined;
				throw reason;
			}

			if (isDone) {
				// Handed over once, so only the first read after the buffered values gets the payload of the resolution event.
				const value = resolutionValue;
				resolutionValue = undefined;

				return {
					done: true,
					value,
				};
			}

			return new Promise((resolve, reject) => {
				nextQueue.push({resolve, reject});
			});
		},
		async return(value) {
			// Without a final value, `cancel()` also drops the payload of a resolution event that was not read yet.
			cancel();

			// The consumer ended the iteration, so nothing that is still buffered can come out of it.
			valueQueue.length = 0;
			pendingError = undefined;

			return {
				done: true,
				value,
			};
		},
	};

	// Return an empty async iterator to avoid any further cost. A limit of zero is already reached, so nothing is attached, and `cancel()` has nothing to remove.
	if (limit === 0) {
		isDone = true;
		listening.handlers.clear();
		return iterator;
	}

	attachListeners(listening);

	// Ending above runs `cancel()`, which already took the abort handler off, so there is nothing left here.
	return iterator;
}

export {TimeoutError} from 'p-timeout';
