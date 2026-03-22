import { useEffect, useRef, useCallback } from "react";

interface UseInfiniteScrollOptions {
  /** Called when sentinel enters viewport */
  onLoadMore: () => void;
  /** Whether more data is available */
  hasMore: boolean;
  /** Whether a fetch is in progress */
  isLoading: boolean;
  /** IntersectionObserver rootMargin (default: 200px) */
  rootMargin?: string;
}

/**
 * Returns a ref to attach to a sentinel element at the bottom of a list.
 * When the sentinel enters the viewport, `onLoadMore` is called.
 */
export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  isLoading,
  rootMargin = "400px",
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const hasTriggeredRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  onLoadMoreRef.current = onLoadMore;

  const setSentinelRef = useCallback((node: HTMLDivElement | null) => {
    sentinelRef.current = node;
    hasTriggeredRef.current = false;
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (!entry.isIntersecting) {
          hasTriggeredRef.current = false;
          return;
        }

        if (isLoading || hasTriggeredRef.current) return;

        hasTriggeredRef.current = true;

        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
        }

        frameRef.current = requestAnimationFrame(() => {
          onLoadMoreRef.current();
        });
      },
      { rootMargin, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [hasMore, isLoading, rootMargin]);

  return setSentinelRef;
}
