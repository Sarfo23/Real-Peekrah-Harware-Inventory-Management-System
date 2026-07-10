import React, { useState } from 'react';
import * as XLSX from 'xlsx';

/**
 * BulkImporter Component
 * Allows uploading Excel/CSV files to bulk import products or stock movements.
 */
const BulkImporter = ({ onImportComplete }) => {
  const [importType, setImportType] = useState('products'); // 'products' or 'movements'
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [validationErrors, setValidationErrors] = useState([]);

  // Helper to normalize keys to match backend expectations
  const normalizeKeys = (row, type) => {
    const normalized = {};
    const keys = Object.keys(row);

    if (type === 'products') {
      keys.forEach(k => {
        const lowerK = k.toLowerCase().replace(/[\s_-]/g, '');
        if (lowerK.includes('name')) normalized.name = row[k];
        else if (lowerK.includes('umo') || lowerK.includes('sku')) normalized.sku = String(row[k]);
        else if (lowerK.includes('category')) normalized.categoryName = row[k];
        else if (lowerK.includes('cost')) normalized.costPrice = parseFloat(row[k]) || 0;
        else if (lowerK.includes('sell')) normalized.sellingPrice = parseFloat(row[k]) || 0;
        else if (lowerK.includes('threshold') || lowerK.includes('limit') || lowerK.includes('low')) {
          normalized.lowStockThreshold = parseInt(row[k]) || 10;
        }
      });
      // Fallbacks
      if (!normalized.name) normalized.name = '';
      if (!normalized.sku) normalized.sku = '';
      if (!normalized.categoryName) normalized.categoryName = '';
    } else {
      keys.forEach(k => {
        const lowerK = k.toLowerCase().replace(/[\s_-]/g, '');
        if (lowerK.includes('productname') || lowerK.includes('product') || lowerK.includes('name')) normalized.productName = row[k];
        else if (lowerK.includes('warehouse') || lowerK.includes('location') || lowerK.includes('shop')) normalized.warehouseName = row[k];
        else if (lowerK.includes('type')) normalized.type = String(row[k]).toUpperCase();
        else if (lowerK.includes('qty') || lowerK.includes('quantity')) normalized.quantity = parseInt(row[k]) || 0;
        else if (lowerK.includes('user')) normalized.userId = parseInt(row[k]) || 1;
      });
      if (!normalized.userId) normalized.userId = 1;
    }
    return normalized;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setPreviewData([]);
    setValidationErrors([]);
    setMessage({ text: '', type: '' });

    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Read raw JSON rows
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        if (rawRows.length === 0) {
          setMessage({ text: 'The selected sheet is empty.', type: 'error' });
          return;
        }

        // Normalize keys
        const processed = rawRows.map(row => normalizeKeys(row, importType));
        
        // Extract headers from first processed item
        setHeaders(Object.keys(processed[0]));
        setPreviewData(processed);

        // Basic front-end verification
        const localErrors = [];
        processed.forEach((item, index) => {
          const rowNum = index + 2;
          if (importType === 'products') {
            if (!item.name) localErrors.push(`Row ${rowNum}: Product Name is missing.`);
            if (!item.sku) localErrors.push(`Row ${rowNum}: UMO (Pieces or Boxes) is missing.`);
            if (!item.categoryName) localErrors.push(`Row ${rowNum}: Category Name is missing.`);
          } else {
            if (!item.productName) localErrors.push(`Row ${rowNum}: Product Name is missing.`);
            if (!item.warehouseName) localErrors.push(`Row ${rowNum}: Warehouse or Shop name is missing.`);
            if (!item.type || !['IN', 'OUT'].includes(item.type)) {
              localErrors.push(`Row ${rowNum}: Type must be either "IN" or "OUT" (got "${item.type || ''}").`);
            }
            if (!item.quantity || item.quantity <= 0) {
              localErrors.push(`Row ${rowNum}: Quantity must be a positive integer.`);
            }
          }
        });

        if (localErrors.length > 0) {
          setValidationErrors(localErrors);
          setMessage({ text: `Pre-validation found ${localErrors.length} issues in the sheet. Please fix them before uploading.`, type: 'error' });
        } else {
          setMessage({ text: `Successfully parsed ${processed.length} rows. Ready for upload.`, type: 'success' });
        }

      } catch (err) {
        console.error(err);
        setMessage({ text: 'Failed to read spreadsheet file. Make sure it is a valid CSV or Excel file.', type: 'error' });
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleUpload = async () => {
    if (previewData.length === 0) return;
    setLoading(true);
    setMessage({ text: '', type: '' });
    setValidationErrors([]);

    const endpoint = importType === 'products' ? '/api/products/bulk-create' : '/api/inventory/bulk-move';
    let result = null;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewData)
      });

      result = await response.json();

      if (response.ok) {
        alert(`Bulk import successful: ${result.message}`);
        setMessage({ text: `Success: ${result.message}`, type: 'success' });
        setPreviewData([]);
        setFile(null);
        // Clear input element
        const fileInput = document.getElementById('bulk-file-input');
        if (fileInput) fileInput.value = '';
        if (onImportComplete) onImportComplete();
      } else {
        throw new Error(result.error || 'Import failed');
      }
    } catch (err) {
      setMessage({ text: `Error: ${err.message}`, type: 'error' });
      if (result && result.details) {
        setValidationErrors(result.details);
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    let headersArr = [];
    let sampleRow = [];
    let filename = '';

    if (importType === 'products') {
      headersArr = ['Product Name', 'UMO', 'Category Name', 'Cost Price', 'Selling Price', 'Low Stock Threshold'];
      sampleRow = ['Cisco Switch C9300', 'PCS', 'Switches', '1200.00', '1650.00', '15'];
      filename = 'HIMS_Products_Import_Template.csv';
    } else {
      headersArr = ['Product Name', 'Warehouse Name', 'Type', 'Quantity', 'User ID'];
      sampleRow = ['Cisco Catalyst 9300', 'Central Hub', 'IN', '25', '1'];
      filename = 'HIMS_Movements_Import_Template.csv';
    }

    const csvContent = [headersArr, sampleRow].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bulk-importer-container">
      <div className="import-toggle-row">
        <button 
          type="button" 
          className={`toggle-btn ${importType === 'products' ? 'active' : ''}`}
          onClick={() => {
            setImportType('products');
            setFile(null);
            setPreviewData([]);
            setValidationErrors([]);
            setMessage({ text: '', type: '' });
          }}
        >
          📦 Import Products Catalog
        </button>
        <button 
          type="button" 
          className={`toggle-btn ${importType === 'movements' ? 'active' : ''}`}
          onClick={() => {
            setImportType('movements');
            setFile(null);
            setPreviewData([]);
            setValidationErrors([]);
            setMessage({ text: '', type: '' });
          }}
        >
          🔄 Import Stock Movements
        </button>
      </div>

      <div className="importer-card card-inside-row">
        <h4>
          {importType === 'products' ? 'Bulk Product Creation' : 'Bulk Stock Movements'}
        </h4>
        <p className="importer-desc">
          {importType === 'products' 
            ? 'Add multiple new hardware product items with base costs and low-stock warning thresholds.' 
            : 'Record multiple warehouse restocks (IN) or dispatch movements (OUT) in a single action.'
          }
        </p>

        <div className="action-row">
          <button type="button" onClick={downloadTemplate} className="btn-secondary">
            📥 Download Spreadsheet Template
          </button>
          
          <div className="file-input-wrapper">
            <input 
              id="bulk-file-input"
              type="file" 
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
              className="file-input-raw"
            />
            <label htmlFor="bulk-file-input" className="file-input-label">
              {file ? `📁 ${file.name}` : '📄 Choose CSV or Excel File'}
            </label>
          </div>
        </div>
      </div>

      {message.text && (
        <div className={`form-message ${message.type}`}>
          {message.text}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="validation-error-box">
          <h5>⚠️ Review Spreadsheet Issues:</h5>
          <ul>
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {previewData.length > 0 && (
        <div className="preview-section">
          <h4>Sheet Data Preview ({previewData.length} rows)</h4>
          <div className="preview-table-wrapper">
            <table className="preview-table">
              <thead>
                <tr>
                  {headers.map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 10).map((row, idx) => (
                  <tr key={idx}>
                    {headers.map(h => (
                      <td key={h}>{String(row[h] !== undefined ? row[h] : '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewData.length > 10 && (
            <p className="preview-more-label">... and {previewData.length - 10} more rows.</p>
          )}

          <button 
            type="button" 
            onClick={handleUpload} 
            disabled={loading || validationErrors.length > 0}
            className="btn-upload-confirm"
          >
            {loading ? 'Uploading & Executing Batch...' : 'Confirm Upload & Execute'}
          </button>
        </div>
      )}

      <style jsx>{`
        .bulk-importer-container {
          padding: 5px;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .import-toggle-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 5px;
        }
        .toggle-btn {
          padding: 10px;
          background-color: #f1f5f9 !important;
          color: #475569 !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 4px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .toggle-btn:hover {
          background-color: #e2e8f0 !important;
        }
        .toggle-btn.active {
          background-color: var(--hw-steel) !important;
          color: white !important;
          border-color: var(--hw-steel) !important;
        }
        .card-inside-row {
          background-color: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 4px;
          padding: 15px;
        }
        .card-inside-row h4 {
          margin: 0 0 6px 0;
          color: #1e293b;
        }
        .importer-desc {
          margin: 0 0 15px 0;
          font-size: 12px;
          color: #64748b;
        }
        .action-row {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
          align-items: center;
        }
        .btn-secondary {
          background-color: #e2e8f0 !important;
          color: #1e293b !important;
          border: 1px solid #cbd5e1 !important;
          padding: 8px 15px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        }
        .btn-secondary:hover {
          background-color: #cbd5e1 !important;
        }
        .file-input-wrapper {
          position: relative;
          display: inline-block;
        }
        .file-input-raw {
          position: absolute;
          left: 0;
          top: 0;
          opacity: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
        }
        .file-input-label {
          display: inline-block;
          background-color: var(--hw-orange);
          color: white;
          padding: 8px 15px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          user-select: none;
          text-align: center;
          transition: background 0.15s ease;
        }
        .file-input-label:hover {
          background-color: var(--hw-orange-hover);
        }
        .form-message {
          padding: 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        .form-message.success {
          background-color: #d1fae5;
          color: #065f46;
          border: 1px solid #10b981;
        }
        .form-message.error {
          background-color: #fee2e2;
          color: #991b1b;
          border: 1px solid #ef4444;
        }
        .validation-error-box {
          background-color: #fef2f2;
          border: 1px solid #fca5a5;
          border-radius: 4px;
          padding: 12px;
        }
        .validation-error-box h5 {
          margin: 0 0 6px 0;
          color: #991b1b;
          font-weight: 700;
        }
        .validation-error-box ul {
          margin: 0;
          padding-left: 20px;
          font-size: 12px;
          color: #991b1b;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .preview-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 5px;
        }
        .preview-section h4 {
          margin: 0;
          font-size: 13px;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .preview-table-wrapper {
          max-height: 250px;
          overflow-y: auto;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
        }
        .preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .preview-table th, .preview-table td {
          padding: 8px 10px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        .preview-table th {
          background-color: #f1f5f9;
          position: sticky;
          top: 0;
          font-weight: 700;
          color: #475569;
        }
        .preview-more-label {
          font-size: 11px;
          color: #64748b;
          font-style: italic;
          margin: 0;
        }
        .btn-upload-confirm {
          width: 100%;
          padding: 10px;
          background-color: #10b981 !important;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 800;
          text-transform: uppercase;
          transition: background 0.15s ease;
        }
        .btn-upload-confirm:hover {
          background-color: #059669 !important;
        }
        .btn-upload-confirm:disabled {
          background-color: #cbd5e1 !important;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default BulkImporter;
