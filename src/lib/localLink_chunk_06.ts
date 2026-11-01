        result = dataService.coc.getById(input);
        break;
      case "coc.getByPurchaseOrder":
        result = dataService.coc.getByPurchaseOrder(input);
        break;
      case "coc.create": {
        result = dataService.coc.create(input);
        if (result) {
          await pushCOC(result);
          reloadFromStorage(["sgf_certificatesOfCompliance"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 1 } }));
        }
        break;
      }
      case "coc.update": {
        const { id: cocid, data: cocdata } = input;
        result = dataService.coc.update({ id: cocid, data: cocdata });
        if (result) {
          await pushCOC(result);
          reloadFromStorage(["sgf_certificatesOfCompliance"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 1 } }));
        }
        break;
      }
      case "coc.delete": {
        result = dataService.coc.delete(input);
        if (result?.success) {
          await removeCOC(input);
          reloadFromStorage(["sgf_certificatesOfCompliance"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  PACKING LIST
      // ================================================================
      case "packingList.listByPurchaseOrder":
        result = dataService.packingList.listByPurchaseOrder(input);
        break;
      case "packingList.getById":
        result = dataService.packingList.getById(input);
        break;
      case "packingList.create": {
        result = dataService.packingList.create(input);
        if (result) {
          await pushPackingList(result);
          reloadFromStorage(["sgf_packingListLines"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 1 } }));
        }
        break;
      }
      case "packingList.update": {
        const { id: plid, data: pldata } = input;
        result = dataService.packingList.update({ id: plid, data: pldata });
        if (result) {
          await pushPackingList(result);
          reloadFromStorage(["sgf_packingListLines"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 1 } }));
        }
        break;
      }
      case "packingList.delete": {
        result = dataService.packingList.delete(input);
        if (result?.success) {
          await removePackingListLine(input);
          reloadFromStorage(["sgf_packingListLines"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  SALES REPS
      // ================================================================
      case "salesRep.list":
        result = dataService.salesRep.list();
        break;
      case "salesRep.getById":
        result = dataService.salesRep.getById(input);
        break;
      case "salesRep.create": {
        result = dataService.salesRep.create(input);
        if (result) {
          await pushSalesRep(result);
          reloadFromStorage(["sgf_salesReps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } }));
        }
        break;
      }
      case "salesRep.update": {
        const { id: srid, data: srdata } = input;
        result = dataService.salesRep.update({ id: srid, data: srdata });
        if (result) {
          await pushSalesRep(result);
          reloadFromStorage(["sgf_salesReps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } }));
        }
        break;
      }
      case "salesRep.delete": {
        result = dataService.salesRep.delete(input);
        if (result?.success) {
          await removeSalesRep(input);
          reloadFromStorage(["sgf_salesReps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 0 } }));
        }
        break;
      }
      case "salesRep.getStats":
        result = dataService.salesRep.getStats();
        break;
      case "salesRep.getRepCustomers":
        result = dataService.salesRep.getRepCustomers(input);
        break;
      case "salesRep.getRepInvoices":
        result = dataService.salesRep.getRepInvoices(input);
        break;
      case "salesRep.getRepRevenue":
        result = dataService.salesRep.getRepRevenue(input);
        break;

      // ================================================================
      //  RECEIPTS
      // ================================================================
      case "receipt.list":
        result = dataService.receipt.list();
        break;
      case "receipt.getById":
        result = dataService.receipt.getById(input);
        break;
      case "receipt.getByInvoice":
        result = dataService.receipt.getByInvoice(input);
        break;
      case "receipt.create": {
        result = dataService.receipt.create(input);
        if (result) {
          // Receipts don't have a direct push function — they are part of invoice payment
          reloadFromStorage(["sgf_receipts"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "receipts", count: 1 } }));
        }
        break;
      }
      case "receipt.update": {
        const { id: rid, data: rdata } = input;
        result = dataService.receipt.update({ id: rid, data: rdata });
        if (result) {
          reloadFromStorage(["sgf_receipts"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "receipts", count: 1 } }));
        }
        break;
      }
      case "receipt.delete": {
        result = dataService.receipt.delete(input);
        if (result?.success) {
          reloadFromStorage(["sgf_receipts"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "receipts", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  CREDIT NOTES
      // ================================================================
      case "creditNote.list":
        result = dataService.creditNote.list();
        break;
      case "creditNote.getById":
        result = dataService.creditNote.getById(input);
        break;
      case "creditNote.getByInvoice":
        result = dataService.creditNote.getByInvoice(input);
        break;
      case "creditNote.create": {
        result = dataService.creditNote.create(input);
        if (result) {
          await pushCreditNote(result);
          reloadFromStorage(["sgf_creditNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "creditNotes", count: 1 } }));
        }
        break;
      }
      case "creditNote.update": {
        const { id: cnid, data: cndata } = input;
        result = dataService.creditNote.update({ id: cnid, data: cndata });
        if (result) {
