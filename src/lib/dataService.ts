      saveItem("sgf_invoices", invoices);
      return invoiceNumber;
    } catch (err) {
      console.error("[generateInvoiceForPO] CRASH:", err);
      return null;
    } finally {
      invoiceGenerationLock = false;
    }