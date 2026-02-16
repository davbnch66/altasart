/**
 * Offline mutation queue using localStorage.
 * Queues Supabase mutations when offline and replays them when back online.
 */

const QUEUE_KEY = "gruespro_offline_queue";

export interface QueuedMutation {
  id: string;
  timestamp: number;
  table: string;
  operation: "insert" | "update" | "delete";
  data: Record<string, any>;
  matchColumn?: string;
  matchValue?: string;
}

export function getQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToQueue(mutation: Omit<QueuedMutation, "id" | "timestamp">) {
  const queue = getQueue();
  queue.push({
    ...mutation,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent("offline-queue-change", { detail: queue.length }));
}

export function removeFromQueue(id: string) {
  const queue = getQueue().filter((m) => m.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent("offline-queue-change", { detail: queue.length }));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
  window.dispatchEvent(new CustomEvent("offline-queue-change", { detail: 0 }));
}

export function getQueueCount(): number {
  return getQueue().length;
}
