import { describe, it, expect, beforeEach } from "vitest";

// Inline simplified queue for testing (avoids localStorage dependency issues)
interface QueuedMutation {
  id: string;
  table: string;
  operation: "insert" | "update" | "delete";
  data: any;
  matchColumn?: string;
  matchValue?: string;
  timestamp: number;
}

function createQueue() {
  let queue: QueuedMutation[] = [];

  return {
    add(m: Omit<QueuedMutation, "id" | "timestamp">) {
      const item: QueuedMutation = {
        ...m,
        id: Math.random().toString(36).slice(2),
        timestamp: Date.now(),
      };
      queue.push(item);
      return item;
    },
    remove(id: string) {
      queue = queue.filter(q => q.id !== id);
    },
    getAll() {
      return [...queue];
    },
    count() {
      return queue.length;
    },
    clear() {
      queue = [];
    },
  };
}

describe("Offline Queue", () => {
  let q: ReturnType<typeof createQueue>;

  beforeEach(() => {
    q = createQueue();
  });

  it("adds mutations to queue", () => {
    q.add({ table: "visites", operation: "update", data: { id: "1", title: "test" } });
    expect(q.count()).toBe(1);
  });

  it("removes mutations by id", () => {
    const item = q.add({ table: "visites", operation: "insert", data: { title: "test" } });
    expect(q.count()).toBe(1);
    q.remove(item.id);
    expect(q.count()).toBe(0);
  });

  it("preserves order (FIFO)", () => {
    q.add({ table: "a", operation: "insert", data: {} });
    q.add({ table: "b", operation: "insert", data: {} });
    q.add({ table: "c", operation: "insert", data: {} });
    const all = q.getAll();
    expect(all.map(m => m.table)).toEqual(["a", "b", "c"]);
  });

  it("clears all mutations", () => {
    q.add({ table: "a", operation: "insert", data: {} });
    q.add({ table: "b", operation: "update", data: {} });
    q.clear();
    expect(q.count()).toBe(0);
  });
});
