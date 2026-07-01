"use client";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the authed app group — a friendly fallback instead of the
 * raw Next 500 screen (e.g. a bad hand-edited URL breaking a query).
 */
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page hit an unexpected error. Try again — if it keeps happening,
        head back to the dashboard.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
