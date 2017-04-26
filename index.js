'use strict';
module.exports = (emitter, event, opts) => {
	let cancel;

	const ret = new Promise((resolve, reject) => {
		opts = Object.assign({
			rejectionEvents: ['error']
		}, opts);

		let addListener = emitter.on || emitter.addListener || emitter.addEventListener;
		let removeListener = emitter.off || emitter.removeListener || emitter.removeEventListener;

		if (!addListener || !removeListener) {
			throw new TypeError('Emitter is not compatible');
		}

		addListener = addListener.bind(emitter);
		removeListener = removeListener.bind(emitter);

		const resolveHandler = value => {
			cancel();
			resolve(value);
		};

		const rejectHandler = reason => {
			cancel();
			reject(reason);
		};

		cancel = () => {
			removeListener(event, resolveHandler);

			for (const rejectionEvent of opts.rejectionEvents) {
				removeListener(rejectionEvent, rejectHandler);
			}
		};

		addListener(event, resolveHandler);

		for (const rejectionEvent of opts.rejectionEvents) {
			addListener(rejectionEvent, rejectHandler);
		}
	});

	ret.cancel = cancel;

	return ret;
};
