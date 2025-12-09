import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { Lead } from "@/lib/mockData";
import { Mail, Phone, DollarSign, Calendar, User, Tag } from "lucide-react";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

  const handleAddNote = async () => {
    if (!newNote.trim() || !lead?.id) return;

    try {
      const uid = auth?.currentUser?.uid;
      if (!uid) {
        console.error("Cannot add note: not authenticated");
        return;
      }

      const notesRef = collection(db, "leads", lead.id, "notes");

      // Firestore rules expect `content` and `createdBy` for agent-created notes
      await addDoc(notesRef, {
        content: newNote.trim(),
        createdBy: uid,
        createdAt: serverTimestamp(),
      });

      setNewNote("");
    } catch (err) {
      console.error("handleAddNote error:", err);
      // If you have a toast in scope you can show a friendly error here
    }
  };

  if (!lead) return null;

  return (
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

            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{lead.email || "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Source</p>
                <Badge variant="outline">{lead.source || "—"}</Badge>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Budget</p>
                <p className="font-medium">{lead.budget ?? "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Assigned To</p>
                <p className="font-medium">{lead.assignedToName || lead.assignedTo || "Unassigned"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Created At</p>
                <p className="font-medium">{formatTimestamp(lead.createdAt)}</p>
              </div>
            </div>

            {lead.updatedAt && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{formatTimestamp(lead.updatedAt)}</p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Notes & Activity</h4>

            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
              {notes.length === 0 && (
                <p className="text-sm text-muted-foreground">No notes yet for this lead.</p>
              )}

              {notes.map((note) => (
                <div key={note.id} className="p-3 rounded-md border bg-muted/30">
                  <p className="text-sm font-medium">{note.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {note.createdBy === 'admin'
                      ? 'Admin'
                      : note.createdBy === auth?.currentUser?.uid
                        ? 'You'
                        : (note.createdByName || note.createdBy || 'Agent')
                    } • {formatTimestamp(note.createdAt)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Write a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <Button onClick={handleAddNote}>Send</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
