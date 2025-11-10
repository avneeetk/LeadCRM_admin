import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface LeadAssignmentNotificationProps {
  leadName: string;
  assignedBy: string;
  onClose: () => void;
}

export function LeadAssignmentNotification({ 
  leadName, 
  assignedBy, 
  onClose 
}: LeadAssignmentNotificationProps) {
  return (
    <Card className="fixed top-20 right-6 w-80 p-4 shadow-lg border-l-4 border-l-primary animate-in slide-in-from-right z-50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h4 className="font-semibold text-sm mb-1">New Lead Assigned</h4>
          <p className="text-sm text-muted-foreground">
            You've been assigned a new lead — <span className="font-medium text-foreground">{leadName}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Assigned by {assignedBy}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
