'use strict';
const pTimeout = require('p-timeout');

module.exports = (emitter, event, options) => {
	let cancel;

	const ret = new Promise((resolve, reject) => {
		if (typeof options === 'function') {
			options = {filter: options};
		}

		options = Object.assign({
			rejectionEvents: ['error'],
			multiArgs: false
		}, options);

		let addListener = emitter.on || emitter.addListener || emitter.addEventListener;
		let removeListener = emitter.off || emitter.removeListener || emitter.removeEventListener;

		if (!addListener || !removeListener) {
			throw new TypeError('Emitter is not compatible');
		}

		addListener = addListener.bind(emitter);
		removeListener = removeListener.bind(emitter);

		const resolveHandler = (...args) => {
			const value = options.multiArgs ? args : args[0];

			if (options.filter && !options.filter(value)) {
				return;
			}

			cancel();
			resolve(value);
		};

		const rejectHandler = (...args) => {
			cancel();
			reject(options.multiArgs ? args : args[0]);
		};

		cancel = () => {
			removeListener(event, resolveHandler);

			for (const rejectionEvent of options.rejectionEvents) {
				removeListener(rejectionEvent, rejectHandler);
			}
		};

		addListener(event, resolveHandler);

		for (const rejectionEvent of options.rejectionEvents) {
			addListener(rejectionEvent, rejectHandler);
		}
	});

	ret.cancel = cancel;

	if (typeof options.timeout === 'number') {
		const timeout = pTimeout(ret, options.timeout);
		timeout.cancel = cancel;
		return timeout;
	}

	return ret;
};
