import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace pricefeed. */
export namespace pricefeed {

    /** Properties of a ClientMessage. */
    interface IClientMessage {

        /** ClientMessage subscribe */
        subscribe?: (pricefeed.ISubscribe|null);

        /** ClientMessage unsubscribe */
        unsubscribe?: (pricefeed.IUnsubscribe|null);
    }

    /** Represents a ClientMessage. */
    class ClientMessage implements IClientMessage {

        /**
         * Constructs a new ClientMessage.
         * @param [properties] Properties to set
         */
        constructor(properties?: pricefeed.IClientMessage);

        /** ClientMessage subscribe. */
        public subscribe?: (pricefeed.ISubscribe|null);

        /** ClientMessage unsubscribe. */
        public unsubscribe?: (pricefeed.IUnsubscribe|null);

        /** ClientMessage body. */
        public body?: ("subscribe"|"unsubscribe");

        /**
         * Creates a new ClientMessage instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ClientMessage instance
         */
        public static create(properties?: pricefeed.IClientMessage): pricefeed.ClientMessage;

        /**
         * Encodes the specified ClientMessage message. Does not implicitly {@link pricefeed.ClientMessage.verify|verify} messages.
         * @param message ClientMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pricefeed.IClientMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ClientMessage message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ClientMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pricefeed.ClientMessage;

        /**
         * Gets the default type url for ClientMessage
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Subscribe. */
    interface ISubscribe {

        /** Subscribe symbols */
        symbols?: (string[]|null);

        /** Subscribe wantDepth */
        wantDepth?: (boolean|null);
    }

    /** Represents a Subscribe. */
    class Subscribe implements ISubscribe {

        /**
         * Constructs a new Subscribe.
         * @param [properties] Properties to set
         */
        constructor(properties?: pricefeed.ISubscribe);

        /** Subscribe symbols. */
        public symbols: string[];

        /** Subscribe wantDepth. */
        public wantDepth: boolean;

        /**
         * Creates a new Subscribe instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Subscribe instance
         */
        public static create(properties?: pricefeed.ISubscribe): pricefeed.Subscribe;

        /**
         * Encodes the specified Subscribe message. Does not implicitly {@link pricefeed.Subscribe.verify|verify} messages.
         * @param message Subscribe message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pricefeed.ISubscribe, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Subscribe message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Subscribe
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pricefeed.Subscribe;

        /**
         * Gets the default type url for Subscribe
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an Unsubscribe. */
    interface IUnsubscribe {

        /** Unsubscribe symbols */
        symbols?: (string[]|null);
    }

    /** Represents an Unsubscribe. */
    class Unsubscribe implements IUnsubscribe {

        /**
         * Constructs a new Unsubscribe.
         * @param [properties] Properties to set
         */
        constructor(properties?: pricefeed.IUnsubscribe);

        /** Unsubscribe symbols. */
        public symbols: string[];

        /**
         * Creates a new Unsubscribe instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Unsubscribe instance
         */
        public static create(properties?: pricefeed.IUnsubscribe): pricefeed.Unsubscribe;

        /**
         * Encodes the specified Unsubscribe message. Does not implicitly {@link pricefeed.Unsubscribe.verify|verify} messages.
         * @param message Unsubscribe message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pricefeed.IUnsubscribe, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an Unsubscribe message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Unsubscribe
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pricefeed.Unsubscribe;

        /**
         * Gets the default type url for Unsubscribe
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ServerMessage. */
    interface IServerMessage {

        /** ServerMessage quotes */
        quotes?: (pricefeed.IQuote[]|null);

        /** ServerMessage books */
        books?: (pricefeed.IBook[]|null);

        /** ServerMessage statuses */
        statuses?: (pricefeed.ISymbolStatus[]|null);
    }

    /** Represents a ServerMessage. */
    class ServerMessage implements IServerMessage {

        /**
         * Constructs a new ServerMessage.
         * @param [properties] Properties to set
         */
        constructor(properties?: pricefeed.IServerMessage);

        /** ServerMessage quotes. */
        public quotes: pricefeed.IQuote[];

        /** ServerMessage books. */
        public books: pricefeed.IBook[];

        /** ServerMessage statuses. */
        public statuses: pricefeed.ISymbolStatus[];

        /**
         * Creates a new ServerMessage instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ServerMessage instance
         */
        public static create(properties?: pricefeed.IServerMessage): pricefeed.ServerMessage;

        /**
         * Encodes the specified ServerMessage message. Does not implicitly {@link pricefeed.ServerMessage.verify|verify} messages.
         * @param message ServerMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pricefeed.IServerMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ServerMessage message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ServerMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pricefeed.ServerMessage;

        /**
         * Gets the default type url for ServerMessage
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Quote. */
    interface IQuote {

        /** Quote symbol */
        symbol?: (string|null);

        /** Quote bid */
        bid?: (number|Long|null);

        /** Quote ask */
        ask?: (number|Long|null);

        /** Quote bidSize */
        bidSize?: (number|Long|null);

        /** Quote askSize */
        askSize?: (number|Long|null);

        /** Quote ts */
        ts?: (number|Long|null);
    }

    /** Represents a Quote. */
    class Quote implements IQuote {

        /**
         * Constructs a new Quote.
         * @param [properties] Properties to set
         */
        constructor(properties?: pricefeed.IQuote);

        /** Quote symbol. */
        public symbol: string;

        /** Quote bid. */
        public bid: (number|Long);

        /** Quote ask. */
        public ask: (number|Long);

        /** Quote bidSize. */
        public bidSize: (number|Long);

        /** Quote askSize. */
        public askSize: (number|Long);

        /** Quote ts. */
        public ts: (number|Long);

        /**
         * Creates a new Quote instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Quote instance
         */
        public static create(properties?: pricefeed.IQuote): pricefeed.Quote;

        /**
         * Encodes the specified Quote message. Does not implicitly {@link pricefeed.Quote.verify|verify} messages.
         * @param message Quote message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pricefeed.IQuote, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Quote message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Quote
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pricefeed.Quote;

        /**
         * Gets the default type url for Quote
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Book. */
    interface IBook {

        /** Book symbol */
        symbol?: (string|null);

        /** Book bids */
        bids?: (pricefeed.ILevel[]|null);

        /** Book asks */
        asks?: (pricefeed.ILevel[]|null);

        /** Book ts */
        ts?: (number|Long|null);
    }

    /** Represents a Book. */
    class Book implements IBook {

        /**
         * Constructs a new Book.
         * @param [properties] Properties to set
         */
        constructor(properties?: pricefeed.IBook);

        /** Book symbol. */
        public symbol: string;

        /** Book bids. */
        public bids: pricefeed.ILevel[];

        /** Book asks. */
        public asks: pricefeed.ILevel[];

        /** Book ts. */
        public ts: (number|Long);

        /**
         * Creates a new Book instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Book instance
         */
        public static create(properties?: pricefeed.IBook): pricefeed.Book;

        /**
         * Encodes the specified Book message. Does not implicitly {@link pricefeed.Book.verify|verify} messages.
         * @param message Book message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pricefeed.IBook, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Book message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Book
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pricefeed.Book;

        /**
         * Gets the default type url for Book
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Level. */
    interface ILevel {

        /** Level price */
        price?: (number|Long|null);

        /** Level size */
        size?: (number|Long|null);
    }

    /** Represents a Level. */
    class Level implements ILevel {

        /**
         * Constructs a new Level.
         * @param [properties] Properties to set
         */
        constructor(properties?: pricefeed.ILevel);

        /** Level price. */
        public price: (number|Long);

        /** Level size. */
        public size: (number|Long);

        /**
         * Creates a new Level instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Level instance
         */
        public static create(properties?: pricefeed.ILevel): pricefeed.Level;

        /**
         * Encodes the specified Level message. Does not implicitly {@link pricefeed.Level.verify|verify} messages.
         * @param message Level message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pricefeed.ILevel, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Level message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Level
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pricefeed.Level;

        /**
         * Gets the default type url for Level
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SymbolStatus. */
    interface ISymbolStatus {

        /** SymbolStatus symbol */
        symbol?: (string|null);

        /** SymbolStatus state */
        state?: (pricefeed.SymbolStatus.State|null);

        /** SymbolStatus ts */
        ts?: (number|Long|null);
    }

    /** Represents a SymbolStatus. */
    class SymbolStatus implements ISymbolStatus {

        /**
         * Constructs a new SymbolStatus.
         * @param [properties] Properties to set
         */
        constructor(properties?: pricefeed.ISymbolStatus);

        /** SymbolStatus symbol. */
        public symbol: string;

        /** SymbolStatus state. */
        public state: pricefeed.SymbolStatus.State;

        /** SymbolStatus ts. */
        public ts: (number|Long);

        /**
         * Creates a new SymbolStatus instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SymbolStatus instance
         */
        public static create(properties?: pricefeed.ISymbolStatus): pricefeed.SymbolStatus;

        /**
         * Encodes the specified SymbolStatus message. Does not implicitly {@link pricefeed.SymbolStatus.verify|verify} messages.
         * @param message SymbolStatus message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pricefeed.ISymbolStatus, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SymbolStatus message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SymbolStatus
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pricefeed.SymbolStatus;

        /**
         * Gets the default type url for SymbolStatus
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace SymbolStatus {

        /** State enum. */
        enum State {
            STATE_UNSPECIFIED = 0,
            NO_PRICE = 1,
            FEED_DOWN = 2,
            AWAITING_FIRST_BOOK = 3,
            UNKNOWN_SYMBOL = 4
        }
    }
}
