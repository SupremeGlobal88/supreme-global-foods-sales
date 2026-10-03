const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "src/pages/AppointmentsPage.tsx");
if (!fs.existsSync(filePath)) {
  console.error("AppointmentsPage.tsx not found");
  process.exit(1);
}

let content = fs.readFileSync(filePath, "utf-8");

// Fix 1: Replace appt.customer?.name lookup with customers array lookup in reminder effect
const oldLine = 'const custName = appt.customer?.name || "Customer";';
const newLines = `const cust = (customers || []).find((c) => c.id == appt.customerId);\n          const custName = cust?.name || "Customer";`;

if (!content.includes(oldLine)) {
  console.error("ERROR: Could not find the line to patch in AppointmentsPage.tsx");
  console.error("Expected:", oldLine);
  process.exit(1);
}

content = content.replace(oldLine, newLines);

// Fix 2: Add customers to the useEffect dependency array
const oldDeps = "  }, [myRepName, appointments, markReminderSent]);";
const newDeps = "  }, [myRepName, appointments, customers, markReminderSent]);";

if (!content.includes(oldDeps)) {
  console.error("ERROR: Could not find dependency array to patch");
  console.error("Expected:", oldDeps);
  process.exit(1);
}

content = content.replace(oldDeps, newDeps);

fs.writeFileSync(filePath, content, "utf-8");
console.log("AppointmentsPage.tsx patched successfully");
