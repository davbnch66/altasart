import { useState, useEffect, useCallback, useRef } from "react";
import { useInfiniteScroll } from "./useInfiniteScroll";

const BATCH_SIZE = 50;

/**
 * Progressive list rendering: shows items in batches as user scrolls.
 * All data is already loaded client-side — this just throttles DOM rendering.
 */
export function useProgressiveList<T>(items: T[], batchSize = BATCH_SIZE) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const prevLengthRef = useRef(items.length);

  // Reset when items change (new filter, new data)
  useEffect(() => {
    if (items.length !== prevLengthRef.current) {
      setVisibleCount(batchSize);
      prevLengthRef.current = items.length;
    }
  }, [items.length, batchSize]);

  const hasMore = visibleCount < items.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + batchSize, items.length));
  }, [items.length, batchSize]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    isLoading: false,
  });

  const visibleItems = items.slice(0, visibleCount);

  return { visibleItems, sentinelRef, hasMore, totalCount: items.length };
}
