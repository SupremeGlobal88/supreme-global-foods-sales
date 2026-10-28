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