import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";

interface LeadNotesModalProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatTimestamp(ts: any): string {
  if (!ts) return "—";
  if (typeof ts?.toDate === "function") return ts.toDate().toLocaleString();
  if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleString();
  return "—";
}

export function LeadNotesModal({ leadId, open, onOpenChange }: LeadNotesModalProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    if (!leadId || !open) return;

    const q = query(
      collection(db, "leads", leadId, "notes"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [leadId, open]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    const user = auth.currentUser;
    if (!user) return;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    const userName = userSnap.data()?.name || "Admin";

    await addDoc(collection(db, "leads", leadId, "notes"), {
      text: newNote.trim(),
      by: user.uid,
      createdByName: userName,
      content: newNote.trim(),   // legacy
      createdBy: user.uid,       // legacy
      createdAt: serverTimestamp(),
    });

    setNewNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Notes</DialogTitle>
        </DialogHeader>

        {/* NOTES LIST */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground">No notes yet</p>
          )}

          {notes.map((note) => {
            const isMe =
              note.by === auth.currentUser?.uid ||
              note.createdBy === auth.currentUser?.uid;

            return (
              <div
                key={note.id}
                className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                  isMe
                    ? "ml-auto bg-blue-100 text-right"
                    : "mr-auto bg-muted/40"
                }`}
              >
                <p className="whitespace-pre-line">
                  {note.text || note.content}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {note.createdByName || "Agent"} •{" "}
                  {formatTimestamp(note.createdAt)}
                </p>
              </div>
            );
          })}
        </div>

        {/* INPUT */}
        <div className="pt-3 border-t flex gap-2">
          <Input
            placeholder="Write a note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <Button onClick={handleAddNote} disabled={!newNote.trim()}>
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}