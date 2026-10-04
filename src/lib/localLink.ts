              // CRITICAL FIX: salesRep.list reads from sgf_salesReps (Firebase salesReps path).
              // Sales reps are NOT users — they have their own data structure in Firebase.
              case "salesRep.list": await smartSync("salesReps", "sgf_salesReps"); result = dataService.salesRep.list(); break;
              case "salesRep.getStats": await smartSync("salesReps", "sgf_salesReps"); result = dataService.salesRep.getStats(); break;