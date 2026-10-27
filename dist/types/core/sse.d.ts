export type SseEvent = {
    event: string;
    data: string;
};
export interface SseParser {
    /** Feed decoded text; complete events are dispatched as their terminating blank line arrives. */
    push(chunk: string): void;
    /** The server's last `retry:` hint, in ms. */
    readonly retryMs: number | undefined;
}
/** A server-sent events parser (the WHATWG event-stream format), for streams `EventSource` can't open because it
 * can't send headers. */
export declare function createSseParser(onEvent: (event: SseEvent) => void): SseParser;
//# sourceMappingURL=sse.d.ts.map