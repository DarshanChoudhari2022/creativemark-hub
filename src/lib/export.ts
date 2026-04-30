/**
 * Export data to CSV
 * Mobile-safe: uses multiple download strategies for WebView/PWA compatibility.
 * @param data Array of objects to export
 * @param filename Name of the file
 */
export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Add headers
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const escaped = ('' + val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const fname = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Try anchor download first
  const link = document.createElement('a');
  link.href = url;
  link.download = fname;
  link.target = '_blank';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // On mobile, anchor downloads are often blocked in WebView —
  // open the blob URL in a new tab so the user can view/save it
  if (isMobile) {
    setTimeout(() => {
      const win = window.open(url, '_blank');
      if (!win) {
        // Last resort: navigate directly
        window.location.href = url;
      }
    }, 500);
  }

  // Cleanup blob URL after a generous delay
  setTimeout(() => URL.revokeObjectURL(url), 30000);
};
