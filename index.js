import pTimeout from 'p-timeout';

const normalizeEmitter = emitter => {
	const addListener = emitter.addEventListener || emitter.on || emitter.addListener;
	const removeListener = emitter.removeEventListener || emitter.off || emitter.removeListener;

	if (!addListener || !removeListener) {
		throw new TypeError('Emitter is not compatible');
	}

	return {
		addListener: addListener.bind(emitter),
		removeListener: removeListener.bind(emitter),
	};
};

export function pEventMultiple(emitter, event, options) {
	let cancel;
	const returnValue = new Promise((resolve, reject) => {
		options = {
			rejectionEvents: ['error'],
			multiArgs: false,
			rejectionMultiArgs: false,
			resolveImmediately: false,
			...options,
		};

		if (!(options.count >= 0 && (options.count === Number.POSITIVE_INFINITY || Number.isInteger(options.count)))) {
			throw new TypeError('The `count` option should be at least 0 or more');
		}

		options.signal?.throwIfAborted();

		// Allow multiple events
		const events = [event].flat();

		const items = [];
		const {addListener, removeListener} = normalizeEmitter(emitter);

		const onItem = async (...arguments_) => {
			const value = options.multiArgs ? arguments_ : arguments_[0];

			if (options.filter) {
				try {
					if (!(await options.filter(value))) {
						return;
					}
				} catch (error) {
					cancel();
					reject(error);
					return;
				}
			}

			items.push(value);

			if (options.count === items.length) {
				cancel();
				resolve(items);
			}
		};

		const rejectHandler = (...arguments_) => {
			cancel();
			reject(options.rejectionMultiArgs ? arguments_ : arguments_[0]);
		};

		cancel = () => {
			for (const event of events) {
				removeListener(event, onItem);
			}

			for (const rejectionEvent of options.rejectionEvents) {
				// Only remove rejection handler if we actually registered it
				if (!events.includes(rejectionEvent)) {
					removeListener(rejectionEvent, rejectHandler);
				}
			}
		};

		for (const event of events) {
			addListener(event, onItem);
		}

		for (const rejectionEvent of options.rejectionEvents) {
			// Skip registering rejection handler if we're already listening to this event
			// as the main event takes priority (as documented)
			if (!events.includes(rejectionEvent)) {
				addListener(rejectionEvent, rejectHandler);
			}
		}

		if (options.signal) {
			options.signal.addEventListener('abort', () => {
				rejectHandler(options.signal.reason);
			}, {once: true});
		}

		if (options.resolveImmediately) {
			resolve(items);
		}
	});

	returnValue.cancel = cancel;

	if (typeof options.timeout === 'number') {
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
	if (typeof options === 'function') {
		options = {filter: options};
	}

	options = {
		...options,
		count: 1,
		resolveImmediately: false,
	};

	const arrayPromise = pEventMultiple(emitter, event, options);
	const promise = arrayPromise.then(array => array[0]); // eslint-disable-line promise/prefer-await-to-then
	promise.cancel = arrayPromise.cancel;

	return promise;
}

export function pEventIterator(emitter, event, options) {
	if (typeof options === 'function') {
		options = {filter: options};
	}

	// Allow multiple events
	const events = [event].flat();

	options = {
		rejectionEvents: ['error'],
		resolutionEvents: [],
		limit: Number.POSITIVE_INFINITY,
		multiArgs: false,
		rejectionMultiArgs: false,
		...options,
	};

	const {limit} = options;
	const isValidLimit = limit >= 0 && (limit === Number.POSITIVE_INFINITY || Number.isInteger(limit));
	if (!isValidLimit) {
		throw new TypeError('The `limit` option should be a non-negative integer or Infinity');
	}

	options.signal?.throwIfAborted();

	if (limit === 0) {
		// Return an empty async iterator to avoid any further cost
		return {
			[Symbol.asyncIterator]() {
				return this;
			},
			async next() {
				return {
					done: true,
					value: undefined,
				};
			},
		};
	}

	const {addListener, removeListener} = normalizeEmitter(emitter);

	let isDone = false;
	let error;
	let hasPendingError = false;
	const nextQueue = [];
	const valueQueue = [];
	let eventCount = 0;
	let isLimitReached = false;

	const valueHandler = (...arguments_) => {
		eventCount++;
		isLimitReached = eventCount === limit;

		const value = options.multiArgs ? arguments_ : arguments_[0];

		if (nextQueue.length > 0) {
			const {resolve} = nextQueue.shift();

			resolve({done: false, value});

			if (isLimitReached) {
				cancel();
			}

			return;
		}

		valueQueue.push(value);

		if (isLimitReached) {
			cancel();
		}
	};

	const cancel = () => {
		isDone = true;

		for (const event of events) {
			removeListener(event, valueHandler);
		}

		for (const rejectionEvent of options.rejectionEvents) {
			removeListener(rejectionEvent, rejectHandler);
		}

		for (const resolutionEvent of options.resolutionEvents) {
			removeListener(resolutionEvent, resolveHandler);
		}

		while (nextQueue.length > 0) {
			const {resolve} = nextQueue.shift();
			resolve({done: true, value: undefined});
		}
	};

	const rejectIterator = reason => {
		if (isDone) {
			return;
		}

		error = reason;

		if (nextQueue.length > 0) {
			const {reject} = nextQueue.shift();
			reject(error);
		} else {
			hasPendingError = true;
		}

		cancel();
	};

	const rejectHandler = (...arguments_) => {
		rejectIterator(options.rejectionMultiArgs ? arguments_ : arguments_[0]);
	};

	const resolveHandler = async (...arguments_) => {
		const value = options.multiArgs ? arguments_ : arguments_[0];

		if (options.filter) {
			try {
				if (!(await options.filter(value))) {
					cancel();
					return;
				}
			} catch (filterError) {
				rejectIterator(filterError);
				return;
			}
		}

		if (nextQueue.length > 0) {
			const {resolve} = nextQueue.shift();
			resolve({done: true, value});
		} else {
			valueQueue.push(value);
		}

		cancel();
	};

	for (const event of events) {
		addListener(event, valueHandler);
	}

	for (const rejectionEvent of options.rejectionEvents) {
		addListener(rejectionEvent, rejectHandler);
	}

	for (const resolutionEvent of options.resolutionEvents) {
		addListener(resolutionEvent, resolveHandler);
	}

	if (options.signal) {
		options.signal.addEventListener('abort', () => {
			rejectHandler(options.signal.reason);
		}, {once: true});
	}

	return {
		[Symbol.asyncIterator]() {
			return this;
		},
		async next() {
			if (valueQueue.length > 0) {
				const value = valueQueue.shift();
				return {
					done: isDone && valueQueue.length === 0 && !isLimitReached,
					value,
				};
			}

			if (hasPendingError) {
				hasPendingError = false;
				throw error;
			}

			if (isDone) {
				return {
					done: true,
					value: undefined,
				};
			}

			return new Promise((resolve, reject) => {
				nextQueue.push({resolve, reject});
			});
		},
		async return(value) {
			cancel();
			return {
				done: isDone,
				value,
			};
		},
	};
}

export {TimeoutError} from 'p-timeout';
