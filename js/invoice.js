import { store } from './store.js';

export async function generateInvoice(event) {
    if (!window.jspdf) {
        alert("PDF library not loaded. Please refresh the page.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // -- Helper Constants
    const margin = 20;
    const lineHeight = 10;
    let y = margin;

    // -- Fetch Client Data
    const client = store.clients.find(c => c.id === event.clientId);
    const clientName = client ? client.name : (event.clientName || 'Unknown Client');
    const clientAddress = client ? (client.address || '') : '';
    const clientPhone = client ? (client.phone || '') : '';

    // -- Header (Company Logo/Name)
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // Blue-600
    doc.text("Speedyex Filtre", margin, y);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Professional Filter Services", margin, y + 6);
    // Add Company Info here if available (e.g. Phone, Address)
    doc.text("Mobile: +1 234 567 890", margin, y + 12);

    // -- Invoice Title & Date
    y += 30;
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text("INVOICE", pageWidth - margin, y, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Invoice #: INV-${event.id.slice(0, 6).toUpperCase()}`, pageWidth - margin, y + 6, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin, y + 12, { align: 'right' });

    // -- Bill To
    y += 10;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", margin, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80);
    y += 6;
    doc.text(clientName, margin, y);
    if (clientAddress) {
        y += 5;
        // Split long address
        const splitAddress = doc.splitTextToSize(clientAddress, 80);
        doc.text(splitAddress, margin, y);
        y += (splitAddress.length - 1) * 5;
    }
    if (clientPhone) {
        y += 5;
        doc.text(clientPhone, margin, y);
    }

    // -- Service Details (Table Header)
    y += 20;
    doc.setFillColor(243, 244, 246); // Gray-100
    doc.rect(margin, y, pageWidth - (margin * 2), 10, 'F');

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Description", margin + 5, y + 7);
    doc.text("Amount", pageWidth - margin - 5, y + 7, { align: 'right' });

    // -- Line Items
    y += 15;
    doc.setFont("helvetica", "normal");

    const description = `${event.type} Service`;
    const dateDesc = `Date: ${event.date}`;
    const cost = parseFloat(event.cost || 0).toFixed(2);

    doc.text(description, margin + 5, y);
    doc.text(`$${cost}`, pageWidth - margin - 5, y, { align: 'right' });

    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(dateDesc, margin + 5, y);

    if (event.notes) {
        y += 5;
        const notes = `Notes: ${event.notes}`;
        doc.text(notes, margin + 5, y);
    }

    // -- Total
    y += 20;
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);

    y += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Total:", pageWidth - margin - 40, y);
    doc.text(`$${cost}`, pageWidth - margin - 5, y, { align: 'right' });

    // -- Footer
    y = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.setFont("helvetica", "italic");
    doc.text("Thank you for your business!", pageWidth / 2, y, { align: 'center' });

    // Save
    doc.save(`Invoice_${clientName.replace(/\s+/g, '_')}_${event.date}.pdf`);
}
