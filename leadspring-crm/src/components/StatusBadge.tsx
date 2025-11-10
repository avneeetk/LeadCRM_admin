import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = "new" | "contacted" | "follow-up" | "closed" | "lost" | "hot";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig = {
  new: {
    label: "New",
    className: "bg-info/10 text-info border-info/20 hover:bg-info/20",
  },
  contacted: {
    label: "Contacted",
    className: "bg-secondary text-secondary-foreground border-border",
  },
  "follow-up": {
    label: "Follow-Up",
    className: "bg-warning/10 text-warning-foreground border-warning/20 hover:bg-warning/20",
  },
  closed: {
    label: "Closed",
    className: "bg-success/10 text-success border-success/20 hover:bg-success/20",
  },
  lost: {
    label: "Lost",
    className: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20",
  },
  hot: {
    label: "Hot",
    className: "bg-success/10 text-success border-success/20 hover:bg-success/20",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) return null;
  // normalize status to lower-case to match keys
  const key = status.toLowerCase() as StatusType;
  const config = statusConfig[key] ?? { label: status, className: "" };

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
