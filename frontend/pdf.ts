import jsPDF from "jspdf";
import type { FeedbackData } from "@/frontend/api";

export function exportFeedbackToPdf(feedback: FeedbackData, exportedBy: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  let y = 50;

  const addLine = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(label, marginX, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(value || "-", 515);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 14 + 12;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("FeedForward Feedback Submission", marginX, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Exported on: ${new Date().toLocaleString()}`, marginX, y);
  y += 14;
  doc.text(`Exported by: ${exportedBy}`, marginX, y);
  y += 22;

  addLine("Tracking ID", feedback.id);
  addLine("Type", feedback.type);
  addLine("Category", feedback.category);
  addLine("Severity Level", feedback.priority || "Medium");
  addLine("Status", feedback.status);
  addLine("Submitted By", feedback.isAnonymous ? "Anonymous" : feedback.userName || "- ");
  addLine("Submitted At", new Date(feedback.createdAt).toLocaleString());
  addLine("Last Updated", new Date(feedback.updatedAt).toLocaleString());
  addLine("Subject", feedback.subject);
  addLine("Message", feedback.message);

  if (feedback.response) {
    addLine("Admin Response", feedback.response);
  }

  doc.save(`feedback-${feedback.id}.pdf`);
}
