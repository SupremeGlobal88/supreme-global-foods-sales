import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "@/lib/localTrpcClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Printer, FileText, CheckCircle } from "lucide-react";
import { reloadFromStorage } from "@/lib/dataService";

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const poId = Number(id);

  const { data: po, isLoading } = trpc.purchaseOrder.getById.useQuery(poId);
  const { data: corpCustomer } = trpc.corporateCustomer.getById.useQuery(
    po?.corporateCustomerId ?? 0,
    { enabled: !!po?.corporateCustomerId }
  );
  const { data: invoices } = trpc.invoice.list.useQuery();
  const linkedInvoice = useMemo(
    () => invoices?.find((inv) => inv.purchaseOrderId === poId),
    [invoices, poId]
  );

  const [lineItems, setLineItems] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("30_days");
  const [status, setStatus] = useState("draft");
  const [company, setCompany] = useState("sgf");

  useEffect(() => {
    if (po) {
      setLineItems(po.lineItems || []);
      setDeliveryDate(po.deliveryDate || "");
      setPaymentTerms(po.paymentTerms || "30_days");
      setStatus(po.status || "draft");
      setCompany(po.company || "sgf");
    }
  }, [po]);

  const updatePO = trpc.purchaseOrder.update.useMutation({
    onSuccess: () => {
      utils.purchaseOrder.getById.invalidate(poId);
      alert("Purchase Order updated successfully!");
      setEditMode(false);
      setSaving(false);
    },
  });

  const deletePO = trpc.purchaseOrder.delete.useMutation({
    onSuccess: () => {
      alert("Purchase Order deleted successfully!");
      navigate("/purchase-orders");
    },
  });

  const generateInvForPO = trpc.invoice.generateForPO.useMutation({
    onSuccess: async (invNum) => {
      if (invNum) {
        reloadFromStorage();
        await utils.invoice.list.invalidate();
        alert(`Invoice ${invNum} generated successfully!`);
      } else {
        alert("Invoice generation returned empty — check browser console for details.");
      }
    },
    onError: (err) => {
      console.error("[GenerateInvoicePO] Mutation error:", err);
      alert(`Failed to generate invoice: ${err.message}`);
    },
  });

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: Date.now(),
        customerStockCode: "",
        customerDescription: "",
        quantity: 1,
        unitPrice: 0,
        batchNumber: "",
        expiryDate: "",
      },
    ]);
  };

  const updateLineItem = (idx: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setLineItems(updated);
  };

  const removeLineItem = (idx: number) => {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    await updatePO.mutateAsync({
      id: poId,
      data: {
        lineItems,
        deliveryDate,
        paymentTerms,
        status,
        company,
      },
    });
  };

  const subtotal = lineItems.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
    0
  );
  const vatRate = corpCustomer?.vatExempt ? 0 : 0.15;
  const vatAmount = subtotal * vatRate;
  const total = subtotal + vatAmount;

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!po) return <div className="p-6">Purchase Order not found.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/purchase-orders")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold">PO: {po.poNumber}</h1>
          <Badge variant={po.status === "confirmed" ? "default" : "secondary"}>{po.status}</Badge>
        </div>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <Button variant="outline" onClick={() => setEditMode(true)}>Edit</Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive"><Trash2 className="w-4 h-4 mr-1" /> Delete</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Purchase Order?</DialogTitle>
                  </DialogHeader>
                  <p>Are you sure you want to delete this purchase order?</p>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => {}}>Cancel</Button>
                    <Button variant="destructive" onClick={() => deletePO.mutate(poId)}>Delete</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              <CheckCircle className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{po.corporateCustomerName}</p>
            {corpCustomer && (
              <>
                <p className="text-sm text-muted-foreground">{corpCustomer.contactPerson}</p>
                <p className="text-sm text-muted-foreground">{corpCustomer.email}</p>
                <p className="text-sm text-muted-foreground">{corpCustomer.phone}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>PO Details</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {editMode ? (
              <>
                <div>
                  <Label>Delivery Date</Label>
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                </div>
                <div>
                  <Label>Payment Terms</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7_days">7 Days</SelectItem>
                      <SelectItem value="14_days">14 Days</SelectItem>
                      <SelectItem value="30_days">30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Company</Label>
                  <Select value={company} onValueChange={setCompany}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sgf">SGF</SelectItem>
                      <SelectItem value="rc">RC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <p><strong>Delivery Date:</strong> {po.deliveryDate || "Not set"}</p>
                <p><strong>Payment Terms:</strong> {po.paymentTerms === "30_days" ? "30 Days" : po.paymentTerms === "14_days" ? "14 Days" : po.paymentTerms === "7_days" ? "7 Days" : po.paymentTerms}</p>
                <p><strong>Status:</strong> {po.status}</p>
                <p><strong>Company:</strong> {po.company?.toUpperCase() || "SGF"}</p>
                <p><strong>Created:</strong> {new Date(po.createdAt).toLocaleDateString()}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p><strong>Subtotal:</strong> R{subtotal.toFixed(2)}</p>
            <p><strong>VAT ({(vatRate * 100).toFixed(0)}%):</strong> R{vatAmount.toFixed(2)}</p>
            <p className="text-lg font-bold"><strong>Total:</strong> R{total.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          {editMode && (
            <Button size="sm" onClick={addLineItem}><Plus className="w-4 h-4 mr-1" /> Add Line</Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stock Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Batch #</TableHead>
                <TableHead>Expiry</TableHead>
                {editMode && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item, idx) => (
                <TableRow key={item.id || idx}>
                  <TableCell>
                    {editMode ? (
                      <Input value={item.customerStockCode || ""} onChange={(e) => updateLineItem(idx, "customerStockCode", e.target.value)} />
                    ) : (
                      item.customerStockCode
                    )}
                  </TableCell>
                  <TableCell>
                    {editMode ? (
                      <Input value={item.customerDescription || ""} onChange={(e) => updateLineItem(idx, "customerDescription", e.target.value)} />
                    ) : (
                      item.customerDescription
                    )}
                  </TableCell>
                  <TableCell>
                    {editMode ? (
                      <Input type="number" value={item.quantity || 0} onChange={(e) => updateLineItem(idx, "quantity", Number(e.target.value))} className="w-20" />
                    ) : (
                      item.quantity
                    )}
                  </TableCell>
                  <TableCell>
                    {editMode ? (
                      <Input type="number" value={item.unitPrice || 0} onChange={(e) => updateLineItem(idx, "unitPrice", Number(e.target.value))} className="w-24" />
                    ) : (
                      `R${(item.unitPrice || 0).toFixed(2)}`
                    )}
                  </TableCell>
                  <TableCell>R{((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}</TableCell>
                  <TableCell>
                    {editMode ? (
                      <Input value={item.batchNumber || ""} onChange={(e) => updateLineItem(idx, "batchNumber", e.target.value)} />
                    ) : (
                      item.batchNumber
                    )}
                  </TableCell>
                  <TableCell>
                    {editMode ? (
                      <Input type="date" value={item.expiryDate || ""} onChange={(e) => updateLineItem(idx, "expiryDate", e.target.value)} />
                    ) : (
                      item.expiryDate
                    )}
                  </TableCell>
                  {editMode && (
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeLineItem(idx)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {lineItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={editMode ? 8 : 7} className="text-center text-muted-foreground">No line items</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {linkedInvoice ? (
          <Button variant="outline" onClick={() => navigate(`/invoices/${linkedInvoice.id}`)}>
            <FileText className="w-4 h-4 mr-1" /> View Invoice {linkedInvoice.invoiceNumber}
          </Button>
        ) : (
          <Button
            onClick={() => generateInvForPO.mutate(poId)}
            disabled={generateInvForPO.isPending}
          >
            <Printer className="w-4 h-4 mr-1" />
            {generateInvForPO.isPending ? "Generating..." : "Generate Invoice"}
          </Button>
        )}
      </div>
    </div>
  );
}
