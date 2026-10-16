/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.pricefeed = (function() {

    /**
     * Namespace pricefeed.
     * @exports pricefeed
     * @namespace
     */
    var pricefeed = {};

    pricefeed.ClientMessage = (function() {

        /**
         * Properties of a ClientMessage.
         * @memberof pricefeed
         * @interface IClientMessage
         * @property {pricefeed.ISubscribe|null} [subscribe] ClientMessage subscribe
         * @property {pricefeed.IUnsubscribe|null} [unsubscribe] ClientMessage unsubscribe
         */

        /**
         * Constructs a new ClientMessage.
         * @memberof pricefeed
         * @classdesc Represents a ClientMessage.
         * @implements IClientMessage
         * @constructor
         * @param {pricefeed.IClientMessage=} [properties] Properties to set
         */
        function ClientMessage(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ClientMessage subscribe.
         * @member {pricefeed.ISubscribe|null|undefined} subscribe
         * @memberof pricefeed.ClientMessage
         * @instance
         */
        ClientMessage.prototype.subscribe = null;

        /**
         * ClientMessage unsubscribe.
         * @member {pricefeed.IUnsubscribe|null|undefined} unsubscribe
         * @memberof pricefeed.ClientMessage
         * @instance
         */
        ClientMessage.prototype.unsubscribe = null;

        // OneOf field names bound to virtual getters and setters
        var $oneOfFields;

        /**
         * ClientMessage body.
         * @member {"subscribe"|"unsubscribe"|undefined} body
         * @memberof pricefeed.ClientMessage
         * @instance
         */
        Object.defineProperty(ClientMessage.prototype, "body", {
            get: $util.oneOfGetter($oneOfFields = ["subscribe", "unsubscribe"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new ClientMessage instance using the specified properties.
         * @function create
         * @memberof pricefeed.ClientMessage
         * @static
         * @param {pricefeed.IClientMessage=} [properties] Properties to set
         * @returns {pricefeed.ClientMessage} ClientMessage instance
         */
        ClientMessage.create = function create(properties) {
            return new ClientMessage(properties);
        };

        /**
         * Encodes the specified ClientMessage message. Does not implicitly {@link pricefeed.ClientMessage.verify|verify} messages.
         * @function encode
         * @memberof pricefeed.ClientMessage
         * @static
         * @param {pricefeed.IClientMessage} message ClientMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ClientMessage.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.subscribe != null && Object.hasOwnProperty.call(message, "subscribe"))
                $root.pricefeed.Subscribe.encode(message.subscribe, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
            if (message.unsubscribe != null && Object.hasOwnProperty.call(message, "unsubscribe"))
                $root.pricefeed.Unsubscribe.encode(message.unsubscribe, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
            return writer;
        };

        /**
         * Decodes a ClientMessage message from the specified reader or buffer.
         * @function decode
         * @memberof pricefeed.ClientMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pricefeed.ClientMessage} ClientMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ClientMessage.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            var end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.pricefeed.ClientMessage();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.subscribe = $root.pricefeed.Subscribe.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 2: {
                        message.unsubscribe = $root.pricefeed.Unsubscribe.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Gets the default type url for ClientMessage
         * @function getTypeUrl
         * @memberof pricefeed.ClientMessage
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ClientMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pricefeed.ClientMessage";
        };

        return ClientMessage;
    })();

    pricefeed.Subscribe = (function() {

        /**
         * Properties of a Subscribe.
         * @memberof pricefeed
         * @interface ISubscribe
         * @property {Array.<string>|null} [symbols] Subscribe symbols
         * @property {boolean|null} [wantDepth] Subscribe wantDepth
         */

        /**
         * Constructs a new Subscribe.
         * @memberof pricefeed
         * @classdesc Represents a Subscribe.
         * @implements ISubscribe
         * @constructor
         * @param {pricefeed.ISubscribe=} [properties] Properties to set
         */
        function Subscribe(properties) {
            this.symbols = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Subscribe symbols.
         * @member {Array.<string>} symbols
         * @memberof pricefeed.Subscribe
         * @instance
         */
        Subscribe.prototype.symbols = $util.emptyArray;

        /**
         * Subscribe wantDepth.
         * @member {boolean} wantDepth
         * @memberof pricefeed.Subscribe
         * @instance
         */
        Subscribe.prototype.wantDepth = false;

        /**
         * Creates a new Subscribe instance using the specified properties.
         * @function create
         * @memberof pricefeed.Subscribe
         * @static
         * @param {pricefeed.ISubscribe=} [properties] Properties to set
         * @returns {pricefeed.Subscribe} Subscribe instance
         */
        Subscribe.create = function create(properties) {
            return new Subscribe(properties);
        };

        /**
         * Encodes the specified Subscribe message. Does not implicitly {@link pricefeed.Subscribe.verify|verify} messages.
         * @function encode
         * @memberof pricefeed.Subscribe
         * @static
         * @param {pricefeed.ISubscribe} message Subscribe message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Subscribe.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.symbols != null && message.symbols.length)
                for (var i = 0; i < message.symbols.length; ++i)
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.symbols[i]);
            if (message.wantDepth != null && Object.hasOwnProperty.call(message, "wantDepth"))
                writer.uint32(/* id 2, wireType 0 =*/16).bool(message.wantDepth);
            return writer;
        };

        /**
         * Decodes a Subscribe message from the specified reader or buffer.
         * @function decode
         * @memberof pricefeed.Subscribe
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pricefeed.Subscribe} Subscribe
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Subscribe.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            var end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.pricefeed.Subscribe();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.symbols && message.symbols.length))
                            message.symbols = [];
                        message.symbols.push(reader.string());
                        break;
                    }
                case 2: {
                        message.wantDepth = reader.bool();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Gets the default type url for Subscribe
         * @function getTypeUrl
         * @memberof pricefeed.Subscribe
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Subscribe.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pricefeed.Subscribe";
        };

        return Subscribe;
    })();

    pricefeed.Unsubscribe = (function() {

        /**
         * Properties of an Unsubscribe.
         * @memberof pricefeed
         * @interface IUnsubscribe
         * @property {Array.<string>|null} [symbols] Unsubscribe symbols
         */

        /**
         * Constructs a new Unsubscribe.
         * @memberof pricefeed
         * @classdesc Represents an Unsubscribe.
         * @implements IUnsubscribe
         * @constructor
         * @param {pricefeed.IUnsubscribe=} [properties] Properties to set
         */
        function Unsubscribe(properties) {
            this.symbols = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Unsubscribe symbols.
         * @member {Array.<string>} symbols
         * @memberof pricefeed.Unsubscribe
         * @instance
         */
        Unsubscribe.prototype.symbols = $util.emptyArray;

        /**
         * Creates a new Unsubscribe instance using the specified properties.
         * @function create
         * @memberof pricefeed.Unsubscribe
         * @static
         * @param {pricefeed.IUnsubscribe=} [properties] Properties to set
         * @returns {pricefeed.Unsubscribe} Unsubscribe instance
         */
        Unsubscribe.create = function create(properties) {
            return new Unsubscribe(properties);
        };

        /**
         * Encodes the specified Unsubscribe message. Does not implicitly {@link pricefeed.Unsubscribe.verify|verify} messages.
         * @function encode
         * @memberof pricefeed.Unsubscribe
         * @static
         * @param {pricefeed.IUnsubscribe} message Unsubscribe message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Unsubscribe.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.symbols != null && message.symbols.length)
                for (var i = 0; i < message.symbols.length; ++i)
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.symbols[i]);
            return writer;
        };

        /**
         * Decodes an Unsubscribe message from the specified reader or buffer.
         * @function decode
         * @memberof pricefeed.Unsubscribe
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pricefeed.Unsubscribe} Unsubscribe
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Unsubscribe.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            var end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.pricefeed.Unsubscribe();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.symbols && message.symbols.length))
                            message.symbols = [];
                        message.symbols.push(reader.string());
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Gets the default type url for Unsubscribe
         * @function getTypeUrl
         * @memberof pricefeed.Unsubscribe
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Unsubscribe.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pricefeed.Unsubscribe";
        };

        return Unsubscribe;
    })();

    pricefeed.ServerMessage = (function() {

        /**
         * Properties of a ServerMessage.
         * @memberof pricefeed
         * @interface IServerMessage
         * @property {Array.<pricefeed.IQuote>|null} [quotes] ServerMessage quotes
         * @property {Array.<pricefeed.IBook>|null} [books] ServerMessage books
         * @property {Array.<pricefeed.ISymbolStatus>|null} [statuses] ServerMessage statuses
         */

        /**
         * Constructs a new ServerMessage.
         * @memberof pricefeed
         * @classdesc Represents a ServerMessage.
         * @implements IServerMessage
         * @constructor
         * @param {pricefeed.IServerMessage=} [properties] Properties to set
         */
        function ServerMessage(properties) {
            this.quotes = [];
            this.books = [];
            this.statuses = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ServerMessage quotes.
         * @member {Array.<pricefeed.IQuote>} quotes
         * @memberof pricefeed.ServerMessage
         * @instance
         */
        ServerMessage.prototype.quotes = $util.emptyArray;

        /**
         * ServerMessage books.
         * @member {Array.<pricefeed.IBook>} books
         * @memberof pricefeed.ServerMessage
         * @instance
         */
        ServerMessage.prototype.books = $util.emptyArray;

        /**
         * ServerMessage statuses.
         * @member {Array.<pricefeed.ISymbolStatus>} statuses
         * @memberof pricefeed.ServerMessage
         * @instance
         */
        ServerMessage.prototype.statuses = $util.emptyArray;

        /**
         * Creates a new ServerMessage instance using the specified properties.
         * @function create
         * @memberof pricefeed.ServerMessage
         * @static
         * @param {pricefeed.IServerMessage=} [properties] Properties to set
         * @returns {pricefeed.ServerMessage} ServerMessage instance
         */
        ServerMessage.create = function create(properties) {
            return new ServerMessage(properties);
        };

        /**
         * Encodes the specified ServerMessage message. Does not implicitly {@link pricefeed.ServerMessage.verify|verify} messages.
         * @function encode
         * @memberof pricefeed.ServerMessage
         * @static
         * @param {pricefeed.IServerMessage} message ServerMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerMessage.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.quotes != null && message.quotes.length)
                for (var i = 0; i < message.quotes.length; ++i)
                    $root.pricefeed.Quote.encode(message.quotes[i], writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
            if (message.books != null && message.books.length)
                for (var i = 0; i < message.books.length; ++i)
                    $root.pricefeed.Book.encode(message.books[i], writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
            if (message.statuses != null && message.statuses.length)
                for (var i = 0; i < message.statuses.length; ++i)
                    $root.pricefeed.SymbolStatus.encode(message.statuses[i], writer.uint32(/* id 3, wireType 2 =*/26).fork(), q + 1).ldelim();
            return writer;
        };

        /**
         * Decodes a ServerMessage message from the specified reader or buffer.
         * @function decode
         * @memberof pricefeed.ServerMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pricefeed.ServerMessage} ServerMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerMessage.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            var end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.pricefeed.ServerMessage();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.quotes && message.quotes.length))
                            message.quotes = [];
                        message.quotes.push($root.pricefeed.Quote.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                case 2: {
                        if (!(message.books && message.books.length))
                            message.books = [];
                        message.books.push($root.pricefeed.Book.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                case 3: {
                        if (!(message.statuses && message.statuses.length))
                            message.statuses = [];
                        message.statuses.push($root.pricefeed.SymbolStatus.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Gets the default type url for ServerMessage
         * @function getTypeUrl
         * @memberof pricefeed.ServerMessage
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ServerMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pricefeed.ServerMessage";
        };

        return ServerMessage;
    })();

    pricefeed.Quote = (function() {

        /**
         * Properties of a Quote.
         * @memberof pricefeed
         * @interface IQuote
         * @property {string|null} [symbol] Quote symbol
         * @property {number|Long|null} [bid] Quote bid
         * @property {number|Long|null} [ask] Quote ask
         * @property {number|Long|null} [bidSize] Quote bidSize
         * @property {number|Long|null} [askSize] Quote askSize
         * @property {number|Long|null} [ts] Quote ts
         */

        /**
         * Constructs a new Quote.
         * @memberof pricefeed
         * @classdesc Represents a Quote.
         * @implements IQuote
         * @constructor
         * @param {pricefeed.IQuote=} [properties] Properties to set
         */
        function Quote(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Quote symbol.
         * @member {string} symbol
         * @memberof pricefeed.Quote
         * @instance
         */
        Quote.prototype.symbol = "";

        /**
         * Quote bid.
         * @member {number|Long} bid
         * @memberof pricefeed.Quote
         * @instance
         */
        Quote.prototype.bid = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * Quote ask.
         * @member {number|Long} ask
         * @memberof pricefeed.Quote
         * @instance
         */
        Quote.prototype.ask = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * Quote bidSize.
         * @member {number|Long} bidSize
         * @memberof pricefeed.Quote
         * @instance
         */
        Quote.prototype.bidSize = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * Quote askSize.
         * @member {number|Long} askSize
         * @memberof pricefeed.Quote
         * @instance
         */
        Quote.prototype.askSize = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * Quote ts.
         * @member {number|Long} ts
         * @memberof pricefeed.Quote
         * @instance
         */
        Quote.prototype.ts = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * Creates a new Quote instance using the specified properties.
         * @function create
         * @memberof pricefeed.Quote
         * @static
         * @param {pricefeed.IQuote=} [properties] Properties to set
         * @returns {pricefeed.Quote} Quote instance
         */
        Quote.create = function create(properties) {
            return new Quote(properties);
        };

        /**
         * Encodes the specified Quote message. Does not implicitly {@link pricefeed.Quote.verify|verify} messages.
         * @function encode
         * @memberof pricefeed.Quote
         * @static
         * @param {pricefeed.IQuote} message Quote message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Quote.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.symbol);
            if (message.bid != null && Object.hasOwnProperty.call(message, "bid"))
                writer.uint32(/* id 2, wireType 0 =*/16).sint64(message.bid);
            if (message.ask != null && Object.hasOwnProperty.call(message, "ask"))
                writer.uint32(/* id 3, wireType 0 =*/24).sint64(message.ask);
            if (message.bidSize != null && Object.hasOwnProperty.call(message, "bidSize"))
                writer.uint32(/* id 4, wireType 0 =*/32).sint64(message.bidSize);
            if (message.askSize != null && Object.hasOwnProperty.call(message, "askSize"))
                writer.uint32(/* id 5, wireType 0 =*/40).sint64(message.askSize);
            if (message.ts != null && Object.hasOwnProperty.call(message, "ts"))
                writer.uint32(/* id 6, wireType 0 =*/48).int64(message.ts);
            return writer;
        };

        /**
         * Decodes a Quote message from the specified reader or buffer.
         * @function decode
         * @memberof pricefeed.Quote
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pricefeed.Quote} Quote
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Quote.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            var end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.pricefeed.Quote();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.symbol = reader.string();
                        break;
                    }
                case 2: {
                        message.bid = reader.sint64();
                        break;
                    }
                case 3: {
                        message.ask = reader.sint64();
                        break;
                    }
                case 4: {
                        message.bidSize = reader.sint64();
                        break;
                    }
                case 5: {
                        message.askSize = reader.sint64();
                        break;
                    }
                case 6: {
                        message.ts = reader.int64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Gets the default type url for Quote
         * @function getTypeUrl
         * @memberof pricefeed.Quote
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Quote.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pricefeed.Quote";
        };

        return Quote;
    })();

    pricefeed.Book = (function() {

        /**
         * Properties of a Book.
         * @memberof pricefeed
         * @interface IBook
         * @property {string|null} [symbol] Book symbol
         * @property {Array.<pricefeed.ILevel>|null} [bids] Book bids
         * @property {Array.<pricefeed.ILevel>|null} [asks] Book asks
         * @property {number|Long|null} [ts] Book ts
         */

        /**
         * Constructs a new Book.
         * @memberof pricefeed
         * @classdesc Represents a Book.
         * @implements IBook
         * @constructor
         * @param {pricefeed.IBook=} [properties] Properties to set
         */
        function Book(properties) {
            this.bids = [];
            this.asks = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Book symbol.
         * @member {string} symbol
         * @memberof pricefeed.Book
         * @instance
         */
        Book.prototype.symbol = "";

        /**
         * Book bids.
         * @member {Array.<pricefeed.ILevel>} bids
         * @memberof pricefeed.Book
         * @instance
         */
        Book.prototype.bids = $util.emptyArray;

        /**
         * Book asks.
         * @member {Array.<pricefeed.ILevel>} asks
         * @memberof pricefeed.Book
         * @instance
         */
        Book.prototype.asks = $util.emptyArray;

        /**
         * Book ts.
         * @member {number|Long} ts
         * @memberof pricefeed.Book
         * @instance
         */
        Book.prototype.ts = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * Creates a new Book instance using the specified properties.
         * @function create
         * @memberof pricefeed.Book
         * @static
         * @param {pricefeed.IBook=} [properties] Properties to set
         * @returns {pricefeed.Book} Book instance
         */
        Book.create = function create(properties) {
            return new Book(properties);
        };

        /**
         * Encodes the specified Book message. Does not implicitly {@link pricefeed.Book.verify|verify} messages.
         * @function encode
         * @memberof pricefeed.Book
         * @static
         * @param {pricefeed.IBook} message Book message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Book.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.symbol);
            if (message.bids != null && message.bids.length)
                for (var i = 0; i < message.bids.length; ++i)
                    $root.pricefeed.Level.encode(message.bids[i], writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
            if (message.asks != null && message.asks.length)
                for (var i = 0; i < message.asks.length; ++i)
                    $root.pricefeed.Level.encode(message.asks[i], writer.uint32(/* id 3, wireType 2 =*/26).fork(), q + 1).ldelim();
            if (message.ts != null && Object.hasOwnProperty.call(message, "ts"))
                writer.uint32(/* id 4, wireType 0 =*/32).int64(message.ts);
            return writer;
        };

        /**
         * Decodes a Book message from the specified reader or buffer.
         * @function decode
         * @memberof pricefeed.Book
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pricefeed.Book} Book
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Book.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            var end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.pricefeed.Book();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.symbol = reader.string();
                        break;
                    }
                case 2: {
                        if (!(message.bids && message.bids.length))
                            message.bids = [];
                        message.bids.push($root.pricefeed.Level.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                case 3: {
                        if (!(message.asks && message.asks.length))
                            message.asks = [];
                        message.asks.push($root.pricefeed.Level.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                case 4: {
                        message.ts = reader.int64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Gets the default type url for Book
         * @function getTypeUrl
         * @memberof pricefeed.Book
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Book.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pricefeed.Book";
        };

        return Book;
    })();

    pricefeed.Level = (function() {

        /**
         * Properties of a Level.
         * @memberof pricefeed
         * @interface ILevel
         * @property {number|Long|null} [price] Level price
         * @property {number|Long|null} [size] Level size
         */

        /**
         * Constructs a new Level.
         * @memberof pricefeed
         * @classdesc Represents a Level.
         * @implements ILevel
         * @constructor
         * @param {pricefeed.ILevel=} [properties] Properties to set
         */
        function Level(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Level price.
         * @member {number|Long} price
         * @memberof pricefeed.Level
         * @instance
         */
        Level.prototype.price = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * Level size.
         * @member {number|Long} size
         * @memberof pricefeed.Level
         * @instance
         */
        Level.prototype.size = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * Creates a new Level instance using the specified properties.
         * @function create
         * @memberof pricefeed.Level
         * @static
         * @param {pricefeed.ILevel=} [properties] Properties to set
         * @returns {pricefeed.Level} Level instance
         */
        Level.create = function create(properties) {
            return new Level(properties);
        };

        /**
         * Encodes the specified Level message. Does not implicitly {@link pricefeed.Level.verify|verify} messages.
         * @function encode
         * @memberof pricefeed.Level
         * @static
         * @param {pricefeed.ILevel} message Level message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Level.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.price != null && Object.hasOwnProperty.call(message, "price"))
                writer.uint32(/* id 1, wireType 0 =*/8).sint64(message.price);
            if (message.size != null && Object.hasOwnProperty.call(message, "size"))
                writer.uint32(/* id 2, wireType 0 =*/16).sint64(message.size);
            return writer;
        };

        /**
         * Decodes a Level message from the specified reader or buffer.
         * @function decode
         * @memberof pricefeed.Level
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pricefeed.Level} Level
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Level.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            var end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.pricefeed.Level();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.price = reader.sint64();
                        break;
                    }
                case 2: {
                        message.size = reader.sint64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Gets the default type url for Level
         * @function getTypeUrl
         * @memberof pricefeed.Level
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Level.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pricefeed.Level";
        };

        return Level;
    })();

    pricefeed.SymbolStatus = (function() {

        /**
         * Properties of a SymbolStatus.
         * @memberof pricefeed
         * @interface ISymbolStatus
         * @property {string|null} [symbol] SymbolStatus symbol
         * @property {pricefeed.SymbolStatus.State|null} [state] SymbolStatus state
         * @property {number|Long|null} [ts] SymbolStatus ts
         */

        /**
         * Constructs a new SymbolStatus.
         * @memberof pricefeed
         * @classdesc Represents a SymbolStatus.
         * @implements ISymbolStatus
         * @constructor
         * @param {pricefeed.ISymbolStatus=} [properties] Properties to set
         */
        function SymbolStatus(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SymbolStatus symbol.
         * @member {string} symbol
         * @memberof pricefeed.SymbolStatus
         * @instance
         */
        SymbolStatus.prototype.symbol = "";

        /**
         * SymbolStatus state.
         * @member {pricefeed.SymbolStatus.State} state
         * @memberof pricefeed.SymbolStatus
         * @instance
         */
        SymbolStatus.prototype.state = 0;

        /**
         * SymbolStatus ts.
         * @member {number|Long} ts
         * @memberof pricefeed.SymbolStatus
         * @instance
         */
        SymbolStatus.prototype.ts = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * Creates a new SymbolStatus instance using the specified properties.
         * @function create
         * @memberof pricefeed.SymbolStatus
         * @static
         * @param {pricefeed.ISymbolStatus=} [properties] Properties to set
         * @returns {pricefeed.SymbolStatus} SymbolStatus instance
         */
        SymbolStatus.create = function create(properties) {
            return new SymbolStatus(properties);
        };

        /**
         * Encodes the specified SymbolStatus message. Does not implicitly {@link pricefeed.SymbolStatus.verify|verify} messages.
         * @function encode
         * @memberof pricefeed.SymbolStatus
         * @static
         * @param {pricefeed.ISymbolStatus} message SymbolStatus message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SymbolStatus.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.symbol);
            if (message.state != null && Object.hasOwnProperty.call(message, "state"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.state);
            if (message.ts != null && Object.hasOwnProperty.call(message, "ts"))
                writer.uint32(/* id 3, wireType 0 =*/24).int64(message.ts);
            return writer;
        };

        /**
         * Decodes a SymbolStatus message from the specified reader or buffer.
         * @function decode
         * @memberof pricefeed.SymbolStatus
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pricefeed.SymbolStatus} SymbolStatus
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SymbolStatus.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            var end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.pricefeed.SymbolStatus();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.symbol = reader.string();
                        break;
                    }
                case 2: {
                        message.state = reader.int32();
                        break;
                    }
                case 3: {
                        message.ts = reader.int64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Gets the default type url for SymbolStatus
         * @function getTypeUrl
         * @memberof pricefeed.SymbolStatus
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SymbolStatus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pricefeed.SymbolStatus";
        };

        /**
         * State enum.
         * @name pricefeed.SymbolStatus.State
         * @enum {number}
         * @property {number} STATE_UNSPECIFIED=0 STATE_UNSPECIFIED value
         * @property {number} NO_PRICE=1 NO_PRICE value
         * @property {number} FEED_DOWN=2 FEED_DOWN value
         * @property {number} AWAITING_FIRST_BOOK=3 AWAITING_FIRST_BOOK value
         * @property {number} UNKNOWN_SYMBOL=4 UNKNOWN_SYMBOL value
         */
        SymbolStatus.State = (function() {
            var valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "STATE_UNSPECIFIED"] = 0;
            values[valuesById[1] = "NO_PRICE"] = 1;
            values[valuesById[2] = "FEED_DOWN"] = 2;
            values[valuesById[3] = "AWAITING_FIRST_BOOK"] = 3;
            values[valuesById[4] = "UNKNOWN_SYMBOL"] = 4;
            return values;
        })();

        return SymbolStatus;
    })();

    return pricefeed;
})();

module.exports = $root;
