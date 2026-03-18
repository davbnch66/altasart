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
  onLoadMoreRef.current = onLoadMore;

  const setSentinelRef = useCallback((node: HTMLDivElement | null) => {
    sentinelRef.current = node;
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, rootMargin]);

  return setSentinelRef;
}
