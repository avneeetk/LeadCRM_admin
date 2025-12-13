import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Eye, Pencil, Plus, Trash2, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { toast } from "sonner";
import { LeadViewModal } from "@/components/LeadViewModal";
import { LeadEditModal } from "@/components/LeadEditModal";
import { AddLeadModal } from "@/components/AddLeadModal";
import { LeadNotesModal } from "@/components/LeadNotesModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  status: string;
  assignedTo: string;
  createdAt: any;
  updatedAt?: any;
  purpose?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  remarks?: string;
  notesCount?: number;
}

interface NotesBadgeProps {
  leadId: string;
  onOpenNotes: (leadId: string) => void;
  count: number;
}

function NotesBadge({ leadId, onOpenNotes, count }: NotesBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);


  return (
    <button
      className={`relative inline-flex items-center justify-center p-1 rounded-full ${count > 0 ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
      title={count > 0 ? `View ${count} note${count !== 1 ? 's' : ''}` : 'Add a note'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onOpenNotes(leadId);
      }}
    >
      <MessageSquare className={`h-5 w-5 ${isHovered ? 'text-blue-600' : ''}`} />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
          {count}
        </span>
      )}
    </button>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage, setLeadsPerPage] = useState(10);

  const [sources, setSources] = useState<any[]>([]);
  const [purposes, setPurposes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newSource, setNewSource] = useState("");
  const [newPurpose, setNewPurpose] = useState("");

  // 🔹 Real-time Firestore Sync
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "leads"), async (snap) => {
      const leadsData = [];
      
      for (const doc of snap.docs) {
        const leadData = { id: doc.id, ...doc.data() } as Lead;
        
        // Get notes count for each lead
        try {
          const notesSnap = await getDocs(collection(db, "leads", doc.id, "notes"));
          leadData.notesCount = notesSnap.size;
        } catch (err) {
          console.error(`Error getting notes for lead ${doc.id}:`, err);
          leadData.notesCount = 0;
        }
        
        leadsData.push(leadData);
      }
      
      setLeads(leadsData);
    });
    // Sources listener
    const unsubSources = onSnapshot(collection(db, "lead_sources"), (snap) => {
      setSources(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    // Purposes listener
    const unsubPurposes = onSnapshot(collection(db, "lead_purposes"), (snap) => {
      setPurposes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    // Users loader
    (async () => {
      const snapUsers = await getDocs(collection(db, "users"));
      setUsers(snapUsers.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
    return () => {
      unsub();
      unsubSources();
      unsubPurposes();
    };
  }, []);

  // 🔹 CRUD Ops
  const handleAddLead = async (newLead: Lead) => {
    try {
      await addDoc(collection(db, "leads"), {
        ...newLead,
        createdAt: serverTimestamp(),
      });
      toast.success("Lead added successfully");
    } catch (err) {
      toast.error("Failed to add lead");
      console.error(err);
    }
  };

  const handleSaveLead = async (updatedLead: Lead) => {
    try {
      const ref = doc(db, "leads", updatedLead.id);
      await updateDoc(ref, { ...updatedLead, updatedAt: serverTimestamp() });
      toast.success("Lead updated successfully");
    } catch (err) {
      console.error("Error updating lead:", err);
      toast.error("Failed to update lead");
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      await deleteDoc(doc(db, "leads", leadId));
      toast.success("Lead deleted successfully");
    } catch (err) {
      toast.error("Error deleting lead");
      console.error(err);
    }
  };

  // 🔹 Filtering Logic
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 🔹 Pagination Logic
  const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);
  const startIndex = (currentPage - 1) * leadsPerPage;
  const currentLeads = filteredLeads.slice(startIndex, startIndex + leadsPerPage);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const statuses = ["all", "new", "contacted", "follow-up", "hot", "closed", "lost"];

  // Sources & Purposes helpers
  const addSource = async () => {
    if (!newSource.trim()) return;
    await addDoc(collection(db, "lead_sources"), { name: newSource });
    setNewSource("");
  };

  const addPurpose = async () => {
    if (!newPurpose.trim()) return;
    await addDoc(collection(db, "lead_purposes"), { name: newPurpose });
    setNewPurpose("");
  };

  const deleteSource = async (id: string) => {
    await deleteDoc(doc(db, "lead_sources", id));
  };

  const deletePurpose = async (id: string) => {
    await deleteDoc(doc(db, "lead_purposes", id));
  };

  return (
    <DashboardLayout title="Lead Manager">
      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="lookups">Sources &amp; Purposes</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
      <Card className="p-6">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
          <Input
            placeholder="Search by name, phone, or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-72"
          />
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(leadsPerPage)} onValueChange={(v) => setLeadsPerPage(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Rows" />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 20, 50].map((num) => (
                  <SelectItem key={num} value={String(num)}>
                    {num} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Lead
            </Button>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>{lead.name}</TableCell>
                  <TableCell>{lead.phone}</TableCell>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell>{lead.source}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{lead.status}</Badge>
                  </TableCell>
                  <TableCell>{users.find(u => u.id === lead.assignedTo)?.name || lead.assignedTo}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <NotesBadge 
                        leadId={lead.id}
                        count={lead.notesCount || 0}
                        onOpenNotes={(id) => {
                          setSelectedLeadId(id);
                          setNotesModalOpen(true);
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {lead.createdAt?.toDate
                      ? lead.createdAt.toDate().toLocaleDateString()
                      : ""}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedLead(lead);
                          setIsViewModalOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedLead(lead);
                          setIsEditModalOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteLeadId(lead.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {currentLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                    No leads found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
          <p>
            Showing {startIndex + 1}–{Math.min(startIndex + leadsPerPage, filteredLeads.length)} of {filteredLeads.length} leads
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => goToPage(currentPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* 🔹 Modals */}
      <LeadViewModal lead={selectedLead} open={isViewModalOpen} onOpenChange={setIsViewModalOpen} />
      <LeadEditModal lead={selectedLead} open={isEditModalOpen} onOpenChange={setIsEditModalOpen} onSave={handleSaveLead} />
      <AddLeadModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} onAddLead={handleAddLead} />
      
      {/* Notes Modal */}
      {selectedLeadId && (
        <LeadNotesModal
          leadId={selectedLeadId}
          open={notesModalOpen}
          onOpenChange={setNotesModalOpen}
        />
      )}

      {/* 🔹 Delete Confirmation */}
      <AlertDialog open={!!deleteLeadId} onOpenChange={(open) => !open && setDeleteLeadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteLeadId && handleDeleteLead(deleteLeadId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        </TabsContent>

        <TabsContent value="lookups">
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-semibold">Manage Sources & Purposes</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Sources */}
              <div className="space-y-3 border p-4 rounded-md">
                <h3 className="font-medium">Sources</h3>

                <Input
                  placeholder="Add new source..."
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                />
                <Button onClick={addSource}>Add Source</Button>

                <ul className="mt-3 space-y-1">
                  {sources.map((s) => (
                    <li key={s.id} className="flex justify-between items-center border p-2 rounded">
                      <span>{s.name}</span>
                      <Button variant="ghost" size="icon" onClick={() => deleteSource(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Purposes */}
              <div className="space-y-3 border p-4 rounded-md">
                <h3 className="font-medium">Purposes</h3>

                <Input
                  placeholder="Add new purpose..."
                  value={newPurpose}
                  onChange={(e) => setNewPurpose(e.target.value)}
                />
                <Button onClick={addPurpose}>Add Purpose</Button>

                <ul className="mt-3 space-y-1">
                  {purposes.map((p) => (
                    <li key={p.id} className="flex justify-between items-center border p-2 rounded">
                      <span>{p.name}</span>
                      <Button variant="ghost" size="icon" onClick={() => deletePurpose(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}