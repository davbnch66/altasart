import { useState, useEffect, useCallback, useRef } from "react";
import { useInfiniteScroll } from "./useInfiniteScroll";

const BATCH_SIZE = 50;

/**
 * Progressive list rendering: shows items in batches as user scrolls.
 * All data is already loaded client-side — this just throttles DOM rendering.
 */
export function useProgressiveList<T>(items: T[], batchSize = BATCH_SIZE) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const prevLengthRef = useRef(items.length);

  // Reset when items change (new filter, new data)
  useEffect(() => {
    if (items.length !== prevLengthRef.current) {
      setVisibleCount(batchSize);
      setIsLoadingMore(false);
      prevLengthRef.current = items.length;
    }
  }, [items.length, batchSize]);

  const hasMore = visibleCount < items.length;

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    requestAnimationFrame(() => {
      setVisibleCount((prev) => Math.min(prev + batchSize, items.length));
      requestAnimationFrame(() => {
        setIsLoadingMore(false);
      });
    });
  }, [batchSize, hasMore, isLoadingMore, items.length]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    isLoading: isLoadingMore,
  });

  const visibleItems = items.slice(0, visibleCount);

  return { visibleItems, sentinelRef, hasMore, totalCount: items.length };
}
