import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";

export const fetchLeadsReport = async () => {
  const snapshot = await getDocs(collection(db, "leads"));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const fetchAttendanceReport = async () => {
  const snapshot = await getDocs(collection(db, "attendance"));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const fetchInvoicesReport = async () => {
  const snapshot = await getDocs(collection(db, "invoices"));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// optional — aggregate functions
export const getLeadStats = (leads: any[]) => {
  const total = leads.length;
  const converted = leads.filter(l => l.status === "converted").length;
  const contacted = leads.filter(l => l.status === "contacted").length;
  const newLeads = leads.filter(l => l.status === "new").length;
  const followups = leads.filter(l => l.status === "followup").length;
  const lost = leads.filter(l => l.status === "lost").length;

  const rate = total ? ((converted / total) * 100).toFixed(1) : 0;

  return {
    total,
    contacted,
    converted,
    newLeads,
    followups,
    lost,
    conversionRate: rate
  };
};