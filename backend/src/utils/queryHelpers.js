// Shared query helpers for search, sort, pagination, bulk ops, and export

const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

/**
 * Build Prisma where clause with search across specified fields
 */
function buildSearchWhere(baseWhere, search, searchFields) {
  if (!search || !searchFields?.length) return baseWhere;
  return {
    ...baseWhere,
    OR: searchFields.map(field => ({
      [field]: { contains: search, mode: 'insensitive' }
    }))
  };
}

/**
 * Parse pagination params from query
 */
function parsePagination(query) {
  const limit = Math.min(parseInt(query.limit) || 50, 200);
  const offset = parseInt(query.offset) || 0;
  return { limit, offset };
}

/**
 * Parse sort params from query
 */
function parseSort(query, defaultField = 'createdAt', defaultOrder = 'desc') {
  const sortBy = query.sortBy || defaultField;
  const sortOrder = (query.sortOrder || defaultOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';
  return { [sortBy]: sortOrder };
}

/**
 * Execute a paginated, searchable, sortable query
 */
async function paginatedQuery(prisma, model, { baseWhere, search, searchFields, query }) {
  const where = buildSearchWhere(baseWhere, search, searchFields);
  const { limit, offset } = parsePagination(query);
  const orderBy = parseSort(query);

  const [data, total] = await Promise.all([
    prisma[model].findMany({ where, orderBy, take: limit, skip: offset }),
    prisma[model].count({ where })
  ]);

  return { data, total, offset, limit };
}

/**
 * Handle bulk delete
 */
async function bulkDelete(prisma, model, userId, ids) {
  if (!ids?.length) throw new Error('No IDs provided');
  const result = await prisma[model].deleteMany({
    where: { id: { in: ids }, userId }
  });
  return { deleted: result.count };
}

/**
 * Handle bulk update
 */
async function bulkUpdate(prisma, model, userId, ids, data) {
  if (!ids?.length) throw new Error('No IDs provided');
  const result = await prisma[model].updateMany({
    where: { id: { in: ids }, userId },
    data
  });
  return { updated: result.count };
}

/**
 * Export data as CSV
 */
function exportCSV(data, fields) {
  if (!data.length) return '';
  const parser = new Parser({ fields: fields || Object.keys(data[0]) });
  return parser.parse(data);
}

/**
 * Export data as PDF and pipe to response
 */
function exportPDF(res, data, title, fields) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.pdf"`);
  doc.pipe(res);

  // Title
  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor('#666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(1);

  if (!data.length) {
    doc.fontSize(12).fillColor('#333').text('No data to display.');
    doc.end();
    return;
  }

  const cols = fields || Object.keys(data[0]).filter(k => !['userId', 'updatedAt'].includes(k));
  const colWidth = Math.min(Math.floor(720 / cols.length), 150);

  // Header row
  doc.fontSize(7).fillColor('#fff');
  let x = 40;
  const headerY = doc.y;
  doc.rect(40, headerY - 2, colWidth * cols.length, 16).fill('#1a237e');
  doc.fillColor('#fff');
  cols.forEach(col => {
    doc.text(col, x + 2, headerY + 2, { width: colWidth - 4, ellipsis: true });
    x += colWidth;
  });
  doc.moveDown(0.3);

  // Data rows
  doc.fillColor('#333').fontSize(6);
  const maxRows = Math.min(data.length, 50);
  for (let i = 0; i < maxRows; i++) {
    const row = data[i];
    const rowY = doc.y;
    if (rowY > 540) {
      doc.addPage();
      doc.y = 40;
    }
    if (i % 2 === 0) {
      doc.rect(40, doc.y - 1, colWidth * cols.length, 13).fill('#f5f5f5');
      doc.fillColor('#333');
    }
    x = 40;
    cols.forEach(col => {
      let val = row[col];
      if (val === null || val === undefined) val = '';
      else if (typeof val === 'object') val = JSON.stringify(val).substring(0, 30);
      else val = String(val).substring(0, 30);
      doc.text(val, x + 2, doc.y + 1, { width: colWidth - 4, ellipsis: true });
      x += colWidth;
    });
    doc.moveDown(0.2);
  }

  if (data.length > maxRows) {
    doc.moveDown(0.5);
    doc.fontSize(8).text(`... and ${data.length - maxRows} more rows`, { align: 'center' });
  }

  doc.end();
}

/**
 * Handle export endpoint (CSV, PDF, or JSON)
 */
async function handleExport(res, prisma, model, userId, query, title, exportFields) {
  const format = (query.format || 'json').toLowerCase();
  const where = buildSearchWhere({ userId }, query.search, exportFields);
  const data = await prisma[model].findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });

  if (format === 'csv') {
    const csv = exportCSV(data, exportFields);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.csv"`);
    return res.send(csv);
  }

  if (format === 'pdf') {
    return exportPDF(res, data, title, exportFields);
  }

  // Default: JSON
  res.json({ data, total: data.length });
}

module.exports = {
  buildSearchWhere,
  parsePagination,
  parseSort,
  paginatedQuery,
  bulkDelete,
  bulkUpdate,
  exportCSV,
  exportPDF,
  handleExport
};
