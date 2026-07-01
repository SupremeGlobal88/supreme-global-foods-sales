import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function generateInvoicePdf(invoice: any, copyType: "customer" | "office" = "customer") {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 10;

  // --- Colors ---
  const gold = [212, 168, 67] as [number, number, number];
  const darkGray = [80, 80, 80] as [number, number, number];
  const black = [0, 0, 0] as [number, number, number];
  const lightGray = [200, 200, 200] as [number, number, number];

  // === HEADER ===
  // Company name
  doc.setFontSize(22);
  doc.setTextColor(...gold);
  doc.setFont("helvetica", "bold");
  doc.text("SUPREME GLOBAL FOODS", margin, y);

  // Copy label
  if (copyType === "office") {
    doc.setFontSize(12);
    doc.setTextColor(...gold);
    doc.text("OFFICE COPY", pageWidth - margin - 30, y);
  } else {
    doc.setFontSize(12);
    doc.setTextColor(99, 102, 241);
    doc.text("CUSTOMER COPY", pageWidth - margin - 35, y);
  }

  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(...darkGray);
  doc.setFont("helvetica", "normal");
  doc.text("19A Steel Road, Spartan, Germiston, 1422", margin, y);
  y += 5;
  doc.text("Tel: 083 293 0644  |  sales@supremeglobalfoods.co.za", margin, y);
  y += 5;
  doc.text("VAT: 4120123456  |  Reg: 2015/123456/07", margin, y);

  // Gold line
  y += 6;
  doc.setDrawColor(...gold);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);

  // === TITLE ===
  y += 12;
  doc.setFontSize(20);
  doc.setTextColor(...black);
  doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", margin, y);
  doc.setFontSize(10);
  doc.setTextColor(...darkGray);
  doc.setFont("helvetica", "normal");
  doc.text("& Delivery Note", margin + 52, y);

  // Status badge
  const status = invoice.status || "draft";
  const statusColors: Record<string, string> = {
    paid: "#4ADE80",
    sent: "#F59E0B",
    draft: "#8A8B8C",
    overdue: "#EF4444",
    partially_paid: "#6366F1",
    cancelled: "#EF4444",
  };
  doc.setFillColor(statusColors[status] || "#8A8B8C");
  doc.roundedRect(pageWidth - margin - 35, y - 6, 35, 8, 2, 2, "F");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(status.toUpperCase(), pageWidth - margin - 17.5, y - 0.5, { align: "center" });

  // === DOC NUMBERS ===
  y += 12;
  doc.setFontSize(8);
  doc.setTextColor(...darkGray);
  doc.setFont("helvetica", "normal");

  const col1 = margin;
  const col2 = margin + 55;
  const col3 = margin + 110;
  const col4 = margin + 155;

  doc.setFont("helvetica", "bold");
  doc.text("INVOICE #", col1, y);
  doc.text("DELIVERY NOTE #", col2, y);
  doc.text("INVOICE DATE", col3, y);
  doc.text("DUE DATE", col4, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gold);
  doc.text(invoice.invoiceNumber || "N/A", col1, y);
  doc.setTextColor(99, 102, 241);
  doc.text(invoice.deliveryNoteNumber || "N/A", col2, y);
  doc.setTextColor(...black);
  const invDate = invoice.invoiceDate
    ? new Date(invoice.invoiceDate).toLocaleDateString("en-ZA")
    : "-";
  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("en-ZA")
    : invoice.paymentTerms === "cod"
      ? "Immediate"
      : "-";
  doc.text(invDate, col3, y);
  doc.text(dueDate, col4, y);

  // === CUSTOMER DETAILS ===
  y += 10;
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.3);
  doc.line(margin, y - 3, pageWidth - margin, y - 3);

  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(...darkGray);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO / DELIVER TO", margin, y);
  doc.text("PAYMENT TERMS", col3, y);
  doc.text("ORDER REF", col4, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...black);
  doc.setFontSize(10);
  const customer = invoice.customer || {};
  doc.text(customer.name || customer.businessName || "N/A", margin, y);

  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(...darkGray);
  const addrParts = [customer.physicalAddress, customer.city, customer.province]
    .filter(Boolean)
    .join(", ");
  if (addrParts) {
    doc.text(addrParts, margin, y);
    y += 4;
  }
  if (customer.vatNumber) {
    doc.text(`VAT: ${customer.vatNumber}`, margin, y);
    y += 4;
  }

  doc.setTextColor(...black);
  doc.setFontSize(9);
  const termsLabel = (invoice.paymentTerms || "cod").replace("_", " ").toUpperCase();
  doc.text(termsLabel, col3, y - (addrParts ? 4 : 0) - (customer.vatNumber ? 4 : 0));
  doc.text(`ORD-${invoice.orderId || "N/A"}`, col4, y - (addrParts ? 4 : 0) - (customer.vatNumber ? 4 : 0));

  // === ITEMS TABLE ===
  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(...darkGray);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE DETAILS", margin, y);

  const tableItems = (invoice.items || []).map((item: any) => ({
    code: item.productCode || "-",
    description: item.productName || item.description || "-",
    qty: String(item.quantity || 0),
    unitPrice: `R ${Number(item.unitPrice || 0).toFixed(2)}`,
    lineTotal: `R ${Number(item.lineTotal || 0).toFixed(2)}`,
  }));

  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Code", "Description", "Qty", "Unit Price", "Line Total"]],
    body: tableItems.length > 0
      ? tableItems.map((item: any) => [item.code, item.description, item.qty, item.unitPrice, item.lineTotal])
      : [["-", "Order-based invoice", "-", "-", "-"]],
    theme: "grid",
    headStyles: {
      fillColor: gold,
      textColor: [10, 10, 11],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: black,
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
    margin: { left: margin, right: margin },
    styles: {
      lineColor: lightGray,
      lineWidth: 0.3,
    },
  });

  // === TOTALS ===
  const finalY = (doc as any).lastAutoTable?.finalY || y + 30;
  y = finalY + 10;

  const totalsX = pageWidth - margin - 60;
  doc.setFontSize(9);
  doc.setTextColor(...darkGray);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal (excl. VAT):", totalsX, y);
  doc.setTextColor(...black);
  doc.setFont("helvetica", "bold");
  doc.text(`R ${Number(invoice.subtotal || 0).toFixed(2)}`, pageWidth - margin, y, { align: "right" });

  y += 6;
  doc.setTextColor(...darkGray);
  doc.setFont("helvetica", "normal");
  doc.text("VAT @ 15%:", totalsX, y);
  doc.setTextColor(...black);
  doc.setFont("helvetica", "bold");
  doc.text(`R ${Number(invoice.vatAmount || 0).toFixed(2)}`, pageWidth - margin, y, { align: "right" });

  y += 8;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.8);
  doc.line(totalsX - 5, y - 4, pageWidth - margin, y - 4);

  doc.setFontSize(13);
  doc.setTextColor(...gold);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL DUE:", totalsX, y);
  doc.text(`R ${Number(invoice.total || invoice.totalAmount || 0).toFixed(2)}`, pageWidth - margin, y, { align: "right" });

  if (Number(invoice.amountPaid || 0) > 0) {
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.setFont("helvetica", "normal");
    doc.text("Amount Paid:", totalsX, y);
    doc.text(`R ${Number(invoice.amountPaid || 0).toFixed(2)}`, pageWidth - margin, y, { align: "right" });

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...black);
    doc.text("Balance Due:", totalsX, y);
    const balColor = Number(invoice.balanceDue || 0) > 0 ? [239, 68, 68] : [74, 222, 128];
    doc.setTextColor(...balColor as [number, number, number]);
    doc.text(`R ${Number(invoice.balanceDue || 0).toFixed(2)}`, pageWidth - margin, y, { align: "right" });
  }

  // === RETURNS NOTICE ===
  y += 10;
  doc.setFillColor(255, 245, 245);
  doc.setDrawColor(239, 68, 68);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 18, 2, 2, "FD");
  doc.setFontSize(9);
  doc.setTextColor(239, 68, 68);
  doc.setFont("helvetica", "bold");
  doc.text("PLEASE NOTE: NO EXCHANGES OR RETURNS AFTER 7 DAYS FROM INVOICE DATE.", pageWidth / 2, y + 5, { align: "center" });

  // === DELIVERY NOTE SECTION ===
  y += 22;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.5);
  doc.line(margin, y - 5, pageWidth - margin, y - 5);

  doc.setFontSize(10);
  doc.setTextColor(99, 102, 241);
  doc.setFont("helvetica", "bold");
  doc.text(`DELIVERY NOTE - ${invoice.deliveryNoteNumber || "N/A"}`, margin, y);

  y += 6;
  const dnItems = (invoice.items || []).map((item: any) => [
    item.productCode || "-",
    item.productName || item.description || "-",
    String(item.quantity || 0),
    "________",
    "________",
    "________",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Code", "Product", "Qty Shipped", "Qty Received", "Damaged", "Missing"]],
    body: dnItems.length > 0 ? dnItems : [["-", "-", "-", "-", "-", "-"]],
    theme: "grid",
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: darkGray,
      fontSize: 7,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: black,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 20, halign: "center" },
      5: { cellWidth: 20, halign: "center" },
    },
    margin: { left: margin, right: margin },
    styles: {
      lineColor: lightGray,
      lineWidth: 0.3,
    },
  });

  // === SIGNATURE BLOCK ===
  const dnFinalY = (doc as any).lastAutoTable?.finalY || y + 20;
  y = dnFinalY + 12;

  doc.setFontSize(7);
  doc.setTextColor(...darkGray);
  doc.setFont("helvetica", "bold");

  // Driver section
  doc.text("DRIVER NAME", margin, y);
  doc.text("VEHICLE REG", margin + 60, y);
  doc.text("DATE / TIME DEPARTED", margin + 120, y);

  y += 4;
  doc.setDrawColor(...black);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 50, y);
  doc.line(margin + 60, y, margin + 110, y);
  doc.line(margin + 120, y, margin + 170, y);

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkGray);
  doc.text("RECEIVED BY (PRINT NAME)", margin, y);
  doc.text("SIGNATURE", margin + 70, y);
  doc.text("DATE / TIME RECEIVED", margin + 130, y);

  y += 4;
  doc.line(margin, y, margin + 55, y);
  doc.line(margin + 70, y, margin + 115, y);
  doc.line(margin + 130, y, pageWidth - margin, y);

  // === FOOTER ===
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "normal");
  doc.text("Banking: FNB | Account: 62001234567 | Branch: 250655 | Quote invoice number with payment", pageWidth / 2, footerY, { align: "center" });
  doc.text("E&OE. Goods remain the property of Supreme Global Foods until paid in full.", pageWidth / 2, footerY + 4, { align: "center" });

  // === SAVE ===
  const filename = `${invoice.invoiceNumber || "invoice"}_${copyType}.pdf`;
  doc.save(filename);

  return filename;
}
