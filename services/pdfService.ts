import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Transaction, SpendingSummary } from "../types";

export const generateBookPDF = (bookName: string, transactions: Transaction[], summary: SpendingSummary) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // --- Header Section ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(31, 41, 55); // Gray 800
  doc.text("Leverizaland Incorporated", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(107, 114, 128); // Gray 500
  doc.text(`Cashbook: ${bookName}`, 14, 28);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 34);

  // --- Summary Section ---
  const summaryStartY = 42;
  doc.setDrawColor(229, 231, 235); // Gray 200
  doc.setFillColor(249, 250, 251); // Gray 50
  doc.roundedRect(14, summaryStartY, pageWidth - 28, 25, 3, 3, 'FD');

  const textY = summaryStartY + 10;
  const valY = summaryStartY + 18;

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128); // Gray 500
  doc.text("Total Income", 24, textY);
  doc.text("Total Expenses", 84, textY);
  doc.text("Net Balance", 144, textY);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  
  doc.setTextColor(16, 185, 129); // Emerald 600
  doc.text(`+${summary.totalIncome.toFixed(2)}`, 24, valY);

  doc.setTextColor(220, 38, 38); // Red 600
  doc.text(`-${summary.totalExpense.toFixed(2)}`, 84, valY);

  const balanceColor = summary.balance >= 0 ? [16, 185, 129] : [220, 38, 38];
  doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
  doc.text(`${summary.balance >= 0 ? '+' : ''}${summary.balance.toFixed(2)}`, 144, valY);

  // --- Table Section ---
  
  // Sort transactions chronologically (Oldest to Newest) for the running balance to make sense
  const reportTransactions = [...transactions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runningBalance = 0;

  const tableRows = reportTransactions.map(t => {
    const isIncome = t.type === 'INCOME';
    const amount = t.amount;
    
    // Update running balance
    if (isIncome) {
        runningBalance += amount;
    } else {
        runningBalance -= amount;
    }

    return [
      t.date.split('T')[0],
      t.description,
      t.category,
      isIncome ? `${amount.toFixed(2)}` : '-', // Debit
      !isIncome ? `${amount.toFixed(2)}` : '-', // Credit
      `${runningBalance.toFixed(2)}` // Balance
    ];
  });

  autoTable(doc, {
    startY: summaryStartY + 35,
    head: [['Date', 'Description', 'Category', 'Debit', 'Credit', 'Balance']],
    body: tableRows,
    theme: 'grid',
    headStyles: { 
        fillColor: [79, 70, 229], // Indigo 600
        textColor: 255,
        halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 25 }, // Date
      1: { cellWidth: 'auto' }, // Description
      2: { cellWidth: 35 }, // Category
      3: { cellWidth: 25, halign: 'right', textColor: [16, 185, 129] }, // Debit (Green)
      4: { cellWidth: 25, halign: 'right', textColor: [220, 38, 38] }, // Credit (Red)
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }, // Balance
    },
    didParseCell: function(data) {
        // Color code the Balance column if negative
        if (data.section === 'body' && data.column.index === 5) {
             const balanceStr = data.cell.raw as string;
             // Remove commas if formatting adds them later, but here it's raw string
             const balanceVal = parseFloat(balanceStr);
             if (balanceVal < 0) {
                 data.cell.styles.textColor = [220, 38, 38];
             } else {
                 data.cell.styles.textColor = [31, 41, 55]; // Dark Gray
             }
        }
    }
  });

  doc.save(`${bookName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf`);
};