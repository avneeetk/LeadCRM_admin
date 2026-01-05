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
  const [statuses, setStatuses] = useState<any[]>([]);
  const [newSource, setNewSource] = useState("");
  const [newPurpose, setNewPurpose] = useState("");
  const [newStatus, setNewStatus] = useState("");

  // 🔹 Real-time Firestore Sync
  useEffect(() => {
    // To avoid memory leaks with async in onSnapshot, use a flag
    let cancelled = false;
    const unsub = onSnapshot(collection(db, "leads"), (snap) => {
      // For each doc, fetch notes count in parallel, then setLeads after all are ready
      const fetchLeadsWithNotes = async () => {
        const leadsData: Lead[] = await Promise.all(
          snap.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const leadData: Lead = {
              id: docSnap.id,
              name: data.name || data.raw_payload?.name || "",
              phone: data.phone || data.raw_payload?.phone || "",
              email: data.email || data.raw_payload?.email || "",
              city: data.city || data.raw_payload?.city || "",
              source: data.source || data.raw_payload?.source || "",
              status: String(data.status || "new").toLowerCase(),
              assignedTo: data.assignedTo || "",
              createdAt: data.createdAt || data.created_at || null,
              updatedAt: data.updatedAt || data.updated_at || null,
              purpose: data.purpose || "",
              address: data.address || "",
              state: data.state || "",
              country: data.country || "",
              remarks: data.remarks || "",
              ...data,
            };
            // Get notes count for each lead
            try {
              const notesSnap = await getDocs(collection(db, "leads", docSnap.id, "notes"));
              leadData.notesCount = notesSnap.size;
            } catch (err) {
              console.error(`Error getting notes for lead ${docSnap.id}:`, err);
              leadData.notesCount = 0;
            }
            return leadData;
          })
        );
        // Sort by createdAt/created_at descending (latest first)
        leadsData.sort((a: any, b: any) => {
          const ta = a.createdAt?.toMillis?.() ?? a.created_at?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? b.created_at?.toMillis?.() ?? 0;
          return tb - ta;
        });
        if (!cancelled) setLeads(leadsData);
      };
      fetchLeadsWithNotes();
    });
    // Sources listener
    const unsubSources = onSnapshot(collection(db, "lead_sources"), (snap) => {
      setSources(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    // Purposes listener
    const unsubPurposes = onSnapshot(collection(db, "lead_purposes"), (snap) => {
      setPurposes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    // Statuses listener
    const unsubStatuses = onSnapshot(collection(db, "lead_statuses"), (snap) => {
      setStatuses(
        snap.docs.map(d => ({
          id: d.id,
          name: String(d.data().name || "").toLowerCase(),
        }))
      );
    });
    // Users loader
    (async () => {
      const snapUsers = await getDocs(collection(db, "users"));
      setUsers(snapUsers.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
    return () => {
      cancelled = true;
      unsub();
      unsubSources();
      unsubPurposes();
      unsubStatuses();
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
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      lead.name?.toLowerCase().includes(q) ||
      lead.phone?.toLowerCase().includes(q) ||
      lead.email?.toLowerCase().includes(q) ||
      lead.source?.toLowerCase().includes(q) ||
      lead.status?.toLowerCase().includes(q) ||
      lead.assignedTo?.toLowerCase().includes(q) ||
      lead.purpose?.toLowerCase().includes(q) ||
      lead.city?.toLowerCase().includes(q) ||
      lead.state?.toLowerCase().includes(q) ||
      lead.country?.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" ||
      lead.status?.toLowerCase() === statusFilter.toLowerCase();
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

  const statusesList = ["all", "new", "contacted", "follow-up", "hot", "closed", "lost"];

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

  // Status helpers
  const addStatus = async () => {
    if (!newStatus.trim()) return;
    await addDoc(collection(db, "lead_statuses"), {
      name: newStatus,
      createdAt: serverTimestamp(),
    });
    setNewStatus("");
  };

  const deleteStatus = async (id: string) => {
    await deleteDoc(doc(db, "lead_statuses", id));
  };

  return (
    <DashboardLayout title="Lead Manager">
      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="lookups">Sources &amp; Purposes</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
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
                <SelectItem value="all">All</SelectItem>
                {statuses.map((s) => {
                  const statusName = s.name || s; // Fallback to s in case it's a string
                  const statusKey = s.id ? `${s.id}-${statusName}` : statusName; // Use ID if available, fallback to name
                  return (
                    <SelectItem key={statusKey} value={statusName}>
                      {String(statusName).charAt(0).toUpperCase() + String(statusName).slice(1)}
                    </SelectItem>
                  );
                })}
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
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {lead.status === "new" && !lead.assignedTo && (
                        <span className="h-2 w-2 rounded-full bg-blue-600" />
                      )}
                      <span>{lead.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{lead.phone}</TableCell>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell>{lead.source}</TableCell>
                  <TableCell>
                    {lead.status === "new" && !lead.assignedTo ? (
                      <Badge className="bg-blue-600 text-white">NEW</Badge>
                    ) : (
                      <Badge variant="outline">
                        {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                      </Badge>
                    )}
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

        <TabsContent value="status">
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-semibold">Manage Lead Status</h2>
            <div className="max-w-md space-y-3 border p-4 rounded-md">
              <Input
                placeholder="Add new status..."
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              />
              <Button onClick={addStatus}>Add Status</Button>

              <ul className="mt-3 space-y-1">
                {statuses.map((s) => (
                  <li
                    key={s.id}
                    className="flex justify-between items-center border p-2 rounded"
                  >
                    <span>{s.name}</span>
                    {s.name?.toLowerCase() !== "new" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteStatus(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">System</span>
                    )}
                  </li>
                ))}
              </ul>

              <p className="text-xs text-muted-foreground">
                Note: <strong>NEW</strong> status is system-defined and not editable.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}