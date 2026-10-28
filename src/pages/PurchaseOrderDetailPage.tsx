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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2, FileText, Printer, Edit, Save, X, CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useContext();
  const [activeTab, setActiveTab] = useState("details");

  // PO queries
  const { data: po, isLoading: poLoading } = trpc.purchaseOrder.getById.useQuery(Number(id));
  const { data: pos } = trpc.purchaseOrder.list.useQuery();
  const { data: invoices } = trpc.invoice.list.useQuery();
  const { data: allCustomers } = trpc.customer.list.useQuery();
  const { data: allProducts } = trpc.product.list.useQuery();

  // Mutations
  const updatePO = trpc.purchaseOrder.update.useMutation({
    onSuccess: () => {
      utils.purchaseOrder.list.invalidate();
      utils.purchaseOrder.getById.invalidate(Number(id));
      toast.success("Purchase order updated");
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

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    if (po) {
      setEditForm({ ...po });
    }
  }, [po]);

  if (poLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/purchase-orders")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Purchase Orders
        </Button>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Purchase order not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const linkedInvoice = invoices?.find((inv: any) => inv.poId === po.id);

  const handleSave = () => {
    updatePO.mutate({ id: po.id, data: editForm });
    setIsEditing(false);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "sent": return "bg-blue-100 text-blue-800";
      case "accepted": return "bg-green-100 text-green-800";
      case "rejected": return "bg-red-100 text-red-800";
      case "cancelled": return "bg-gray-100 text-gray-500";
      default: return "bg-gray-100";
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/purchase-orders")} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold">{po.poNumber || `PO-${po.id}`}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={statusColor(po.status)}>{po.status}</Badge>
            <span className="text-sm text-muted-foreground">
              {po.createdAt ? format(new Date(po.createdAt), "dd MMM yyyy") : ""}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setEditForm({ ...po }); }}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
          )}
          {!linkedInvoice && po.status !== "cancelled" && (
            <Button
              size="sm"
              onClick={() => generateInvForPO.mutate(po.id)}
              disabled={generateInvForPO.isLoading}
            >
              <FileText className="mr-2 h-4 w-4" />
              {generateInvForPO.isLoading ? "Generating..." : "Generate Invoice"}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="items">Items ({po.items?.length || 0})</TabsTrigger>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                {isEditing ? (
                  <Select
                    value={String(editForm.customerId || "")}
                    onValueChange={(v) => setEditForm({ ...editForm, customerId: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {allCustomers?.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm">{po.customer?.name || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                {isEditing ? (
                  <Input
                    value={editForm.reference || ""}
                    onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
                  />
                ) : (
                  <p className="text-sm">{po.reference || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Delivery Date</Label>
                {isEditing ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editForm.deliveryDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editForm.deliveryDate ? format(new Date(editForm.deliveryDate), "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={editForm.deliveryDate ? new Date(editForm.deliveryDate) : undefined}
                        onSelect={(date) => setEditForm({ ...editForm, deliveryDate: date?.toISOString() })}
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <p className="text-sm">
                    {po.deliveryDate ? format(new Date(po.deliveryDate), "dd MMM yyyy") : "—"}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                {isEditing ? (
                  <Textarea
                    value={editForm.notes || ""}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{po.notes || "—"}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Product</th>
                      <th className="text-right p-2">Qty</th>
                      <th className="text-right p-2">Unit Price</th>
                      <th className="text-right p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items?.map((item: any, idx: number) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{item.productName || item.description || "—"}</td>
                        <td className="text-right p-2">{item.quantity}</td>
                        <td className="text-right p-2">R {item.unitPrice?.toFixed(2) || "0.00"}</td>
                        <td className="text-right p-2 font-medium">R {item.total?.toFixed(2) || "0.00"}</td>
                      </tr>
                    ))}
                    {(!po.items || po.items.length === 0) && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-muted-foreground">No items</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-muted/50 font-medium">
                    <tr>
                      <td colSpan={3} className="text-right p-2">Subtotal</td>
                      <td className="text-right p-2">R {po.subtotal?.toFixed(2) || "0.00"}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="text-right p-2">VAT (15%)</td>
                      <td className="text-right p-2">R {po.vat?.toFixed(2) || "0.00"}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="text-right p-2">Total</td>
                      <td className="text-right p-2">R {po.total?.toFixed(2) || "0.00"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoice" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Linked Invoice</CardTitle>
            </CardHeader>
            <CardContent>
              {linkedInvoice ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Invoice Number</Label>
                      <p className="font-medium">{linkedInvoice.invoiceNumber}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <p><Badge>{linkedInvoice.status}</Badge></p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Total</Label>
                      <p className="font-medium">R {linkedInvoice.total?.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Balance Due</Label>
                      <p className="font-medium">R {linkedInvoice.balanceDue?.toFixed(2)}</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => navigate(`/invoices/${linkedInvoice.id}`)}>
                    <FileText className="mr-2 h-4 w-4" /> View Invoice
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No invoice generated yet</p>
                  {po.status !== "cancelled" && (
                    <Button onClick={() => generateInvForPO.mutate(po.id)} disabled={generateInvForPO.isLoading}>
                      <FileText className="mr-2 h-4 w-4" />
                      {generateInvForPO.isLoading ? "Generating..." : "Generate Invoice"}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}