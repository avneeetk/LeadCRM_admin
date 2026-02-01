// Helper to get human-readable date label for history separators
function getDateLabel(ts: any): string {
  if (!ts) return "—";
  let d: Date | null = null;
  // Firestore Timestamp with toDate()
  if (typeof ts?.toDate === "function") {
    try {
      d = ts.toDate();
    } catch (e) {
      return "—";
    }
  } else if (typeof ts === "object" && "seconds" in ts) {
    try {
      d = new Date(ts.seconds * 1000);
    } catch (e) {
      return "—";
    }
  } else if (typeof ts === "string") {
    d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
  } else if (ts instanceof Date) {
    d = ts;
  }
  if (!d) return "—";
  const today = new Date();
  // Set time of today and d to midnight for comparison
  const dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = todayMid.getTime() - dMid.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  // Format as e.g. Jan 8, 2026
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function normalizeType(type?: string) {
  return type?.toLowerCase() ?? "";
}
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { Lead } from "@/lib/mockData";
import { Mail, Phone, DollarSign, Calendar, User, Tag, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";

function renderHistoryText(entry: any, userNameMap: Record<string, string>) {
  const t = normalizeType(entry.type);

  switch (t) {
    case "assignment":
      return `Assigned to ${
        Array.isArray(entry.assignedToNames)
          ? entry.assignedToNames.join(", ")
          : Array.isArray(entry.toUserIds)
          ? entry.toUserIds
              .map((id: string) => userNameMap[id])
              .filter(Boolean)
              .join(", ")
          : "—"
      }`;

    case "transfer": {
      const from =
        entry.fromName ??
        (Array.isArray(entry.fromUserIds)
          ? entry.fromUserIds
              .map((id: string) => userNameMap[id])
              .filter(Boolean)
              .join(", ")
          : "—");
      const to =
        entry.toName ??
        (entry.toUserId ? (userNameMap[entry.toUserId] ?? null) : null) ??
        (Array.isArray(entry.toUserIds)
          ? entry.toUserIds
              .map((id: string) => userNameMap[id])
              .filter(Boolean)
              .join(", ")
          : "—");
      return `Transferred from ${from} to ${to}`;
    }

    case "status_change": {
      const fromStatus = entry.fromStatus ?? entry.oldValue ?? "—";
      const toStatus = entry.toStatus ?? entry.newValue ?? "—";
      return `Status changed from ${fromStatus} → ${toStatus}`;
    }

    case "tag_change":
      return `Tag changed to ${entry.toTag ?? entry.to ?? "—"}`;

    case "assignment_change": {
      const from =
        Array.isArray(entry.oldValue)
          ? entry.oldValue
              .map((id: string) => userNameMap[id])
              .filter(Boolean)
              .join(", ")
          : "—";
      const to =
        Array.isArray(entry.newValue)
          ? entry.newValue
              .map((id: string) => userNameMap[id])
              .filter(Boolean)
              .join(", ")
          : "—";
      return `Assignment changed from ${from} → ${to}`;
    }

    default:
      return entry.type ? entry.type.replace(/_/g, " ") : "—";
  }
}

interface LeadViewModalProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatTimestamp(ts: any): string {
  if (!ts) return "—";

  // Firestore Timestamp with toDate()
  if (typeof ts?.toDate === "function") {
    try {
      return ts.toDate().toLocaleString();
    } catch (e) {
      return "—";
    }
  }

  // Object with seconds
  if (typeof ts === "object" && "seconds" in ts) {
    try {
      return new Date(ts.seconds * 1000).toLocaleString();
    } catch (e) {
      return "—";
    }
  }

  // ISO string or Date
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
  }

  if (ts instanceof Date) {
    return ts.toLocaleString();
  }

  return "—";
}

export function LeadViewModal({ lead, open, onOpenChange }: LeadViewModalProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [assignedToNames, setAssignedToNames] = useState<string[]>([]);
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  type LeadHistory = {
    id: string;
    type: string;
    byUid?: string;
    byName?: string;
    assignedTo?: string[];
    assignedToNames?: string[];
    fromUid?: string;
    fromName?: string;
    toUid?: string;
    toName?: string;
    fromStatus?: string;
    toStatus?: string;
    createdAt?: any;
  };

  const [history, setHistory] = useState<LeadHistory[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // subscribe to leads/{leadId}/notes (server rules expect createdBy === auth.uid and content field)
  useEffect(() => {
    if (!lead?.id) {
      setNotes([]);
      return;
    }

    const notesRef = collection(db, "leads", lead.id, "notes");
    const q = query(notesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("LeadViewModal - notes subscription error:", err);
        setNotes([]);
      }
    );

    return () => unsub();
  }, [lead?.id]);

  useEffect(() => {
    if (!lead?.id) {
      setHistory([]);
      return;
    }

    const historyRef = collection(db, "leads", lead.id, "history");
    const q = query(historyRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("LeadViewModal - history subscription error:", err);
        setHistory([]);
      }
    );

    return () => unsub();
  }, [lead?.id]);

  useEffect(() => {
    if (!history.length) return;

    const ids = new Set<string>();

    history.forEach((h: any) => {
      if (Array.isArray(h.oldValue)) h.oldValue.forEach((id: string) => ids.add(id));
      if (Array.isArray(h.newValue)) h.newValue.forEach((id: string) => ids.add(id));
      if (Array.isArray(h.fromUserIds)) h.fromUserIds.forEach((id: string) => ids.add(id));
      if (typeof h.toUserId === "string") ids.add(h.toUserId);
    });

    if (ids.size === 0) return;

    const fetchNames = async () => {
      try {
        const entries = await Promise.all(
          Array.from(ids).map(async (uid) => {
            const snap = await getDoc(doc(db, "users", uid));
            return [uid, snap.exists() ? snap.data()?.name ?? null : null];
          })
        );

        setUserNameMap((prev) => ({
          ...prev,
          ...Object.fromEntries(entries),
        }));
      } catch (e) {
        console.error("Failed to resolve user names for history", e);
      }
    };

    fetchNames();
  }, [history]);

  useEffect(() => {
    const assigned = Array.isArray(lead?.assignedTo) ? lead!.assignedTo : [];

    if (assigned.length === 0) {
      setAssignedToNames([]);
      return;
    }

    const fetchAssignedUsers = async () => {
      try {
        const names = (
          await Promise.all(
            assigned.map(async (uid) => {
              const snap = await getDoc(doc(db, "users", uid));
              return snap.exists() ? snap.data()?.name ?? null : null;
            })
          )
        ).filter(Boolean);
        setAssignedToNames(names);
      } catch (e) {
        setAssignedToNames([]);
      }
    };

    fetchAssignedUsers();
  }, [lead?.assignedTo]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !lead?.id) return;

    try {
      const user = auth?.currentUser;
      if (!user) {
        console.error("Cannot add note: not authenticated");
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userName = userSnap.data()?.name || "Admin";

      const notesRef = collection(db, "leads", lead.id, "notes");

      await addDoc(notesRef, {
        // new unified schema
        text: newNote.trim(),
        by: user.uid,
        createdByName: userName,

        // legacy fields for backward compatibility
        content: newNote.trim(),
        createdBy: user.uid,

        createdAt: serverTimestamp(),
      });

      setNewNote("");
    } catch (err) {
      console.error("handleAddNote error:", err);
    }
  };

  if (!lead) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Lead Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold">{lead.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={lead.status} />
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{lead.phone || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
{lead.email ? (
  <a
    href={`mailto:${lead.email}`}
    className="font-medium text-blue-600 hover:underline"
    onClick={(e) => e.stopPropagation()}
  >
    {lead.email}
  </a>
) : (
  <p className="font-medium">—</p>
)}                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Company Email</p>
                    {lead.clientEmail ? (
  <a
    href={`mailto:${lead.clientEmail}`}
    className="font-medium text-blue-600 hover:underline"
    onClick={(e) => e.stopPropagation()}
  >
    {lead.clientEmail}
  </a>
) : (
  <p className="font-medium">—</p>
)}
                  </div>
                </div>
              </div>

              {/* Company Name */}
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Company Name</p>
                  <p className="font-medium">{lead.companyName || "—"}</p>
                </div>
              </div>
              {/* Requirement */}
              {/* Requirement */}
<div className="flex items-center gap-3">
  <Tag className="h-4 w-4 text-muted-foreground" />
  <div>
    <p className="text-sm text-muted-foreground">Requirement</p>
     <p className="font-medium line-clamp-2 break-words">
       {lead.requirement || "—"}
     </p>
  </div>
</div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Source</p>
                    <Badge variant="outline">{lead.source || "—"}</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Purpose</p>
                    <p className="font-medium">{lead.purpose || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <p className="font-medium">
                    {assignedToNames.length > 0 ? assignedToNames.join(", ") : "Unassigned"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Created At</p>
                  <p className="font-medium">{formatTimestamp(lead.createdAt)}</p>
                </div>
              </div>

              {lead.remarks && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Remarks</p>
                  <div className="p-3 bg-muted/20 rounded-md">
                    <p className="text-sm whitespace-pre-line">{lead.remarks}</p>
                  </div>
                </div>
              )}

              {lead.updatedAt && (
                <div className="flex items-center gap-3 mt-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-medium">{formatTimestamp(lead.updatedAt)}</p>
                  </div>
                </div>
              )}
              
              {(lead.followUpDate || lead.followUpTime) && (
                <div className="flex items-center gap-3 mt-4">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Follow-Up</p>
                    {lead.followUpDate && (
                      <p className="font-medium">
                        Date: {formatTimestamp(lead.followUpDate)}
                      </p>
                    )}
                    {lead.followUpTime && (
                      <p className="font-medium">
                        Time: {lead.followUpTime}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setHistoryOpen(true)}
              className="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              View History
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Lead History</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No history records.
              </p>
            )}

            {(() => {
              let lastDateLabel: string | null = null;
              return history.map((entry, idx) => {
                const currentLabel = getDateLabel(entry.createdAt);
                const showSeparator = currentLabel !== lastDateLabel;
                const separatorBlock = showSeparator ? (
                  <div key={`sep-${entry.id}`} className="mb-2">
                    <div className="flex justify-center">
                      <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wide">{currentLabel}</span>
                    </div>
                    <div className="border-t border-muted-foreground/10 mt-1 mb-1"></div>
                  </div>
                ) : null;
                lastDateLabel = currentLabel;
                return (
                  <div key={entry.id}>
                    {separatorBlock}
                    <div className="flex gap-3 border-b py-3 last:border-b-0">
                      <div className="pt-1 text-lg">
                        {(() => {
                          const t = normalizeType(entry.type);
                          return (
                            <>
                              {t === "transfer" && "🔁"}
                              {(t === "assignment" || t === "assignment_change") && "👥"}
                              {t === "status_change" && "🔄"}
                              {t === "tag_change" && "🏷️"}
                              {!["transfer","assignment","assignment_change","status_change","tag_change"].includes(t) && "•"}
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="font-medium leading-snug">
                          {renderHistoryText(entry, userNameMap)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          By {entry.byName || entry.byUid || "System"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
