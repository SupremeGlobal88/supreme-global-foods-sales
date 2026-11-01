        result = dataService.specialPrice.update({ id: spid, data: spdata });
        if (result) {
          await pushSpecialPrice(result);
          reloadFromStorage(["sgf_specialPrices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "specialPrices", count: 1 } }));
        }
        break;
      }
      case "specialPrice.delete": {
        result = dataService.specialPrice.delete(input);
        if (result?.success) {
          await removeSpecialPrice(input);
          reloadFromStorage(["sgf_specialPrices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "specialPrices", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  FOLLOW-UPS
      // ================================================================
      case "followUp.list":
        result = dataService.followUp.list();
        break;
      case "followUp.getById":
        result = dataService.followUp.getById(input);
        break;
      case "followUp.getByCustomer":
        result = dataService.followUp.getByCustomer(input);
        break;
      case "followUp.getByRep":
        result = dataService.followUp.getByRep(input);
        break;
      case "followUp.create": {
        result = dataService.followUp.create(input);
        if (result) {
          await pushFollowUp(result);
          reloadFromStorage(["sgf_followUps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 1 } }));
        }
        break;
      }
      case "followUp.update": {
        const { id: fuid, data: fudata } = input;
        result = dataService.followUp.update({ id: fuid, data: fudata });
        if (result) {
          await pushFollowUp(result);
          reloadFromStorage(["sgf_followUps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 1 } }));
        }
        break;
      }
      case "followUp.delete": {
        result = dataService.followUp.delete(input);
        if (result?.success) {
          await pushFollowUp({ id: input, deleted: true });
          reloadFromStorage(["sgf_followUps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  FOLLOW-UP ACTIONS
      // ================================================================
      case "followUpAction.list":
        result = dataService.followUpAction.list();
        break;
      case "followUpAction.getById":
        result = dataService.followUpAction.getById(input);
        break;
      case "followUpAction.getByFollowUp":
        result = dataService.followUpAction.getByFollowUp(input);
        break;
      case "followUpAction.create": {
        result = dataService.followUpAction.create(input);
        if (result) {
          await pushFollowUpAction(result);
          reloadFromStorage(["sgf_followUpActions"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 1 } }));
        }
        break;
      }
      case "followUpAction.update": {
        const { id: faid, data: fadata } = input;
        result = dataService.followUpAction.update({ id: faid, data: fadata });
        if (result) {
          await pushFollowUpAction(result);
          reloadFromStorage(["sgf_followUpActions"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 1 } }));
        }
        break;
      }
      case "followUpAction.delete": {
        result = dataService.followUpAction.delete(input);
        if (result?.success) {
          await pushFollowUpAction({ id: input, deleted: true });
          reloadFromStorage(["sgf_followUpActions"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  COLLECTIONS
      // ================================================================
      case "collectionNote.list":
        result = dataService.collectionNote.list();
        break;
      case "collectionNote.getById":
        result = dataService.collectionNote.getById(input);
        break;
      case "collectionNote.getByCustomer":
        result = dataService.collectionNote.getByCustomer(input);
        break;
      case "collectionNote.create": {
        result = dataService.collectionNote.create(input);
        if (result) {
          await pushCollectionNote(result);
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 1 } }));
        }
        break;
      }
      case "collectionNote.update": {
        const { id: cnid, data: cndata } = input;
        result = dataService.collectionNote.update({ id: cnid, data: cndata });
        if (result) {
          await pushCollectionNote(result);
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 1 } }));
        }
        break;
      }
      case "collectionNote.delete": {
        result = dataService.collectionNote.delete(input);
        if (result?.success) {
          await pushCollectionNote({ id: input, deleted: true });
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 0 } }));
        }
        break;
      }
      case "collectionPromise.list":
        result = dataService.collectionPromise.list();
        break;
      case "collectionPromise.getById":
        result = dataService.collectionPromise.getById(input);
        break;
      case "collectionPromise.getByCustomer":
        result = dataService.collectionPromise.getByCustomer(input);
        break;
      case "collectionPromise.create": {
        result = dataService.collectionPromise.create(input);
        if (result) {
          await pushCollectionPromise(result);
          reloadFromStorage(["sgf_collectionPromises"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 1 } }));
        }
        break;
      }
      case "collectionPromise.update": {
        const { id: cpid, data: cpdata } = input;
        result = dataService.collectionPromise.update({ id: cpid, data: cpdata });
        if (result) {
          await pushCollectionPromise(result);
          reloadFromStorage(["sgf_collectionPromises"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 1 } }));
        }
        break;
      }
      case "collectionPromise.delete": {
        result = dataService.collectionPromise.delete(input);
        if (result?.success) {
          await pushCollectionPromise({ id: input, deleted: true });
          reloadFromStorage(["sgf_collectionPromises"]);
