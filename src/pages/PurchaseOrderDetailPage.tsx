import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Edit, Printer, FileText, CreditCard, Save, X, Package, Truck, CheckCircle, AlertCircle, Calendar, Clock, User, Building2, Phone, Mail, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Types
interface PurchaseOrder {
  id: number;
  poNumber: string;
  corporateCustomerId: number;
  customerName: string;
  orderDate: string;
  deliveryDate: string;
  status: string;
  paymentStatus: string;
  paymentTerms: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  notes: string;
  lineItems: POLineItem[];
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  invoiceNumber?: string;
  invoiceId?: number;
  sageInvoiceNumber?: string;
  deliveryAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
}

interface POLineItem {
  id: number;
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  vatRate: number;
  notes: string;
  deliveredQty: number;
  status: string;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  purchaseOrderId: number;
  poNumber: string;
  customerId: number;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  lineItems: InvoiceLineItem[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  sageInvoiceNumber?: string;
}

interface InvoiceLineItem {
  id: number;
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  vatRate: number;
}

interface CorporateCustomer {
  id: number;
  companyName: string;
  tradingName?: string;
  regNumber?: string;
  vatNumber?: string;
  address?: string;
  deliveryAddress?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  paymentTerms: string;
  creditLimit: number;
  currentBalance: number;
  status: string;
  linkedCustomerId?: number;
  vatExempt: boolean;
}

interface Receipt {
  id: number;
  receiptNumber: string;
  invoiceId: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string;
  notes?: string;
  createdAt: string;
  createdBy: number;
}

interface DeliveryNote {
  id: number;
  dnNumber: string;
  purchaseOrderId: number;
  poNumber: string;
  customerId: number;
  customerName: string;
  deliveryDate: string;
  status: string;
  lineItems: DeliveryLineItem[];
  createdAt: string;
  createdBy: number;
}

interface DeliveryLineItem {
  id: number;
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  deliveredQty: number;
  status: string;
  notes?: string;
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const poId = parseInt(id || "0");
  const navigate = useNavigate();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  // Queries
  const { data: po, isLoading: poLoading } = trpc.purchaseOrder.getById.useQuery(poId, { enabled: poId > 0 });
  const { data: invoices } = trpc.invoice.list.useQuery();
  const { data: receipts } = trpc.receipt.list.useQuery();
  const { data: deliveryNotes } = trpc.deliveryNote.list.useQuery();
  const { data: corporateCustomers } = trpc.corporateCustomer.list.useQuery();
  const { data: products } = trpc.product.list.useQuery();

  // Mutations
  const updatePO = trpc.purchaseOrder.update.useMutation({
    onSuccess: () => {
      utils.purchaseOrder.getById.invalidate(poId);
      utils.purchaseOrder.list.invalidate();
      toast({ title: "Success", description: "Purchase order updated" });
    },
  });

  const deletePO = trpc.purchaseOrder.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Success", description: "Purchase order deleted" });
      navigate("/purchase-orders");
    },
  });

  const generateInvForPO = trpc.invoice.generateForPO.useMutation({
    onSuccess: (invNum) => {
      if (invNum) {
        utils.invoice.list.invalidate();
        utils.purchaseOrder.getById.invalidate(poId);
        toast({ title: "Invoice Generated", description: `Invoice ${invNum} created successfully` });
      } else {
        toast({ title: "Warning", description: "Invoice generation returned empty - check console for details", variant: "destructive" });
      }
    },
    onError: (err) => {
      toast({ title: "Error", description: `Failed to generate invoice: ${err.message}`, variant: "destructive" });
    },
  });

  const createDeliveryNote = trpc.deliveryNote.create.useMutation({
    onSuccess: () => {
      utils.deliveryNote.list.invalidate();
      utils.purchaseOrder.getById.invalidate(poId);
      toast({ title: "Success", description: "Delivery note created" });
    },
  });

  // State
  const [editMode, setEditMode] = useState(false);
  const [editedPO, setEditedPO] = useState<Partial<PurchaseOrder>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [generateInvoiceDialogOpen, setGenerateInvoiceDialogOpen] = useState(false);
  const [createDNDialogOpen, setCreateDNDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("details");

  // Derived data
  const relatedInvoices = useMemo(() => {
    if (!invoices || !po) return [];
    return invoices.filter((inv: Invoice) => inv.purchaseOrderId === po.id);
  }, [invoices, po]);

  const relatedReceipts = useMemo(() => {
    if (!receipts || relatedInvoices.length === 0) return [];
    const invIds = relatedInvoices.map((inv: Invoice) => inv.id);
    return receipts.filter((rec: Receipt) => invIds.includes(rec.invoiceId));
  }, [receipts, relatedInvoices]);

  const relatedDeliveryNotes = useMemo(() => {
    if (!deliveryNotes || !po) return [];
    return deliveryNotes.filter((dn: DeliveryNote) => dn.purchaseOrderId === po.id);
  }, [deliveryNotes, po]);

  const corporateCustomer = useMemo(() => {
    if (!corporateCustomers || !po) return null;
    return corporateCustomers.find((c: CorporateCustomer) => c.id === po.corporateCustomerId);
  }, [corporateCustomers, po]);

  // Handlers
  const handleEdit = () => {
    if (po) {
      setEditedPO({ ...po });
      setEditMode(true);
    }
  };

  const handleSave = () => {
    if (editedPO && poId) {
      updatePO.mutate({ id: poId, ...editedPO });
      setEditMode(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setEditedPO({});
  };

  const handleDelete = () => {
    if (poId) {
      deletePO.mutate(poId);
      setDeleteDialogOpen(false);
    }
  };

  const handleGenerateInvoice = () => {
    if (poId) {
      generateInvForPO.mutate(poId);
      setGenerateInvoiceDialogOpen(false);
    }
  };

  const handleCreateDeliveryNote = () => {
    if (poId && po) {
      createDeliveryNote.mutate({
        purchaseOrderId: poId,
        poNumber: po.poNumber,
        customerId: po.corporateCustomerId,
        customerName: po.customerName,
        deliveryDate: new Date().toISOString().split("T")[0],
        lineItems: po.lineItems.map((item: POLineItem) => ({
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          quantity: item.quantity,
          deliveredQty: 0,
          status: "pending",
        })),
      });
      setCreateDNDialogOpen(false);
    }
  };

  const handleAddLineItem = () => {
    if (!editedPO.lineItems) return;
    const newItem: POLineItem = {
      id: Date.now(),
      productId: 0,
      productName: "",
      productCode: "",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      total: 0,
      vatRate: 0.15,
      notes: "",
      deliveredQty: 0,
      status: "pending",
    };
    setEditedPO({
      ...editedPO,
      lineItems: [...editedPO.lineItems, newItem],
    });
  };

  const handleRemoveLineItem = (itemId: number) => {
    if (!editedPO.lineItems) return;
    setEditedPO({
      ...editedPO,
      lineItems: editedPO.lineItems.filter((item: POLineItem) => item.id !== itemId),
    });
  };

  const handleLineItemChange = (itemId: number, field: string, value: any) => {
    if (!editedPO.lineItems) return;
    const updatedItems = editedPO.lineItems.map((item: POLineItem) => {
      if (item.id === itemId) {
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unitPrice" || field === "discount") {
          updated.total = updated.quantity * updated.unitPrice * (1 - updated.discount / 100);
        }
        return updated;
      }
      return item;
    });
    setEditedPO({ ...editedPO, lineItems: updatedItems });
  };

  const handleProductSelect = (itemId: number, productId: number) => {
    if (!products) return;
    const product = products.find((p: any) => p.id === productId);
    if (product) {
      handleLineItemChange(itemId, "productId", productId);
      handleLineItemChange(itemId, "productName", product.name);
      handleLineItemChange(itemId, "productCode", product.code);
      handleLineItemChange(itemId, "unitPrice", product.price);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: "bg-gray-500",
      pending: "bg-yellow-500",
      approved: "bg-blue-500",
      confirmed: "bg-blue-500",
      processing: "bg-purple-500",
      ready: "bg-indigo-500",
      shipped: "bg-orange-500",
      delivered: "bg-green-500",
      completed: "bg-green-500",
      cancelled: "bg-red-500",
      rejected: "bg-red-500",
    };
    return <Badge className={`${variants[status] || "bg-gray-500"} text-white`}>{status.toUpperCase()}</Badge>;
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      unpaid: "bg-red-500",
      partial: "bg-yellow-500",
      paid: "bg-green-500",
      overdue: "bg-red-700",
      refunded: "bg-gray-500",
    };
    return <Badge className={`${variants[status] || "bg-gray-500"} text-white`}>{status.toUpperCase()}</Badge>;
  };

  // Loading state
  if (poLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="outline" onClick={() => navigate("/purchase-orders")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Purchase Order Not Found</h2>
            <p className="text-gray-500">The purchase order you are looking for does not exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/purchase-orders")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Purchase Order {po.poNumber}</h1>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(po.status)}
              {getPaymentStatusBadge(po.paymentStatus)}
              <span className="text-sm text-gray-500">
                <Calendar className="h-3 w-3 inline mr-1" />
                {format(parseISO(po.orderDate), "dd MMM yyyy")}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editMode ? (
            <>
              <Button variant="outline" onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" /> Edit
              </Button>
              <Button variant="outline" onClick={() => setGenerateInvoiceDialogOpen(true)} disabled={relatedInvoices.length > 0}>
                <FileText className="h-4 w-4 mr-2" /> Generate Invoice
              </Button>
              <Button variant="outline" onClick={() => setCreateDNDialogOpen(true)}>
                <Truck className="h-4 w-4 mr-2" /> Create Delivery Note
              </Button>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={updatePO.isPending}>
                <Save className="h-4 w-4 mr-2" /> Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({relatedInvoices.length})</TabsTrigger>
          <TabsTrigger value="delivery">Delivery Notes ({relatedDeliveryNotes.length})</TabsTrigger>
          <TabsTrigger value="receipts">Receipts ({relatedReceipts.length})</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PO Information */}
            <Card>
              <CardHeader>
                <CardTitle>Purchase Order Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {editMode ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>PO Number</Label>
                        <Input value={editedPO.poNumber || ""} onChange={(e) => setEditedPO({ ...editedPO, poNumber: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={editedPO.status} onValueChange={(value) => setEditedPO({ ...editedPO, status: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="ready">Ready</SelectItem>
                            <SelectItem value="shipped">Shipped</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Order Date</Label>
                        <Input type="date" value={editedPO.orderDate || ""} onChange={(e) => setEditedPO({ ...editedPO, orderDate: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Delivery Date</Label>
                        <Input type="date" value={editedPO.deliveryDate || ""} onChange={(e) => setEditedPO({ ...editedPO, deliveryDate: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Terms</Label>
                      <Select value={editedPO.paymentTerms} onValueChange={(value) => setEditedPO({ ...editedPO, paymentTerms: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediate</SelectItem>
                          <SelectItem value="7_days">7 Days</SelectItem>
                          <SelectItem value="14_days">14 Days</SelectItem>
                          <SelectItem value="30_days">30 Days</SelectItem>
                          <SelectItem value="60_days">60 Days</SelectItem>
                          <SelectItem value="90_days">90 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea value={editedPO.notes || ""} onChange={(e) => setEditedPO({ ...editedPO, notes: e.target.value })} rows={3} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-500">PO Number:</span> <span className="font-medium">{po.poNumber}</span></div>
                      <div><span className="text-gray-500">Status:</span> {getStatusBadge(po.status)}</div>
                      <div><span className="text-gray-500">Order Date:</span> {format(parseISO(po.orderDate), "dd MMM yyyy")}</div>
                      <div><span className="text-gray-500">Delivery Date:</span> {po.deliveryDate ? format(parseISO(po.deliveryDate), "dd MMM yyyy") : "Not set"}</div>
                      <div><span className="text-gray-500">Payment Terms:</span> <span className="capitalize">{po.paymentTerms?.replace("_", " ")}</span></div>
                      <div><span className="text-gray-500">Payment Status:</span> {getPaymentStatusBadge(po.paymentStatus)}</div>
                    </div>
                    {po.notes && (
                      <div className="text-sm">
                        <span className="text-gray-500">Notes:</span>
                        <p className="mt-1 p-2 bg-gray-50 rounded">{po.notes}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {corporateCustomer ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-blue-500" />
                      <span className="font-semibold text-lg">{corporateCustomer.companyName}</span>
                    </div>
                    {corporateCustomer.tradingName && (
                      <div className="text-sm text-gray-500">{corporateCustomer.tradingName}</div>
                    )}
                    <Separator />
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      {corporateCustomer.contactName && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>{corporateCustomer.contactName}</span>
                        </div>
                      )}
                      {corporateCustomer.contactPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{corporateCustomer.contactPhone}</span>
                        </div>
                      )}
                      {corporateCustomer.contactEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span>{corporateCustomer.contactEmail}</span>
                        </div>
                      )}
                      {corporateCustomer.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>{corporateCustomer.address}</span>
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-500">Credit Limit:</span> R{corporateCustomer.creditLimit?.toLocaleString()}</div>
                      <div><span className="text-gray-500">Current Balance:</span> R{corporateCustomer.currentBalance?.toLocaleString()}</div>
                      <div><span className="text-gray-500">VAT Exempt:</span> {corporateCustomer.vatExempt ? "Yes" : "No"}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>Customer information not available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              {editMode && (
                <Button onClick={handleAddLineItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" /> Add Item
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Discount %</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    {editMode && <TableHead className="w-10"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editMode ? (
                    editedPO.lineItems?.map((item: POLineItem) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Select value={item.productId.toString()} onValueChange={(value) => handleProductSelect(item.id, parseInt(value))}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products?.map((product: any) => (
                                <SelectItem key={product.id} value={product.id.toString()}>
                                  {product.code} - {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.quantity} onChange={(e) => handleLineItemChange(item.id, "quantity", parseInt(e.target.value) || 0)} className="w-20 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" value={item.unitPrice} onChange={(e) => handleLineItemChange(item.id, "unitPrice", parseFloat(e.target.value) || 0)} className="w-24 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.discount} onChange={(e) => handleLineItemChange(item.id, "discount", parseFloat(e.target.value) || 0)} className="w-20 text-right" />
                        </TableCell>
                        <TableCell className="text-right font-medium">R{item.total.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveLineItem(item.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    po.lineItems?.map((item: POLineItem) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-sm text-gray-500">{item.productCode}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">R{item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{item.discount}%</TableCell>
                        <TableCell className="text-right font-medium">R{item.total.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-end">
                <div className="w-72 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal:</span>
                    <span>R{po.subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">VAT:</span>
                    <span>R{po.vatAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>R{po.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Related Invoices</CardTitle>
              {relatedInvoices.length === 0 && (
                <Button onClick={() => setGenerateInvoiceDialogOpen(true)}>
                  <FileText className="h-4 w-4 mr-2" /> Generate Invoice
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {relatedInvoices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No invoices generated for this purchase order.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatedInvoices.map((inv: Invoice) => (
                      <TableRow key={inv.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/invoices/${inv.id}`)}>
                        <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                        <TableCell>{format(parseISO(inv.invoiceDate), "dd MMM yyyy")}</TableCell>
                        <TableCell>{format(parseISO(inv.dueDate), "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-right">R{inv.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right text-green-600">R{inv.amountPaid?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-medium">R{inv.balanceDue?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{getPaymentStatusBadge(inv.paymentStatus)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${inv.id}`); }}>
                            <ArrowLeft className="h-4 w-4 rotate-180" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Delivery Notes Tab */}
        <TabsContent value="delivery">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Delivery Notes</CardTitle>
              <Button onClick={() => setCreateDNDialogOpen(true)}>
                <Truck className="h-4 w-4 mr-2" /> Create Delivery Note
              </Button>
            </CardHeader>
            <CardContent>
              {relatedDeliveryNotes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No delivery notes for this purchase order.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DN #</TableHead>
                      <TableHead>Delivery Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatedDeliveryNotes.map((dn: DeliveryNote) => (
                      <TableRow key={dn.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/delivery-notes/${dn.id}`)}>
                        <TableCell className="font-medium">{dn.dnNumber}</TableCell>
                        <TableCell>{format(parseISO(dn.deliveryDate), "dd MMM yyyy")}</TableCell>
                        <TableCell>{getStatusBadge(dn.status)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/delivery-notes/${dn.id}`); }}>
                            <ArrowLeft className="h-4 w-4 rotate-180" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receipts Tab */}
        <TabsContent value="receipts">
          <Card>
            <CardHeader>
              <CardTitle>Payment Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              {relatedReceipts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No receipts recorded for this purchase order's invoices.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt #</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatedReceipts.map((rec: Receipt) => (
                      <TableRow key={rec.id}>
                        <TableCell className="font-medium">{rec.receiptNumber}</TableCell>
                        <TableCell>{rec.invoiceNumber}</TableCell>
                        <TableCell>{format(parseISO(rec.paymentDate), "dd MMM yyyy")}</TableCell>
                        <TableCell className="capitalize">{rec.paymentMethod?.replace("_", " ")}</TableCell>
                        <TableCell className="text-right font-medium">R{rec.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/receipts/${rec.id}`)}>
                            <ArrowLeft className="h-4 w-4 rotate-180" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Purchase Order</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Are you sure you want to delete purchase order <strong>{po.poNumber}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deletePO.isPending}>
              {deletePO.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Invoice Dialog */}
      <Dialog open={generateInvoiceDialogOpen} onOpenChange={setGenerateInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Generate an invoice for purchase order <strong>{po.poNumber}</strong>?
          </p>
          <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal:</span> <span>R{po.subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span>VAT:</span> <span>R{po.vatAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between font-bold border-t pt-2"><span>Total:</span> <span>R{po.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateInvoiceDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerateInvoice} disabled={generateInvForPO.isPending}>
              {generateInvForPO.isPending ? "Generating..." : "Generate Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Delivery Note Dialog */}
      <Dialog open={createDNDialogOpen} onOpenChange={setCreateDNDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Delivery Note</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Create a delivery note for purchase order <strong>{po.poNumber}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            This will create a delivery note with all pending line items.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDNDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateDeliveryNote} disabled={createDeliveryNote.isPending}>
              {createDeliveryNote.isPending ? "Creating..." : "Create Delivery Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
