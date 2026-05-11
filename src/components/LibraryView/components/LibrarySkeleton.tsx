import { Skeleton } from "../../ui/skeleton";

export function LibrarySkeleton() {
  return (
    <div data-testid="library-skeleton" className="space-y-4">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-20" /> {/* View buttons */}
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-8" /> {/* Refresh button */}
          <Skeleton className="h-8 w-24" /> {/* Manage button */}
        </div>
      </div>

      {/* Search skeleton */}
      <Skeleton className="h-10 w-full" />

      {/* Items skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-3 p-3">
            <Skeleton className="h-4 w-4" /> {/* Checkbox */}
            <Skeleton className="h-10 w-10 rounded" /> {/* Icon/thumbnail */}
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" /> {/* Name */}
              <Skeleton className="h-3 w-1/2" /> {/* Metadata */}
            </div>
            <Skeleton className="h-6 w-16" /> {/* Size/date */}
          </div>
        ))}
      </div>
    </div>
  );
}
