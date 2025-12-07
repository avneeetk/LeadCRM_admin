import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  FileText, Users, CheckCircle2, XCircle, UserCheck,
  Edit, Eye, Trash2, Clock, TrendingUp, Target,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useDashboardData } from "@/lib/useDashboardData";
import { LeadViewModal } from "@/components/LeadViewModal";
import { LeadEditModal } from "@/components/LeadEditModal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { deleteDoc, doc } from "firebase/firestore";

export default function Dashboard() {
  const { kpiData, leadsByStatus, leadsByAgent, recentLeads, loading } = useDashboardData();

  const [viewLead, setViewLead] = useState<any | null>(null);
  const [editLead, setEditLead] = useState<any | null>(null);
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const leadsPerPage = 5;

  const paginatedLeads = recentLeads.slice((page - 1) * leadsPerPage, page * leadsPerPage);

  const handleDeleteLead = async () => {
    try {
      if (deleteLeadId) {
        await deleteDoc(doc(db, "leads", deleteLeadId));
        toast.success("Lead deleted successfully");
      }
    } catch {
      toast.error("Error deleting lead");
    } finally {
      setDeleteLeadId(null);
    }
  };

  return (
    <DashboardLayout
      title="Dashboard"
      actions={
        <Select defaultValue="7">
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="15">Last 15 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="space-y-6">
        {/* KPI CARDS */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <KPICard title="Total Leads" value={kpiData.totalLeads} icon={FileText} variant="info" />
          <KPICard title="Active Leads" value={kpiData.activeLeads} icon={UserCheck} variant="success" />
          <KPICard title="Closed Deals" value={kpiData.closedDeals} icon={CheckCircle2} variant="success" />
          <KPICard title="Lost Leads" value={kpiData.lostLeads} icon={XCircle} variant="destructive" />
          <KPICard title="Employees Present" value={kpiData.employeesPresent} icon={Users} variant="default" />
        </div>

        {/* ANALYTICS SUMMARY */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Lead Conversion Rate" value={`${kpiData.conversionRate}%`} icon={TrendingUp} variant="success" />
          <KPICard title="Qualified Leads" value={kpiData.qualifiedLeads} icon={Target} variant="info" />
          <KPICard title="Follow-Up Rate" value={`${kpiData.followUpRate}%`} icon={CheckCircle2} variant="warning" />
          <KPICard title="Avg Time to Conversion" value={`${kpiData.avgTimeToConversion} days`} icon={Clock} variant="default" />
        </div>

        {/* CHARTS */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Leads by Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={leadsByStatus}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Leads per Agent</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={leadsByAgent}
                    cx="50%"
                    cy="50%"
                    label={({ agent, leads }) => `${agent}: ${leads}`}
                    outerRadius={100}
                    dataKey="leads"
                  >
                    {leadsByAgent.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* RECENT LEADS */}
        <Card>
          <CardHeader><CardTitle>Recent Leads</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-10 text-muted-foreground">Loading leads...</p>
            ) : paginatedLeads.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground">No recent leads found.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Date Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>{lead.name}</TableCell>
                        <TableCell>{lead.phone}</TableCell>
                        <TableCell><StatusBadge status={lead.status} /></TableCell>
                        <TableCell>{lead.assignedToName}</TableCell>
                        <TableCell>
                          {lead._createdAt
                            ? lead._createdAt.toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setViewLead(lead)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setEditLead(lead)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteLeadId(lead.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex justify-end gap-2 mt-4">
                  <Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <Button disabled={page * leadsPerPage >= recentLeads.length} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MODALS */}
      <LeadViewModal lead={viewLead} open={!!viewLead} onOpenChange={(open) => !open && setViewLead(null)} />
      <LeadEditModal lead={editLead} open={!!editLead} onOpenChange={(open) => !open && setEditLead(null)} onSave={() => {
        toast.success("Lead updated successfully");
        setEditLead(null);
      }} />

      {/* DELETE CONFIRMATION */}
      <AlertDialog open={!!deleteLeadId} onOpenChange={(open) => !open && setDeleteLeadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLead}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}