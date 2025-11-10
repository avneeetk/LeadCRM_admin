import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Plus, Pencil, Eye, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { listenInvoices, addInvoice, updateInvoice, deleteInvoice } from "@/lib/firestore/invoices";
import { InvoiceViewModal } from "@/components/InvoiceViewModal";

export default function Sales() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [invoicesPerPage, setInvoicesPerPage] = useState(10);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);

  const emptyForm = {
    invoiceNo: "",
    issuedDate: new Date().toISOString().split("T")[0],
    leadName: "",
    leadNumber: "",
    billingAddress: "",
    shippingAddress: "",
    amount: "",
    gst: "18",
    bankDetails:
      "Bank Name: HDFC Bank\nA/C No: 50200063151328\nIFSC: HDFC0000485\nBranch: Udyog Vihar, Gurugram",
    description: "",
    notes: "Payment due within 30 days.",
    status: "active" as "active" | "paid" | "pending" | "overdue",
  };

  const [formData, setFormData] = useState({ ...emptyForm });

  // 🔹 Real-time listener
  useEffect(() => {
    const unsub = listenInvoices(setInvoices);
    return () => unsub();
  }, []);

  const filteredInvoices = invoices.filter((inv) => {
    const s = searchQuery.toLowerCase();
    const matchesSearch =
      inv.leadName?.toLowerCase().includes(s) ||
      inv.leadNumber?.includes(searchQuery) ||
      inv.invoiceNo?.toLowerCase().includes(s);
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / invoicesPerPage));
  const startIndex = (currentPage - 1) * invoicesPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + invoicesPerPage);

  // Reset current page if filteredInvoices or invoicesPerPage changes and currentPage is out of range
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredInvoices.length, invoicesPerPage, totalPages, currentPage]);

  // 🟩 Create
  const handleAddInvoice = async () => {
    if (!formData.leadName || !formData.amount) {
      toast.error("Client name and amount are required");
      return;
    }
    try {
      await addInvoice(formData);
      toast.success("Invoice created successfully");
      setIsCreateModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create invoice");
    }
  };

  // 🟦 Edit
  const handleEditInvoice = async () => {
    if (!selectedInvoice?.id) return toast.error("No invoice selected");
    try {
      await updateInvoice(selectedInvoice.id, formData);
      toast.success("Invoice updated successfully");
      setIsEditModalOpen(false);
      setSelectedInvoice(null);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update invoice");
    }
  };

  // 🟥 Delete
  const handleDeleteInvoice = async (id: string) => {
    try {
      await deleteInvoice(id);
      toast.success("Invoice deleted successfully");
      setDeleteInvoiceId(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete invoice");
    }
  };

  const resetForm = () => setFormData({ ...emptyForm });

  // 🧾 CSV Export
  const handleExportCSV = () => {
    if (!filteredInvoices.length) return toast.info("No data to export");
    const csv = [
      ["Invoice No", "Client", "Date", "Amount", "Status"].join(","),
      ...filteredInvoices.map((i) =>
        [i.invoiceNo, i.leadName, i.issuedDate, i.amount, i.status].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "invoices.csv";
    link.click();
  };

  return (
    <DashboardLayout title="Sales / Invoices">
      <Card className="p-6">
        {/* Header Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button onClick={() => { resetForm(); setIsCreateModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Create Invoice
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <Input
            placeholder="Search invoice or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Invoices Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sno</TableHead>
                <TableHead>Invoice No</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInvoices.map((inv, idx) => (
                <TableRow key={inv.id}>
                  <TableCell>{startIndex + idx + 1}</TableCell>
                  <TableCell>{inv.invoiceNo}</TableCell>
                  <TableCell>{inv.leadName}</TableCell>
                  <TableCell>{inv.issuedDate}</TableCell>
                  <TableCell>₹{parseFloat(inv.amount).toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        inv.status === "paid"
                          ? "default"
                          : inv.status === "pending"
                          ? "secondary"
                          : inv.status === "overdue"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setIsViewModalOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setFormData({ ...inv });
                          setIsEditModalOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteInvoiceId(inv.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {/* Pagination Controls */}
          <div className="flex items-center justify-between p-4 border-t">
            <div className="flex items-center gap-2">
              <Label htmlFor="rowsPerPageSelect">Rows per page:</Label>
              <Select
                id="rowsPerPageSelect"
                value={invoicesPerPage.toString()}
                onValueChange={(value) => {
                  setInvoicesPerPage(parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              >
                Previous
              </Button>
              <span>
                Showing {filteredInvoices.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + invoicesPerPage, filteredInvoices.length)} of {filteredInvoices.length} invoices
              </span>
              <Button
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* 🧾 Create/Edit Modal Shared Form */}
      <Dialog open={isCreateModalOpen || isEditModalOpen} onOpenChange={(open) => {
        if (!open) { setIsCreateModalOpen(false); setIsEditModalOpen(false); }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreateModalOpen ? "Create New Invoice" : "Edit Invoice"}
            </DialogTitle>
          </DialogHeader>

          {/* Shared form fields */}
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice No</Label>
                <Input
                  value={formData.invoiceNo}
                  onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
                  placeholder="EBS/25-26/004"
                />
              </div>
              <div>
                <Label>Issued Date</Label>
                <Input
                  type="date"
                  value={formData.issuedDate}
                  onChange={(e) => setFormData({ ...formData, issuedDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Client Name *</Label>
              <Input
                value={formData.leadName}
                onChange={(e) => setFormData({ ...formData, leadName: e.target.value })}
                placeholder="Enter client name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client Number</Label>
                <Input
                  value={formData.leadNumber}
                  onChange={(e) => setFormData({ ...formData, leadNumber: e.target.value })}
                  placeholder="Enter client number"
                />
              </div>
              <div>
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Enter amount"
                />
              </div>
            </div>

            <div>
              <Label>Billing Address</Label>
              <Textarea
                value={formData.billingAddress}
                onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
              />
            </div>

            <div>
              <Label>Shipping Address</Label>
              <Textarea
                value={formData.shippingAddress}
                onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <Label>GST (%)</Label>
              <Input
                type="number"
                value={formData.gst}
                onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
              />
            </div>

            <div>
              <Label>Bank Details</Label>
              <Textarea
                value={formData.bankDetails}
                onChange={(e) => setFormData({ ...formData, bankDetails: e.target.value })}
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={isCreateModalOpen ? handleAddInvoice : handleEditInvoice}>
              {isCreateModalOpen ? "Save Invoice" : "Update Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice View */}
      <InvoiceViewModal invoice={selectedInvoice} open={isViewModalOpen} onOpenChange={setIsViewModalOpen} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteInvoiceId} onOpenChange={() => setDeleteInvoiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteInvoiceId && handleDeleteInvoice(deleteInvoiceId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}