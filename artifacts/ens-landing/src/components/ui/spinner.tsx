import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("grid size-4 grid-cols-2 gap-0.5 text-current", className)}
      {...props}
    >
      {[0, 120, 240, 360].map((delay, index) => (
        <span
          key={delay}
          className={cn(
            "ens-loader-square block rounded-[2px] bg-current",
            index === 3 && "opacity-40"
          )}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export { Spinner }
