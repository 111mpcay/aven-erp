import { Skeleton } from "@/components/ui/skeleton";

/** Static fallback shown while the authed app shell streams in. */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-64 flex-col gap-2 border-r bg-sidebar p-3 md:flex">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="mt-4 h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center border-b px-4">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="p-6">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
