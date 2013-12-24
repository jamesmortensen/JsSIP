/**
 * @fileoverview OptionsPacket
 */

/**
 * @augments JsSIP
 * @class Class creating SIP OPTIONS request.
 * @param {JsSIP.UA} ua
 */
(function(JsSIP) {
var OptionsPacket;

OptionsPacket = function(ua) {
  this.ua = ua;
  this.logger = ua.getLogger('jssip.optionspacket');

  // Custom optionsPacket empty object for high level use
  this.data = {};
};
OptionsPacket.prototype = new JsSIP.EventEmitter();


OptionsPacket.prototype.send = function(target, body, options) {
  var request_sender, event, eventHandlers, extraHeaders,
    events = [
      'succeeded',
      'failed'
    ],
    originalTarget = target;

  if (target === undefined || body === undefined) {
    throw new TypeError('Not enough arguments');
  }

  // Check target validity
  target = this.ua.normalizeTarget(target);
  if (!target) {
    throw new TypeError('Invalid target: '+ originalTarget);
  }

  this.initEvents(events);

  // Get call options
  options = options || {};
  extraHeaders = options.extraHeaders || [];
  eventHandlers = options.eventHandlers || {};
  //contentType = options.contentType || 'text/plain';

  // Set event handlers
  for (event in eventHandlers) {
    this.on(event, eventHandlers[event]);
  }

  this.closed = false;
  this.ua.applicants[this] = this;

  //extraHeaders.push('Content-Type: '+ contentType);

  this.request = new JsSIP.OutgoingRequest(JsSIP.C.OPTIONS, target, this.ua, null, extraHeaders);

  if(body) {
    this.request.body = body;
  }

  request_sender = new JsSIP.RequestSender(this, this.ua);

  this.newOptionsPacket('local', this.request);

  request_sender.send();
};

/**
* @private
*/
OptionsPacket.prototype.receiveResponse = function(response) {
  var cause;

  if(this.closed) {
    return;
  }
  switch(true) {
    case /^1[0-9]{2}$/.test(response.status_code):
      // Ignore provisional responses.
      break;

    case /^2[0-9]{2}$/.test(response.status_code):
      delete this.ua.applicants[this];
      this.emit('succeeded', this, {
        originator: 'remote',
        response: response
      });
      break;

    default:
      delete this.ua.applicants[this];
      cause = JsSIP.Utils.sipErrorCause(response.status_code);
      this.emit('failed', this, {
        originator: 'remote',
        response: response,
        cause: cause
      });
      break;
  }
};


/**
* @private
*/
OptionsPacket.prototype.onRequestTimeout = function() {
  if(this.closed) {
    return;
  }
  this.emit('failed', this, {
    originator: 'system',
    cause: JsSIP.C.causes.REQUEST_TIMEOUT
  });
};

/**
* @private
*/
OptionsPacket.prototype.onTransportError = function() {
  if(this.closed) {
    return;
  }
  this.emit('failed', this, {
    originator: 'system',
    cause: JsSIP.C.causes.CONNECTION_ERROR
  });
};

/**
* @private
*/
OptionsPacket.prototype.close = function() {
  this.closed = true;
  delete this.ua.applicants[this];
};

/**
 * @private
 */
OptionsPacket.prototype.init_incoming = function(request) {
  var transaction;

  this.request = request;

  this.newOptionsPacket('remote', request);

  transaction = this.ua.transactions.nist[request.via_branch];

  if (transaction && (transaction.state === JsSIP.Transactions.C.STATUS_TRYING || transaction.state === JsSIP.Transactions.C.STATUS_PROCEEDING)) {
    request.reply(200);
  }
};

/**
 * Accept the incoming OptionsPacket
 * Only valid for incoming OptionsPackets
 */
OptionsPacket.prototype.accept = function(options) {
  options = options || {};

  var
    extraHeaders = options.extraHeaders || [],
    body = options.body;

  if (this.direction !== 'incoming') {
    throw new JsSIP.Exceptions.NotSupportedError('"accept" not supported for outgoing OptionsPacket');
  }

  this.request.reply(200, null, extraHeaders, body);
};

/**
 * Reject the incoming OptionsPacket
 * Only valid for incoming OptionsPackets
 *
 * @param {Number} status_code
 * @param {String} [reason_phrase]
 */
OptionsPacket.prototype.reject = function(options) {
  options = options || {};

  var
    status_code = options.status_code || 480,
    reason_phrase = options.reason_phrase,
    extraHeaders = options.extraHeaders || [],
    body = options.body;

  if (this.direction !== 'incoming') {
    throw new JsSIP.Exceptions.NotSupportedError('"reject" not supported for outgoing OptionsPacket');
  }

  if (status_code < 300 || status_code >= 700) {
    throw new TypeError('Invalid status_code: '+ status_code);
  }

  this.request.reply(status_code, reason_phrase, extraHeaders, body);
};

/**
 * Internal Callbacks
 */

/**
 * @private
 */
OptionsPacket.prototype.newOptionsPacket = function(originator, request) {
  var optionsPacket = this,
    event_name = 'newOptionsPacket';

  if (originator === 'remote') {
    optionsPacket.direction = 'incoming';
    optionsPacket.local_identity = request.to;
    optionsPacket.remote_identity = request.from;
  } else if (originator === 'local'){
    optionsPacket.direction = 'outgoing';
    optionsPacket.local_identity = request.from;
    optionsPacket.remote_identity = request.to;
  }

  optionsPacket.ua.emit(event_name, optionsPacket.ua, {
    originator: originator,
    optionsPacket: optionsPacket,
    request: request
  });
};

JsSIP.OptionsPacket = OptionsPacket;
}(JsSIP));
