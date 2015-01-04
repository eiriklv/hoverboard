var Dispatcher = require('flux').Dispatcher;
var dispatcher = new Dispatcher();

var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();

var instanceCounter = 0;
var regexActionMethod = /^on[A-Z]/;

module.exports = function (StoreClass) {
	// convert an object into a "class" (use object as prototype on a function)
	if (!isFunction(StoreClass)) {
		StoreClass = createClass(StoreClass);
	}

	var
		// keep track of instance state
		state = null,

		// unique ID to identify this store instance
		id = instanceCounter++,

		// initialize the state the first time we need it
		initState = function (self) {
			// use getInitialState if available
			if (isFunction(self.getInitialState)) {
				var state = self.getInitialState();

				checkState(state);

				return state;
			}

			return {};
		},
		
		// return a clone of the state
		getState = function () {
			if (state === null) {
				state = initState(instance);
			}

			return clone(state);
		},

		// make sure state is an object
		checkState = function (state) {
			if (typeof state !== 'object') {
				throw new TypeError("State must be an object");
			}
		},

		// merge a state object into the existing state object
		setState = function (newState) {
			checkState(newState);

			if (state === null) {
				state = initState(this);
			}

			// start with a copy of both, so nobody has a pointer to it
			state = getState();
			newState = clone(newState);

			// merge in new properties
			for (k in newState) {
				state[k] = newState[k];
			}

			// clone again for private use
			(instance || this).state = getState();
			
			// let everyone know the state has changed
			emitter.emit(id);
		},

		// add a state change listener
		addStateListener = function (callback){
			var handler = function () {
				callback(getState());
			}

			emitter.on(id, handler);

			// call it once right away
			handler();

			// return an unsubscribe function specific to this listener
			return function () {
				// only call removeListener once, then destroy the handler
				if (handler) {
					emitter.removeListener(id, handler);
					handler = null;
				}
			};
		},

		api, instance;

	// add a few "official" instance methods
	// providing some functionality to the store
	StoreClass.prototype.setState = setState;
	StoreClass.prototype.getState = getState;

	// instantiate the store class
	instance = new StoreClass();

	// create an instance property with a clone of the initial state
	instance.state = getState();

	// create & expose the api for public use
	api = createApi(instance, id);

	// add a single public method for getting state (one time or with a listener)
	api.getState = function (callback) {
		if (isFunction(callback)) {
			return addStateListener(callback);
		}

		return getState();
	};

	return api;
}

// create the public API with action methods
function createApi(instance, id) {
	var api = {}, action, method, actionMethod;

	// create actions on the api
	for (method in instance) {
		if (regexActionMethod.test(method)) {
			action = createAction(id, method);
			actionMethod = getActionMethod(method);

			api[actionMethod] = action;
		}
	}

	// register action listener
	dispatcher.register(function (payload) {
		if (payload.id === id) {
			instance[payload.method].apply(instance, payload.args);
		}
	});
	
	return api;
}

function createAction(id, method) {
	var action = function () {
		var args = Array.prototype.slice.call(arguments, 0);

		dispatcher.dispatch({
			id: id,
			method: method,
			args: args
		});
	};

	return action;
}

function isFunction(fn) {
	return typeof fn === 'function';
}

function getActionMethod(method) {
	return method.charAt(2).toLowerCase() + method.substring(3);
}

// clone an object, only objects and primitives (serializable properties)
// note that we don't want functions in here. no cheating!
function clone(obj) {
	return JSON.parse(JSON.stringify(obj));
}

// create a class using an object as a prototype
function createClass(prototype) {
	var fn = function(){};
	fn.prototype = prototype;
	return fn;
}