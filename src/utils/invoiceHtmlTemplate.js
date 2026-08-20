/**
 * Exact Shared HTML Invoice Template Generator (Node.js & Browser unified)
 * Generates the 100% exact same HTML as frontend generateInvoicePDF.js
 */
const generateInvoiceHTML = (order = {}) => {
  let parsedNotes = {};
  if (order.notes) {
    try {
      parsedNotes = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
    } catch (e) {}
  }

  const rawId = order.id || order.orderNumber || 'SHARNA-ORDER';
  const cleanOrderId = String(rawId).replace(/^#+/, '');
  const invoiceNo = `#${cleanOrderId}`;
  const orderDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const customerName = parsedNotes.shippingName || order.shippingAddress?.fullName || order.user?.name || 'Mr. Priyanshu Lokhande';
  const customerEmail = parsedNotes.shippingEmail || order.user?.email || 'priyanshulokhande72@gmail.com';
  const customerPhone = parsedNotes.shippingPhone || order.shippingAddress?.phone || order.user?.phone || '+91 7999715256';

  const street = order.shippingAddress?.streetAddress || order.shippingStreet || 'At, post';
  const city = order.shippingAddress?.city || order.shippingCity || 'Khedi Sawligarh';
  const state = order.shippingAddress?.state || order.shippingState || 'Madhya Pradesh';
  const pincode = order.shippingAddress?.postalCode || order.shippingPostalCode || '460225';
  const country = order.shippingAddress?.country || order.shippingCountry || 'India';

  const totalAmount = Number(order.totalAmount || 0);
  const shippingAmount = Number(order.shippingAmount || 0);
  const subtotalAmount = totalAmount - shippingAmount;

  const gstRate = 0.12;
  const taxableValue = Math.round(subtotalAmount / (1 + gstRate));
  const totalGst = subtotalAmount - taxableValue;

  const formatCurrency = (val) => '₹' + Math.round(Number(val || 0)).toLocaleString('en-IN');

  const fullLogoUrl = 'https://sharna.in/src/assets/logo.png';

  const items = order.items && order.items.length > 0 ? order.items : [
    { title: 'SHARNA Luxury Outfit', quantity: 1, price: totalAmount, size: 'M', color: 'Default' }
  ];

  const itemsHtml = items.map((item, index) => {
    const itemTitle = item.product?.title || item.title || 'SHARNA Luxury Outfit';
    const itemPrice = Number(item.price || 0);
    const itemQty = Number(item.quantity || 1);
    const itemTotal = itemPrice * itemQty;

    return `
      <tr style="border-bottom: 1px solid #F0E6D8;">
        <td style="padding: 13px 10px; text-align: center; color: #7A6960; font-size: 11px; font-weight: 600;">${index + 1}</td>
        <td style="padding: 13px 10px; color: #1E1915; font-weight: 600; font-size: 11.5px;">
          ${itemTitle}
          <div style="font-size: 10px; color: #8A796E; font-weight: 400; margin-top: 2px;">HSN Code: 6204 • Handcrafted Ethnic Garment</div>
        </td>
        <td style="padding: 13px 10px; text-align: center; color: #5C4E46; font-size: 11px;">
          ${item.size ? `<span style="background:#FAF4EB; border:1px solid #EAE1D5; padding:2px 6px; border-radius:3px; font-size:10px;">Size: ${item.size}</span>` : 'Free Size'}
          ${item.color ? ` <span style="background:#FAF4EB; border:1px solid #EAE1D5; padding:2px 6px; border-radius:3px; font-size:10px;">Color: ${item.color}</span>` : ''}
        </td>
        <td style="padding: 13px 10px; text-align: center; color: #1E1915; font-weight: 700; font-size: 11.5px;">${itemQty}</td>
        <td style="padding: 13px 10px; text-align: right; color: #5C4E46; font-size: 11.5px;">${formatCurrency(itemPrice)}</td>
        <td style="padding: 13px 10px; text-align: right; color: #1E1915; font-weight: 700; font-size: 12px;">${formatCurrency(itemTotal)}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>SHARNA Tax Invoice - ${invoiceNo}</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- html2pdf Library for Instant Direct PDF File Generation -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800&family=Montserrat:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
    
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background-color: #ffffff;
      color: #2D231E;
      font-family: 'DM Sans', 'Montserrat', -apple-system, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .invoice-box {
      max-width: 820px;
      margin: 0 auto;
      border: 1px solid #E5D8C8;
      padding: 38px 40px;
      background: #FAF7F2;
      box-shadow: 0 10px 30px rgba(0,0,0,0.05);
      position: relative;
    }

    /* Gold Foil Border Accent */
    .invoice-box::before {
      content: '';
      position: absolute;
      top: 8px; left: 8px; right: 8px; bottom: 8px;
      border: 1px dashed #C5A86B;
      pointer-events: none;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #6B3E3E;
      padding-bottom: 20px;
      margin-bottom: 25px;
      gap: 20px;
    }

    .brand-section {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .brand-logo-img {
      height: 60px;
      width: auto;
      object-fit: contain;
      border-radius: 4px;
    }

    .brand-text-wrap {
      display: flex;
      flex-direction: column;
    }

    .brand-tagline {
      font-size: 9.5px;
      letter-spacing: 0.2em;
      color: #C5A86B;
      text-transform: uppercase;
      margin-top: 4px;
      font-weight: 600;
    }

    .invoice-title-badge {
      text-align: right;
    }

    .invoice-badge-text {
      background-color: #6B3E3E;
      color: #FAF7F2;
      font-family: 'Cinzel', serif;
      font-size: 11px;
      letter-spacing: 0.15em;
      padding: 6px 14px;
      display: inline-block;
      border-radius: 3px;
      text-transform: uppercase;
    }

    .invoice-meta-date {
      font-size: 11px;
      color: #5C4E46;
      margin-top: 8px;
      line-height: 1.5;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 25px;
    }

    .info-card {
      background: #ffffff;
      border: 1px solid #EAE1D5;
      padding: 16px 18px;
      border-radius: 4px;
    }

    .info-card h4 {
      font-family: 'Cinzel', serif;
      font-size: 11px;
      letter-spacing: 0.1em;
      color: #6B3E3E;
      margin: 0 0 10px 0;
      text-transform: uppercase;
      border-bottom: 1px solid #F5EBE0;
      padding-bottom: 5px;
    }

    .info-card p {
      margin: 3px 0;
      font-size: 11.5px;
      color: #5C4E46;
      line-height: 1.5;
    }

    .info-card strong {
      color: #1E1915;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
      background: #ffffff;
      border: 1px solid #EAE1D5;
    }

    th {
      background: #6B3E3E;
      color: #FAF7F2;
      font-family: 'Cinzel', serif;
      font-size: 10px;
      letter-spacing: 0.1em;
      padding: 10px;
      text-transform: uppercase;
    }

    .summary-wrapper {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      gap: 20px;
    }

    .payment-notes {
      width: 50%;
      background: #ffffff;
      border: 1px solid #EAE1D5;
      padding: 14px 16px;
      border-radius: 4px;
      font-size: 11px;
      color: #5C4E46;
    }

    .payment-notes-title {
      font-weight: 700;
      color: #488B49;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
      font-size: 11.5px;
    }

    .totals-card {
      width: 44%;
      background: #ffffff;
      border: 1px solid #EAE1D5;
      padding: 16px;
      border-radius: 4px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      margin-bottom: 6px;
      color: #5C4E46;
    }

    .totals-row.grand-total {
      border-top: 2px solid #6B3E3E;
      padding-top: 10px;
      margin-top: 10px;
      font-size: 15px;
      font-weight: 700;
      color: #6B3E3E;
    }

    .footer-note {
      text-align: center;
      border-top: 1px solid #EAE1D5;
      padding-top: 20px;
      font-size: 10px;
      color: #8A796E;
      line-height: 1.6;
    }

    @media print {
      body { padding: 0; background: none; }
      .invoice-box { border: none; box-shadow: none; padding: 20px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <div class="no-print" style="max-width: 820px; margin: 0 auto 16px; display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
    <button id="downloadPdfBtn" onclick="downloadDirectPDF()" style="background-color: #1E1915; color: #FAF7F2; border: 1px solid #A67E39; padding: 10px 20px; font-family: 'Montserrat', sans-serif; font-size: 11.5px; font-weight: 700; letter-spacing: 0.1em; border-radius: 30px; cursor: pointer; box-shadow: 0 4px 14px rgba(30, 25, 21, 0.2); display: flex; align-items: center; gap: 6px;">
      ⬇️ DOWNLOAD PDF FILE
    </button>
    <button onclick="window.print()" style="background-color: #6B3E3E; color: white; border: none; padding: 10px 20px; font-family: 'Montserrat', sans-serif; font-size: 11.5px; font-weight: 600; border-radius: 30px; cursor: pointer; box-shadow: 0 4px 14px rgba(107, 62, 62, 0.25); display: flex; align-items: center; gap: 6px;">
      🖨️ PRINT INVOICE
    </button>
  </div>

  <div class="invoice-box" id="invoiceArea">
    
    <div class="header">
      <div class="brand-section">
        <img src="${fullLogoUrl}" alt="SHARNA" class="brand-logo-img" onerror="this.style.display='none'" />
        <div class="brand-text-wrap">
          <div class="brand-tagline">Women's Ethnic Luxury • Co-ords • Kurtas • Suits</div>
        </div>
      </div>
      
      <div class="invoice-title-badge">
        <div class="invoice-badge-text">OFFICIAL TAX INVOICE</div>
        <div class="invoice-meta-date">
          Invoice #: <strong>${invoiceNo}</strong><br/>
          Date: <strong>${orderDate}</strong>
        </div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="info-card">
        <h4>Seller & Supplier Details</h4>
        <p><strong>SHARNA (sharna.in)</strong></p>
        <p>Studio & Flagship Headquarters</p>
        <p>Jabalpur, Madhya Pradesh - <strong>482001</strong>, India</p>
        <p>GSTIN: <strong>23AAGCS1234F1Z9</strong></p>
        <p>Support Phone: <strong>+91 62682 18135</strong></p>
        <p>Support Email: <strong>support@sharna.in</strong></p>
        <p>Website: <strong>https://sharna.in</strong></p>
      </div>

      <div class="info-card">
        <h4>Billed & Shipped To</h4>
        <p>Customer Name: <strong>${customerName}</strong></p>
        <p>Address: <strong>${street}</strong></p>
        <p>${city}, ${state} - <strong>${pincode}</strong>, ${country}</p>
        <p>Phone: <strong>${customerPhone}</strong></p>
        <p>Email: <strong>${customerEmail}</strong></p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th style="text-align: left;">Item Description</th>
          <th>Size / Color</th>
          <th>Qty</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Total (INR)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="summary-wrapper">
      <div class="payment-notes">
        <div class="payment-notes-title">
          ✔ PAYMENT CONFIRMED (PAID ONLINE)
        </div>
        <p style="margin: 4px 0 0 0;">Transaction Processed via <strong>Razorpay Secured Gateway</strong>.</p>
        <p style="margin: 4px 0 0 0; font-size: 10px; color: #8A796E;">All taxes (CGST 6% + SGST 6%) are included in total amount as per Indian GST Regulations.</p>
      </div>

      <div class="totals-card">
        <div class="totals-row">
          <span>Item Subtotal (Excl. Tax):</span>
          <span>${formatCurrency(taxableValue)}</span>
        </div>
        <div class="totals-row">
          <span>Estimated GST (12%):</span>
          <span>${formatCurrency(totalGst)}</span>
        </div>
        <div class="totals-row">
          <span>Shipping & Logistics:</span>
          <span style="color: #488B49; font-weight: 600;">${shippingAmount === 0 ? 'Complimentary' : formatCurrency(shippingAmount)}</span>
        </div>
        <div class="totals-row grand-total">
          <span>TOTAL PAID:</span>
          <span>${formatCurrency(totalAmount)}</span>
        </div>
      </div>
    </div>

    <div class="footer-note">
      Thank you for choosing <strong>SHARNA</strong>. For returns, exchanges or support inquiries, please contact <strong>support@sharna.in</strong>.<br/>
      This is a computer-generated official tax receipt. No signature is required.
    </div>

  </div>

  <script>
    function downloadDirectPDF() {
      const btn = document.getElementById('downloadPdfBtn');
      if (btn) btn.innerText = '⏳ Generating PDF...';
      
      const element = document.getElementById('invoiceArea');
      const opt = {
        margin:       [6, 6, 6, 6],
        filename:     'SHARNA-Tax-Invoice-${cleanOrderId}.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(element).save().then(function() {
          if (btn) btn.innerText = '⬇️ DOWNLOAD PDF FILE';
        }).catch(function(err) {
          console.warn('PDF save fallback:', err);
          window.print();
        });
      } else {
        window.print();
      }
    }
  </script>
</body>
</html>`;
};

module.exports = { generateInvoiceHTML };
