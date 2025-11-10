import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface Invoice {
  id?: string;
  invoiceNo: string;
  leadName: string;
  leadNumber?: string;
  issuedDate: string;
  amount?: string | number;
  billingAddress?: string;
  shippingAddress?: string;
  bankDetails?: string;
  type?: "active" | "passive";
  description?: string;
  gst?: string | number;
  notes?: string;
  status?: string;
}

interface InvoiceViewModalProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceViewModal({ invoice, open, onOpenChange }: InvoiceViewModalProps) {
  if (!invoice) return null;

  // 🔹 Dynamic GST and total calculation
  const amount = Number(invoice.amount) || 0;
  const gstRate = invoice.gst ? parseFloat(String(invoice.gst).replace(/[^0-9.]/g, "")) : 18;
  const gstAmount = (amount * gstRate) / 100;
  const totalAmount = amount + gstAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice Preview</DialogTitle>
        </DialogHeader>

        <div className="bg-background p-8 rounded-lg border">
          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold">TAX INVOICE</h1>
          </div>

          {/* Company Info */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-primary mb-1">EVINE BUSINESS SERVICES</h2>
            <p className="text-xs">
              Branch Office: House No 27, Ground Floor, Arjun Nagar, Near Green Park, New Delhi 110029
            </p>
          </div>

          <Separator className="my-4" />

          {/* Client + Invoice Info */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="font-semibold mb-3">Client Details</h3>
              <div className="space-y-1 text-sm">
                <p><span className="font-semibold">Name:</span> {invoice.leadName}</p>
                {invoice.billingAddress && <p><span className="font-semibold">Address:</span> {invoice.billingAddress}</p>}
                {invoice.shippingAddress && <p><span className="font-semibold">Shipping:</span> {invoice.shippingAddress}</p>}
                <p><span className="font-semibold">GSTIN:</span> {invoice.gst || "—"}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="border border-border p-2">
                <p className="font-semibold">INVOICE NO.</p>
                <p className="text-base font-medium">{invoice.invoiceNo}</p>
              </div>
              <div className="border border-border p-2">
                <p className="font-semibold">INVOICE DATE</p>
                <p>{new Date(invoice.issuedDate).toLocaleDateString("en-GB")}</p>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Services Table */}
          <div className="mb-6">
            <table className="w-full border border-border">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left p-3 text-sm border-r border-border">SR. NO.</th>
                  <th className="text-left p-3 text-sm border-r border-border">DESCRIPTION</th>
                  <th className="text-right p-3 text-sm">AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3 border-r border-border">1</td>
                  <td className="p-3 border-r border-border">
                    {invoice.description || "Professional Services / Broking Commission"}
                  </td>
                  <td className="text-right p-3 font-medium">
                    ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals + Notes */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="font-semibold mb-2">Special Notes</h3>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>Please pay Commission on the date of invoice.</li>
                <li>Disputes under New Delhi Jurisdiction only.</li>
                <li>Delay penalty ₹500/day after due date.</li>
              </ul>
            </div>

            <div>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 font-semibold">Total Invoice Value</td>
                    <td className="text-right py-2">₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Add – GST @{gstRate}%</td>
                    <td className="text-right py-2">₹{gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold">Net Invoice Value</td>
                    <td className="text-right py-2 font-bold">
                      ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes in Words */}
          <div className="mb-6">
            <p className="text-sm">
              <span className="font-semibold">Rupees in words:</span>{" "}
              {invoice.notes || "Rupees amount in words"}
            </p>
          </div>

          <Separator className="my-4" />

          {/* Footer: Statutory Details */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="font-semibold mb-2">Our Statutory Details</h3>
              <p className="text-sm">Service Category: Real Estate Agent</p>
              <p className="text-sm">GSTIN: 07AWMPK7809H1Z5</p>
              <p className="text-sm">PAN: AWMPK7809H</p>
            </div>
            <div className="text-right">
              <p className="font-semibold mb-1">FOR EVINE BUSINESS SERVICES</p>
              <div className="mt-12 inline-block">
                <div className="border-t-2 border-foreground pt-2 px-8">
                  <p className="font-semibold">Authorized Signatory</p>
                  <p className="text-sm">Narinder Singh</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Bank Details</h3>
            <div className="bg-muted p-4 rounded text-sm grid grid-cols-2 gap-x-8 gap-y-1">
              <p><span className="font-semibold">Account Name:</span> EVINE BUSINESS SERVICES</p>
              <p><span className="font-semibold">Account Number:</span> 50200063151328</p>
              <p><span className="font-semibold">IFSC:</span> HDFC0000485</p>
              <p><span className="font-semibold">Bank Name:</span> HDFC BANK</p>
              <p className="col-span-2"><span className="font-semibold">Branch:</span> UDYOG VIHAR, GURUGRAM</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t text-center text-xs">
            <p>Ph. 9999568224 | Email: narinder@evinebs.com</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => window.print()}>Print Invoice</Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}