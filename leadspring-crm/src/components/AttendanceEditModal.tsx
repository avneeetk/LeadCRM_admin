import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { updateAttendance } from "@/lib/firestore/attendance";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function showDate(value: any) {
  if (!value) return "—";
  try {
    // Firestore Timestamp
    if (value.toDate) {
      const d = value.toDate();
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    // JS Date
    if (value instanceof Date) {
      return value.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  } catch {}
  return "—";
}
interface EditAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendance: any;
}

export function EditAttendanceModal({
  open,
  onOpenChange,
  attendance,
}: EditAttendanceModalProps) {
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [manualPunchOutTime, setManualPunchOutTime] = useState("");
  const [leaveStart, setLeaveStart] = useState<any>(null);
  const [leaveEnd, setLeaveEnd] = useState<any>(null);
  const [halfStart, setHalfStart] = useState<string | null>(null);
  const [halfEnd, setHalfEnd] = useState<string | null>(null);

  /**
   * 🔒 Normalize Firestore fields ONCE
   */
  useEffect(() => {
    if (!attendance) return;

    const normalized = {
      ...attendance,

      attendanceStatus:
        attendance.attendanceStatus ??
        attendance.attendance_status ??
        "present",

      approvalStatus:
        attendance.approvalStatus ??
        attendance.approval_status ??
        "none",

      recordType:
        attendance.recordType ??
        attendance.record_type ??
        ((attendance.attendance_status === "leave" ||
          attendance.attendance_status === "half_day")
          ? "leave"
          : "attendance"),

      // ✅ MULTI-DAY LEAVE RANGE
      startDate:
        attendance.startDate ??
        attendance.start_date ??
        attendance.__raw?.start_date ??
        attendance.day_start ??
        null,

      endDate:
        attendance.endDate ??
        attendance.end_date ??
        attendance.__raw?.end_date ??
        attendance.day_end ??
        null,

      // ✅ HALF-DAY TIME RANGE
      halfDayStart:
        attendance.halfDayStart ??
        attendance.half_day_start ??
        attendance.__raw?.half_day_start ??
        null,

      halfDayEnd:
        attendance.halfDayEnd ??
        attendance.half_day_end ??
        attendance.__raw?.half_day_end ??
        null,
    };

    setForm(normalized);
    setOverrideStatus(normalized.attendanceStatus);
  }, [attendance]);

  useEffect(() => {
    if (!attendance?.id) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "attendance", attendance.id));
        if (!snap.exists()) return;

        const data = snap.data();

        setLeaveStart(data.start_date ?? null);
        setLeaveEnd(data.end_date ?? null);

        setHalfStart(data.half_day_start ?? null);
        setHalfEnd(data.half_day_end ?? null);
      } catch (e) {
        console.error("Failed to fetch leave dates", e);
      }
    })();
  }, [attendance?.id]);

  if (!form) return null;

  // ─────────────────────────────
  // STATE DERIVATION
  // ─────────────────────────────
  const isLeaveRecord = form.recordType === "leave";
  const isPendingApproval =
    isLeaveRecord && form.approvalStatus === "pending";

  const isApproved =
    isLeaveRecord && form.approvalStatus === "approved";
  const isRejected =
    isLeaveRecord && form.approvalStatus === "rejected";

  const canOverrideStatus = !isLeaveRecord;
  const canManualPunchOut =
    !isLeaveRecord && !form.__raw?.punch_out_time;

  // ─────────────────────────────
  // APPROVE / DENY FLOW
  // ─────────────────────────────
  const handleApproval = async (decision: "approved" | "rejected") => {
    if (!isPendingApproval) return;

    try {
      setLoading(true);

      await updateAttendance(form.id, {
        approval_status: decision,
        attendance_status:
          decision === "approved"
            ? form.attendanceStatus
            : "present",
      });

      toast.success(
        decision === "approved"
          ? "Leave approved successfully"
          : "Leave request rejected"
      );

      onOpenChange(false);
    } catch {
      toast.error("Failed to update leave request");
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────
  // ADMIN OVERRIDE
  // ─────────────────────────────
  const handleOverrideStatus = async () => {
    if (!overrideStatus) return;

    try {
      setLoading(true);

      await updateAttendance(form.id, {
        attendance_status: overrideStatus,
        admin_override: true,
        override_reason: overrideReason || null,
      });

      toast.success("Status overridden");
      onOpenChange(false);
    } catch {
      toast.error("Failed to override status");
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────
  // MANUAL PUNCH OUT
  // ─────────────────────────────
  const handleManualPunchOut = async () => {
    if (!manualPunchOutTime) return;

    try {
      setLoading(true);
      const today = new Date();
      const [h, m] = manualPunchOutTime.split(":");
      today.setHours(Number(h), Number(m), 0, 0);

      await updateAttendance(form.id, {
        punch_out_time: today,
        system_completed: true,
      });

      toast.success("Punch-out added");
      onOpenChange(false);
    } catch {
      toast.error("Failed to punch out");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isPendingApproval
              ? "Leave Approval Request"
              : "Attendance Details"}
          </DialogTitle>
        </DialogHeader>

        {/* 🟡 PENDING LEAVE APPROVAL */}
        {isPendingApproval && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900 space-y-2">
            <div>
              <strong>{form.name || "This agent"}</strong> has requested{" "}
              <strong>
                {form.attendanceStatus === "leave"
                  ? "Full Day Leave"
                  : "Half Day Leave"}
              </strong>
            </div>

            {/* ✅ MULTI-DAY LEAVE RANGE */}
            {form.attendanceStatus === "leave" && (
              <div className="text-xs text-muted-foreground">
                Date range:{" "}
                <strong>
                  {showDate(leaveStart)} → {showDate(leaveEnd)}
                </strong>
              </div>
            )}

            {/* ✅ HALF-DAY TIME RANGE */}
            {form.attendanceStatus === "half_day" && (
              <div className="text-xs text-muted-foreground">
                Time range:{" "}
                <strong>
                  {halfStart || "—"} → {halfEnd || "—"}
                </strong>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="destructive"
                onClick={() => handleApproval("rejected")}
                disabled={loading}
              >
                Deny
              </Button>
              <Button
                onClick={() => handleApproval("approved")}
                disabled={loading}
              >
                Approve
              </Button>
            </div>
          </div>
        )}

        {/* APPROVAL RESULT */}
        {!isPendingApproval && (isApproved || isRejected) && (
          <div className="rounded-md border p-3 text-sm">
            Approval Status:{" "}
            <strong
              className={
                isApproved ? "text-green-600" : "text-red-600"
              }
            >
              {form.approvalStatus?.toUpperCase()}
            </strong>
          </div>
        )}

        {/* DETAILS */}
        <div className="grid gap-4 py-4">
          <div>
            <Label>Employee</Label>
            <div className="text-sm font-medium">
              {form.name || "—"}
            </div>
          </div>

          <div>
            <Label>Punch In Location</Label>
            <div className="text-sm text-muted-foreground">
              {form.__raw?.punch_in_address || "—"}
            </div>
          </div>

          <div>
            <Label>Punch Out Location</Label>
            <div className="text-sm text-muted-foreground">
              {form.__raw?.punch_out_address || "—"}
            </div>
          </div>
        </div>

        {/* ADMIN OVERRIDE */}
        {canOverrideStatus && (
          <div className="rounded-md border p-3 space-y-3">
            <Label>Override Attendance Status</Label>

            <Select
              value={overrideStatus}
              onValueChange={setOverrideStatus}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="leave">Leave</SelectItem>
                <SelectItem value="half_day">Half Day</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Reason (optional)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />

            <Button
              onClick={handleOverrideStatus}
              disabled={loading || !overrideStatus}
            >
              Apply Override
            </Button>
          </div>
        )}

        {/* MANUAL PUNCH OUT */}
        {canManualPunchOut && (
          <div className="rounded-md border p-3 space-y-3">
            <Label>Manual Punch Out</Label>
            <Input
              type="time"
              value={manualPunchOutTime}
              onChange={(e) =>
                setManualPunchOutTime(e.target.value)
              }
            />
            <Button
              variant="secondary"
              onClick={handleManualPunchOut}
              disabled={loading || !manualPunchOutTime}
            >
              Set Punch Out
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}