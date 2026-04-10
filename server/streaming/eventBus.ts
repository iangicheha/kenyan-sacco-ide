import { EventEmitter } from "node:events";
import type { FinancialStreamEvent, FinancialStreamTopic } from "../types";

type StreamHandler = (event: FinancialStreamEvent) => void | Promise<void>;

const BATCH_SIZE = Math.max(1, Number(process.env.STREAM_BATCH_SIZE ?? 25));

class FinancialEventBus {
  private readonly emitter = new EventEmitter();
  private readonly queue: FinancialStreamEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.queue.splice(0, this.queue.length);
  }

  publish(event: FinancialStreamEvent): void {
    this.queue.push(event);
    if (this.queue.length >= BATCH_SIZE) {
      this.flush();
      return;
    }
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 25);
    }
  }

  subscribe(topic: FinancialStreamTopic | "*", handler: StreamHandler): () => void {
    this.emitter.on(topic, handler);
    return () => this.emitter.off(topic, handler);
  }

  private flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, BATCH_SIZE);
    for (const event of batch) {
      this.emitter.emit(event.topic, event);
      this.emitter.emit("*", event);
    }
  }
}

export const financialEventBus = new FinancialEventBus();
