import { apiRequest } from '../api/client.js';

function buildExportFileName(prefix, from, to, format) {
  const safePrefix = (prefix || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const safeFrom = from.slice(0, 10);
  const safeTo = to.slice(0, 10);

  return `${safePrefix}_${safeFrom}_${safeTo}.${format}`;
}

async function downloadFile({ fridgeId, from, to, format, filename }) {
  const blob = await apiRequest(
    `/exports/readings?fridgeId=${encodeURIComponent(fridgeId || 'all')}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=${format}`,
    { method: 'GET' },
    { responseType: 'blob' }
  );

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export function ExportButtons({ fridgeId = 'all', from, to, filenamePrefix = 'export' }) {
  const formats = [
    { key: 'csv', label: 'CSV' },
    { key: 'xlsx', label: 'Excel' },
    { key: 'pdf', label: 'PDF' }
  ];

  async function handleDownload(format) {
    const filename = buildExportFileName(filenamePrefix, from, to, format);
    await downloadFile({ fridgeId, from, to, format, filename });
  }

  return (
    <div className="export-buttons">
      {formats.map((format) => (
        <button
          key={format.key}
          className="button button-secondary"
          type="button"
          onClick={() => handleDownload(format.key)}
        >
          Exportar {format.label}
        </button>
      ))}
    </div>
  );
}