      }
      case "invoice.applyCreditNote": {
        result = dataService.invoice.applyCreditNote(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.generateFromOrder": {
        result = dataService.invoice.generateFromOrder(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.generateFromPO": {
        result = dataService.generateInvoiceForPO?.(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.activateFromOrder": {
        result = dataService.invoice.activateFromOrder(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.activateFromPO": {
        result = dataService.invoice.activateFromPO(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.cancel": {
        const { id: invCancelId, reason: invReason } = input;
        result = dataService.invoice.cancel(invCancelId, invReason);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.updateStatus": {
        result = dataService.invoice.updateStatus(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  APPOINTMENTS
      // ================================================================
      case "appointment.list":
        result = dataService.appointment.list();
        break;
      case "appointment.getById":
        result = dataService.appointment.getById(input);
        break;
      case "appointment.getByDate":
        result = dataService.appointment.getByDate(input);
        break;
      case "appointment.getByRep":
        result = dataService.appointment.getByRep(input);
        break;
      case "appointment.getByCustomer":
        result = dataService.appointment.getByCustomer(input);
        break;
      case "appointment.create": {
        result = dataService.appointment.create(input);
        if (result) {
          await pushAppointment(result);
          reloadFromStorage(["sgf_appointments"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } }));
        }
        break;
      }
      case "appointment.update": {
        const { id: aid, data: adata } = input;
        result = dataService.appointment.update({ id: aid, data: adata });
        if (result) {
          await pushAppointment(result);
          reloadFromStorage(["sgf_appointments"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } }));
        }
        break;
      }
      case "appointment.delete": {
        result = dataService.appointment.delete(input);
        if (result?.success) {
          await pushAppointmentDelete(input);
          reloadFromStorage(["sgf_appointments"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 0 } }));
        }
        break;
      }
      case "appointment.getUpcoming":
        result = dataService.appointment.getUpcoming(input || 7);
        break;
      case "appointment.getRecentCheckIns":
        result = dataService.appointment.getRecentCheckIns(input || 7);
        break;

      // ================================================================
      //  CHECK-INS
      // ================================================================
      case "checkIn.list":
        result = dataService.checkIn.list();
        break;
      case "checkIn.getById":
        result = dataService.checkIn.getById(input);
        break;
      case "checkIn.getByRep":
        result = dataService.checkIn.getByRep(input);
        break;
      case "checkIn.getByDate":
        result = dataService.checkIn.getByDate(input);
        break;
      case "checkIn.getRecent":
        result = dataService.checkIn.getRecent(input || 7);
        break;
      case "checkIn.create": {
        result = dataService.checkIn.create(input);
        if (result) {
          await pushCheckin(result);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } }));
        }
        break;
      }
      case "checkIn.update": {
        const { id: cid, data: cdata } = input;
        result = dataService.checkIn.update({ id: cid, data: cdata });
        if (result) {
          await pushCheckin(result);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } }));
        }
        break;
      }
      case "checkIn.delete": {
        result = dataService.checkIn.delete(input);
        if (result?.success) {
          await pushCheckinDelete(input);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  SPECIAL PRICES
      // ================================================================
      case "specialPrice.list":
        result = dataService.specialPrice.list();
        break;
      case "specialPrice.getById":
        result = dataService.specialPrice.getById(input);
        break;
      case "specialPrice.getByCustomer":
        result = dataService.specialPrice.getByCustomer(input);
        break;
      case "specialPrice.create": {
        result = dataService.specialPrice.create(input);
        if (result) {
          await pushSpecialPrice(result);
          reloadFromStorage(["sgf_specialPrices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "specialPrices", count: 1 } }));
        }
        break;
      }
      case "specialPrice.update": {
        const { id: spid, data: spdata } = input;
