const PDFDocument = require('pdfkit');
let DocumentModule = null;
try {
  DocumentModule = require('docx');
} catch (error) {
  console.warn("docx package is not installed. DOCX export will be unavailable until it is installed.");
}

const PAGE_MARGIN = 50;
const SECTION_GAP = 14;
const HEADER_BG = '#dbeafe';
const HEADER_TEXT = '#1e40af';
const BORDER = '#cbd5e1';
const ODD_ROW_BG = '#f8fafc';
const TEXT_COLOR = '#0f172a';
const SUBTLE_TEXT = '#475569';

const sanitizeText = (value = '') => String(value).replace(/\r\n/g, '\n').trim();
const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isChartSpec = (value = null) =>
  isPlainObject(value) &&
  typeof value.title === 'string' &&
  Array.isArray(value.data);

const isStructuredReportPayload = (value = null) =>
  isPlainObject(value) &&
  typeof value.title === 'string' &&
  isPlainObject(value.summary) &&
  Array.isArray(value.charts) &&
  Array.isArray(value.table);

const stringifyValue = (value) => {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return value.replace(/\r\n/g, '\n');
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  return JSON.stringify(value);
};

const humanizeLabel = (value = '') =>
  String(value)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

const titleCaseLabel = (value = '') =>
  humanizeLabel(value)
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(' ');

const formatNumber = (value, digits = 2) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return stringifyValue(value);
  }

  return numericValue.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).replace(/\.00$/, '');
};

const formatSummaryMetricValue = (key, value) => {
  const normalizedKey = String(key || '').toLowerCase();
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return stringifyValue(value);
  }

  if (/package/.test(normalizedKey)) {
    return `${formatNumber(numericValue, 2)} LPA`;
  }

  if (/attendance|percentage|percent|rate|compliance/.test(normalizedKey)) {
    return `${formatNumber(numericValue, 2)}%`;
  }

  if (
    /count|total|students|papers|publications|documents|criteria|events|participants|faculty|citations|hires|recruiters|placements|rows/.test(
      normalizedKey
    )
  ) {
    return Math.round(numericValue).toLocaleString('en-IN');
  }

  if (/cgpa|score|backlog|impact|points|experience|average|avg|median/.test(normalizedKey)) {
    return formatNumber(numericValue, 2);
  }

  return Number.isInteger(numericValue)
    ? numericValue.toLocaleString('en-IN')
    : formatNumber(numericValue, 2);
};

const getSummaryMetricTone = (key = '') => {
  const normalizedKey = String(key).toLowerCase();

  if (/risk|backlog|pending|warning|deficit|overdue/.test(normalizedKey)) {
    return {
      background: '#fff7ed',
      border: '#fdba74',
      accent: '#ea580c',
      label: '#9a3412',
    };
  }

  if (/excellent|pass|placed|success|compliance|completed|achievement/.test(normalizedKey)) {
    return {
      background: '#ecfdf5',
      border: '#86efac',
      accent: '#16a34a',
      label: '#166534',
    };
  }

  if (/avg|average|median|cgpa|attendance|package|score|impact|citation|experience/.test(normalizedKey)) {
    return {
      background: '#eef2ff',
      border: '#a5b4fc',
      accent: '#4f46e5',
      label: '#3730a3',
    };
  }

  return {
    background: '#eff6ff',
    border: '#93c5fd',
    accent: '#2563eb',
    label: '#1d4ed8',
  };
};

const normalizeSummaryEntries = (summary = {}) =>
  Object.entries(summary || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ({
      key,
      label: titleCaseLabel(key),
      value: formatSummaryMetricValue(key, value),
    }));

const buildFileBaseName = (prompt = '') => {
  const cleaned = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return cleaned || 'iqac-chat-report';
};

const splitParagraphs = (text = '') =>
  sanitizeText(text)
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

const getStructuredCharts = (reportData = {}) =>
  Array.isArray(reportData.charts)
    ? reportData.charts.filter((chart) => isChartSpec(chart))
    : [];

const getStructuredTableRows = (reportData = {}) =>
  Array.isArray(reportData.exportTable) ? reportData.exportTable : reportData.table || [];

const buildStructuredReportText = (reportData = {}) => {
  if (!isStructuredReportPayload(reportData)) {
    return '';
  }

  const lines = [];
  lines.push(sanitizeText(reportData.title || 'Report'));
  lines.push('');
  lines.push('Executive Summary');

  normalizeSummaryEntries(reportData.summary || {}).forEach(({ label, value }) => {
    lines.push(`- ${label}: ${value}`);
  });

  lines.push('');
  lines.push('Charts Section');

  getStructuredCharts(reportData).forEach((chart) => {
    lines.push(`${chart.title} (${String(chart.type || 'chart').toUpperCase()})`);
    if (chart.subtitle) {
      lines.push(chart.subtitle);
    }

    chart.data.forEach((row, index) => {
      lines.push(`${index + 1}. ${stringifyValue(row)}`);
    });
    lines.push('');
  });

  lines.push('Full Table Section');
  getStructuredTableRows(reportData).forEach((row, index) => {
    lines.push(`${index + 1}. ${stringifyValue(row)}`);
  });

  return lines.join('\n');
};

const ensurePdfSpace = (doc, neededHeight = 40) => {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight <= bottomLimit) {
    return;
  }

  doc.addPage();
};

const getPdfContentWidth = (doc) =>
  doc.page.width - doc.page.margins.left - doc.page.margins.right;

const measurePdfTextHeight = (
  doc,
  text = '',
  { fontName = 'Helvetica', fontSize = 10, width = getPdfContentWidth(doc) } = {}
) => {
  const content = sanitizeText(text);
  if (!content) {
    return 0;
  }

  doc.font(fontName).fontSize(fontSize);
  return Math.ceil(
    doc.heightOfString(content, {
      width,
      align: 'left',
    })
  );
};

const drawPdfSectionTitle = (doc, title) => {
  ensurePdfSpace(doc, 32);
  doc.moveDown(0.4);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;

  doc
    .rect(x, y, width, 22)
    .fill('#eff6ff');
  doc
    .fillColor(HEADER_TEXT)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(title, x + 8, y + 6, {
      width: width - 16,
      lineBreak: false,
    });

  doc.fillColor(TEXT_COLOR);
  doc.y = y + 24;
};

const collectTableColumns = (rows = []) => {
  const columns = [];
  const seen = new Set();

  rows.forEach((row) => {
    const normalizedRow = isPlainObject(row) ? row : { value: row };
    Object.keys(normalizedRow).forEach((key) => {
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      columns.push(key);
    });
  });

  return columns;
};

const computeColumnWidths = (doc, columns = [], rows = []) => {
  const availableWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const weights = columns.map((column) => {
    const maxRowLength = rows.reduce((maxLength, row) => {
      const cellLength = stringifyValue(row?.[column]).length;
      return Math.max(maxLength, cellLength);
    }, column.length);

    return Math.min(Math.max(maxRowLength, 8), 28);
  });

  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || columns.length;
  const widths = weights.map((weight) =>
    Math.max(55, Math.floor((availableWidth * weight) / totalWeight))
  );
  const usedWidth = widths.reduce((sum, value) => sum + value, 0);

  if (widths.length && usedWidth !== availableWidth) {
    widths[widths.length - 1] += availableWidth - usedWidth;
  }

  return widths;
};

const calculateRowHeight = (doc, cells = [], colWidths = [], fontName, fontSize) => {
  doc.font(fontName).fontSize(fontSize);
  const maxHeight = cells.reduce((height, cell, index) => {
    const textHeight = doc.heightOfString(stringifyValue(cell), {
      width: Math.max((colWidths[index] || 0) - 10, 20),
      align: 'left',
    });
    return Math.max(height, textHeight);
  }, fontSize);

  return Math.max(22, Math.ceil(maxHeight) + 10);
};

const drawTableHeader = (doc, columns = [], colWidths = [], y) => {
  const x = doc.page.margins.left;
  const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);
  const headerHeight = calculateRowHeight(
    doc,
    columns,
    colWidths,
    'Helvetica-Bold',
    9
  );

  doc.rect(x, y, totalWidth, headerHeight).fill(HEADER_BG);

  let cursorX = x;
  columns.forEach((column, index) => {
    doc
      .fillColor(HEADER_TEXT)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(column, cursorX + 5, y + 5, {
        width: colWidths[index] - 10,
        align: 'left',
      });
    cursorX += colWidths[index];
  });

  doc
    .strokeColor(BORDER)
    .lineWidth(0.7)
    .rect(x, y, totalWidth, headerHeight)
    .stroke();

  doc.fillColor(TEXT_COLOR);
  return headerHeight;
};

const drawPdfTable = (doc, rows = [], explicitColumns = null) => {
  const normalizedRows = rows.map((row) => (isPlainObject(row) ? row : { value: row }));
  const columns = Array.isArray(explicitColumns) && explicitColumns.length
    ? explicitColumns
    : collectTableColumns(normalizedRows);

  if (!columns.length) {
    return;
  }

  const colWidths = computeColumnWidths(doc, columns, normalizedRows);
  const x = doc.page.margins.left;
  const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);
  let y = doc.y;

  ensurePdfSpace(doc, 30);
  y = doc.y;
  const headerHeight = drawTableHeader(doc, columns, colWidths, y);
  y += headerHeight;

  normalizedRows.forEach((row, rowIndex) => {
    const cells = columns.map((column) => stringifyValue(row[column]));
    const rowHeight = calculateRowHeight(doc, cells, colWidths, 'Helvetica', 8.5);
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = doc.y;
      const nextHeaderHeight = drawTableHeader(doc, columns, colWidths, y);
      y += nextHeaderHeight;
    }

    if (rowIndex % 2 === 1) {
      doc.rect(x, y, totalWidth, rowHeight).fill(ODD_ROW_BG);
    }

    let cursorX = x;
    columns.forEach((column, index) => {
      doc
        .fillColor(TEXT_COLOR)
        .font('Helvetica')
        .fontSize(8.5)
        .text(stringifyValue(row[column]), cursorX + 5, y + 5, {
          width: colWidths[index] - 10,
          align: 'left',
        });
      cursorX += colWidths[index];
    });

    doc
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .rect(x, y, totalWidth, rowHeight)
      .stroke();

    y += rowHeight;
  });

  doc.y = y + 4;
};

const drawTitleSection = (doc, title) => {
  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor(TEXT_COLOR)
    .text(title, {
      align: 'center',
    });
  doc.moveDown(1);
};

const getSummaryGridLayout = (entryCount = 0) => {
  if (entryCount >= 5) {
    return { columns: 3, gap: 12, cardHeight: 88 };
  }

  if (entryCount >= 2) {
    return { columns: 2, gap: 12, cardHeight: 88 };
  }

  return { columns: 1, gap: 12, cardHeight: 88 };
};

const getSummarySectionHeight = (doc, entries = []) => {
  if (!entries.length) {
    return 48;
  }

  const introHeight = measurePdfTextHeight(
    doc,
    'A quick view of the most important report metrics.',
    {
      fontName: 'Helvetica',
      fontSize: 9,
      width: getPdfContentWidth(doc),
    }
  );
  const { columns, gap, cardHeight } = getSummaryGridLayout(entries.length);
  const rows = Math.ceil(entries.length / columns);

  return 28 + introHeight + 12 + rows * cardHeight + Math.max(0, rows - 1) * gap + 8;
};

const drawSummarySection = (doc, summary = {}) => {
  const entries = normalizeSummaryEntries(summary);
  if (!entries.length) {
    return;
  }

  ensurePdfSpace(doc, getSummarySectionHeight(doc, entries));
  drawPdfSectionTitle(doc, 'Executive Summary');

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(SUBTLE_TEXT)
    .text('A quick view of the most important report metrics.', {
      width: getPdfContentWidth(doc),
      align: 'left',
    });

  doc.moveDown(0.6);

  const { columns, gap, cardHeight } = getSummaryGridLayout(entries.length);
  const contentWidth = getPdfContentWidth(doc);
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
  const startX = doc.page.margins.left;
  const startY = doc.y;

  entries.forEach((entry, index) => {
    const rowIndex = Math.floor(index / columns);
    const columnIndex = index % columns;
    const x = startX + columnIndex * (cardWidth + gap);
    const y = startY + rowIndex * (cardHeight + gap);
    const tone = getSummaryMetricTone(entry.key);

    doc
      .roundedRect(x, y, cardWidth, cardHeight, 14)
      .fillAndStroke(tone.background, tone.border);

    doc
      .roundedRect(x + 14, y + 14, 38, 4, 2)
      .fill(tone.accent);

    doc
      .fillColor(tone.label)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(entry.label, x + 14, y + 26, {
        width: cardWidth - 28,
        height: 24,
      });

    doc
      .fillColor(TEXT_COLOR)
      .font('Helvetica-Bold')
      .fontSize(entry.value.length > 16 ? 18 : 22)
      .text(entry.value, x + 14, y + 50, {
        width: cardWidth - 28,
        height: 24,
      });
  });

  const totalRows = Math.ceil(entries.length / columns);
  doc.y = startY + totalRows * cardHeight + Math.max(0, totalRows - 1) * gap + 6;
  doc.moveDown(0.3);
};

const CHART_COLORS = [
  '#2563eb',
  '#0f766e',
  '#f59e0b',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#16a34a',
  '#ea580c',
];

const getChartColor = (index = 0) =>
  CHART_COLORS[index % CHART_COLORS.length];

const formatChartMetricValue = (value, format = 'number') => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return stringifyValue(value);
  }

  if (format === 'integer') {
    return String(Math.round(numericValue));
  }

  if (format === 'percentage') {
    return `${numericValue.toFixed(2).replace(/\.00$/, '')}%`;
  }

  return numericValue.toFixed(2).replace(/\.00$/, '');
};

const getChartLabel = (chart = {}, row = {}, index = 0) =>
  sanitizeText(
    row?.[chart.nameKey] ??
      row?.[chart.xKey] ??
      row?.label ??
      row?.name ??
      `Item ${index + 1}`
  );

const getChartNumericValue = (chart = {}, row = {}) => {
  const candidates = [
    chart.valueKey,
    chart.yKey,
    'value',
  ].filter(Boolean);

  for (const key of candidates) {
    const numericValue = Number(row?.[key]);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return 0;
};

const getChartBodyHeight = (chart = {}) => {
  const chartData = Array.isArray(chart.data) ? chart.data : [];

  if (chart.type === 'horizontalBar') {
    return Math.min(chartData.length, 10) * 26 + 30;
  }

  if (chart.type === 'line') {
    return 210;
  }

  if (chart.type === 'pie') {
    return 220;
  }

  return 220;
};

const getChartHeadingHeight = (doc, chart = {}) => {
  const width = getPdfContentWidth(doc);
  const titleHeight = measurePdfTextHeight(doc, chart.title || 'Chart', {
    fontName: 'Helvetica-Bold',
    fontSize: 11,
    width,
  });
  const subtitleHeight = chart.subtitle
    ? measurePdfTextHeight(doc, chart.subtitle, {
      fontName: 'Helvetica',
      fontSize: 9,
      width,
    })
    : 0;

  return titleHeight + subtitleHeight + (chart.subtitle ? 16 : 8);
};

const getChartBlockHeight = (doc, chart = {}) =>
  getChartHeadingHeight(doc, chart) + getChartBodyHeight(chart) + 10;

const drawChartHeading = (doc, chart = {}) => {
  const width = getPdfContentWidth(doc);

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(TEXT_COLOR)
    .text(chart.title || 'Chart', {
      width,
      align: 'left',
    });

  if (chart.subtitle) {
    doc
      .moveDown(0.15)
      .font('Helvetica')
      .fontSize(9)
      .fillColor(SUBTLE_TEXT)
      .text(chart.subtitle, {
        width,
        align: 'left',
      });
  }

  doc.moveDown(0.35);
};

const drawBarChart = (doc, chart = {}, { horizontal = false } = {}) => {
  const chartData = Array.isArray(chart.data) ? chart.data.slice(0, 10) : [];
  if (!chartData.length) {
    return;
  }

  const labelKey = chart.xKey || chart.nameKey || 'label';
  const valueKey = chart.yKey || chart.valueKey || 'value';

  if (horizontal) {
    const labelWidth = 160;
    const rowHeight = 26;
    const chartHeight = chartData.length * rowHeight + 30;
    drawChartHeading(doc, chart);

    const startX = doc.page.margins.left;
    const startY = doc.y;
    const totalWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const barWidth = totalWidth - labelWidth - 45;
    const maxValue = Math.max(
      ...chartData.map((row) => getChartNumericValue({ yKey: valueKey }, row)),
      1
    );

    chartData.forEach((row, index) => {
      const y = startY + index * rowHeight;
      const value = getChartNumericValue({ yKey: valueKey }, row);
      const fillWidth = Math.max(0, (value / maxValue) * barWidth);
      const color = getChartColor(index);

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(TEXT_COLOR)
        .text(getChartLabel({ xKey: labelKey }, row, index), startX, y + 6, {
          width: labelWidth - 8,
        });

      doc
        .roundedRect(startX + labelWidth, y + 6, barWidth, 10, 4)
        .fill('#e2e8f0');
      doc
        .roundedRect(startX + labelWidth, y + 6, fillWidth, 10, 4)
        .fill(color);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(SUBTLE_TEXT)
        .text(
          formatChartMetricValue(value, chart.format),
          startX + labelWidth + barWidth + 8,
          y + 4,
          { width: 40, align: 'left' }
        );
    });

    doc.y = startY + chartHeight;
    doc.moveDown(0.3);
    return;
  }

  const chartHeight = 220;
  drawChartHeading(doc, chart);

  const startX = doc.page.margins.left;
  const startY = doc.y;
  const totalWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const leftPadding = 36;
  const bottomPadding = 48;
  const topPadding = 16;
  const chartWidth = totalWidth - leftPadding;
  const innerHeight = chartHeight - bottomPadding - topPadding;
  const usableWidth = chartWidth - 20;
  const maxValue = Math.max(
    ...chartData.map((row) => getChartNumericValue({ yKey: valueKey }, row)),
    1
  );
  const slotWidth = usableWidth / Math.max(chartData.length, 1);
  const barWidth = Math.max(16, Math.min(40, slotWidth - 14));

  doc
    .strokeColor('#cbd5e1')
    .lineWidth(1)
    .moveTo(startX + leftPadding, startY + topPadding)
    .lineTo(startX + leftPadding, startY + topPadding + innerHeight)
    .lineTo(startX + leftPadding + usableWidth, startY + topPadding + innerHeight)
    .stroke();

  chartData.forEach((row, index) => {
    const value = getChartNumericValue({ yKey: valueKey }, row);
    const barHeight = Math.max(2, (value / maxValue) * innerHeight);
    const x = startX + leftPadding + index * slotWidth + (slotWidth - barWidth) / 2;
    const y = startY + topPadding + innerHeight - barHeight;
    const color = getChartColor(index);

    doc.roundedRect(x, y, barWidth, barHeight, 5).fill(color);
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(SUBTLE_TEXT)
      .text(formatChartMetricValue(value, chart.format), x - 8, y - 12, {
        width: barWidth + 16,
        align: 'center',
      });
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(TEXT_COLOR)
      .text(getChartLabel({ xKey: labelKey }, row, index), x - 8, startY + topPadding + innerHeight + 8, {
        width: barWidth + 16,
        align: 'center',
      });
  });

  doc.y = startY + chartHeight;
  doc.moveDown(0.3);
};

const drawLineChart = (doc, chart = {}) => {
  const chartData = Array.isArray(chart.data) ? chart.data.slice(0, 12) : [];
  if (!chartData.length) {
    return;
  }

  const labelKey = chart.xKey || 'label';
  const valueKey = chart.yKey || 'value';
  const chartHeight = 210;
  drawChartHeading(doc, chart);

  const startX = doc.page.margins.left;
  const startY = doc.y;
  const totalWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const leftPadding = 36;
  const bottomPadding = 42;
  const topPadding = 16;
  const innerHeight = chartHeight - bottomPadding - topPadding;
  const usableWidth = totalWidth - leftPadding - 12;
  const maxValue = Math.max(
    ...chartData.map((row) => getChartNumericValue({ yKey: valueKey }, row)),
    1
  );
  const stepX = chartData.length > 1 ? usableWidth / (chartData.length - 1) : 0;

  doc
    .strokeColor('#cbd5e1')
    .lineWidth(1)
    .moveTo(startX + leftPadding, startY + topPadding)
    .lineTo(startX + leftPadding, startY + topPadding + innerHeight)
    .lineTo(startX + leftPadding + usableWidth, startY + topPadding + innerHeight)
    .stroke();

  chartData.forEach((row, index) => {
    const value = getChartNumericValue({ yKey: valueKey }, row);
    const x = startX + leftPadding + index * stepX;
    const y =
      startY +
      topPadding +
      innerHeight -
      (Math.max(value, 0) / maxValue) * innerHeight;

    if (index === 0) {
      doc.moveTo(x, y);
    } else {
      doc.lineTo(x, y);
    }
  });

  doc.strokeColor('#2563eb').lineWidth(2).stroke();

  chartData.forEach((row, index) => {
    const value = getChartNumericValue({ yKey: valueKey }, row);
    const x = startX + leftPadding + index * stepX;
    const y =
      startY +
      topPadding +
      innerHeight -
      (Math.max(value, 0) / maxValue) * innerHeight;

    doc.circle(x, y, 3).fill('#2563eb');
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(TEXT_COLOR)
      .text(getChartLabel({ xKey: labelKey }, row, index), x - 18, startY + topPadding + innerHeight + 8, {
        width: 36,
        align: 'center',
      });
  });

  doc.y = startY + chartHeight;
  doc.moveDown(0.3);
};

const drawPieChart = (doc, chart = {}) => {
  const chartData = Array.isArray(chart.data) ? chart.data.slice(0, 8) : [];
  if (!chartData.length) {
    return;
  }

  const valueKey = chart.valueKey || chart.yKey || 'value';
  const labelKey = chart.nameKey || chart.xKey || 'label';
  const chartHeight = 220;
  drawChartHeading(doc, chart);

  const startX = doc.page.margins.left;
  const startY = doc.y;
  const centerX = startX + 90;
  const centerY = startY + 92;
  const radius = 54;
  const total = Math.max(
    chartData.reduce((sum, row) => sum + Math.max(getChartNumericValue({ yKey: valueKey }, row), 0), 0),
    1
  );
  let currentAngle = -Math.PI / 2;

  chartData.forEach((row, index) => {
    const value = Math.max(getChartNumericValue({ yKey: valueKey }, row), 0);
    const sliceAngle = (value / total) * Math.PI * 2;
    const color = getChartColor(index);

    doc
      .moveTo(centerX, centerY)
      .fillColor(color)
      .arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
      .lineTo(centerX, centerY)
      .fill();

    currentAngle += sliceAngle;
  });

  chartData.forEach((row, index) => {
    const legendY = startY + index * 18;
    const value = getChartNumericValue({ yKey: valueKey }, row);

    doc
      .rect(startX + 190, legendY + 2, 10, 10)
      .fill(getChartColor(index));
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(TEXT_COLOR)
      .text(
        `${getChartLabel({ nameKey: labelKey }, row, index)} - ${formatChartMetricValue(value, chart.format)}`,
        startX + 206,
        legendY,
        { width: 220 }
      );
  });

  doc.y = startY + chartHeight;
  doc.moveDown(0.3);
};

const drawChartBlock = (doc, chart = {}) => {
  if (!isChartSpec(chart)) {
    return;
  }

  ensurePdfSpace(doc, getChartBlockHeight(doc, chart));

  if (chart.type === 'pie') {
    drawPieChart(doc, chart);
    return;
  }

  if (chart.type === 'horizontalBar') {
    drawBarChart(doc, chart, { horizontal: true });
    return;
  }

  if (chart.type === 'line') {
    drawLineChart(doc, chart);
    return;
  }

  drawBarChart(doc, chart);
};

const drawChartsSection = (doc, charts = []) => {
  const chartEntries = getStructuredCharts({ charts });

  if (!chartEntries.length) {
    drawPdfSectionTitle(doc, 'Charts Section');
    doc.moveDown(0.2);
    return;
  }

  ensurePdfSpace(doc, 32 + getChartBlockHeight(doc, chartEntries[0]));
  drawPdfSectionTitle(doc, 'Charts Section');

  chartEntries.forEach((chart, index) => {
    drawChartBlock(doc, chart);
    if (index < chartEntries.length - 1) {
      doc.moveDown(0.35);
    }
  });
};

const drawFullTableSection = (doc, rows = []) => {
  drawPdfSectionTitle(doc, 'Full Table Section');
  drawPdfTable(doc, rows);
};

const exportStructuredReportAsPdf = async ({
  res,
  reportData,
  fileBaseName,
  reportTitle = 'IQAC Chatbot Report',
}) => {
  const doc = new PDFDocument({
    margin: PAGE_MARGIN,
    size: 'A4',
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileBaseName}.pdf"`);
  doc.pipe(res);

  drawTitleSection(doc, reportTitle || reportData.title || 'Report');
  drawSummarySection(doc, reportData.summary || {});
  doc.moveDown(SECTION_GAP / 14);
  drawChartsSection(doc, reportData.charts || []);
  doc.moveDown(SECTION_GAP / 14);
  drawFullTableSection(doc, getStructuredTableRows(reportData));

  doc.end();
};

const exportLegacyReportAsPdf = async ({
  res,
  reportText,
  fileBaseName,
  reportTitle = 'IQAC Chatbot Report',
}) => {
  const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' });
  const paragraphs = splitParagraphs(reportText);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileBaseName}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).font('Helvetica-Bold').text(reportTitle);
  doc.moveDown(0.4);
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#64748b')
    .text(`Generated on ${new Date().toLocaleString('en-IN')}`);
  doc.moveDown(1);
  doc.fillColor('black');

  paragraphs.forEach((paragraph) => {
    doc.fontSize(11).font('Helvetica').text(paragraph, {
      align: 'left',
      lineGap: 3,
    });
    doc.moveDown(0.8);
  });

  doc.end();
};

const exportReportAsPdf = async ({
  res,
  reportText,
  reportData,
  fileBaseName,
  reportTitle = 'IQAC Chatbot Report',
}) => {
  if (isStructuredReportPayload(reportData)) {
    return exportStructuredReportAsPdf({
      res,
      reportData,
      fileBaseName,
      reportTitle,
    });
  }

  return exportLegacyReportAsPdf({
    res,
    reportText,
    fileBaseName,
    reportTitle,
  });
};

const exportReportAsDocx = async ({
  res,
  reportText,
  reportData,
  fileBaseName,
  reportTitle = 'IQAC Chatbot Report',
}) => {
  if (!DocumentModule) {
    const error = new Error('DOCX export is unavailable because the docx package is not installed.');
    error.status = 503;
    throw error;
  }

  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = DocumentModule;
  const resolvedText = isStructuredReportPayload(reportData)
    ? buildStructuredReportText(reportData)
    : reportText;
  const paragraphs = splitParagraphs(resolvedText);

  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun(reportTitle)],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated on ${new Date().toLocaleString('en-IN')}`,
                italics: true,
              }),
            ],
          }),
          ...paragraphs.map((paragraph) => new Paragraph({ text: paragraph })),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${fileBaseName}.docx"`);
  res.send(buffer);
};

const exportInsightAsPdf = async ({
  res,
  insights = {},
  chart = null,
  fileBaseName,
  reportTitle = 'Insight Report',
  summaryText = '',
}) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileBaseName}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).font('Helvetica-Bold').text(reportTitle, {
    align: 'center',
  });
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').fillColor('#64748b')
    .text(`Generated on ${new Date().toLocaleString('en-IN')}`);
  doc.moveDown(1);
  doc.fillColor('black');

  const description = sanitizeText(summaryText || insights.description || '');
  if (description) {
    doc.fontSize(11).font('Helvetica').text(description, {
      align: 'left',
      lineGap: 3,
    });
    doc.moveDown(0.8);
  }

  if (Array.isArray(insights.points) && insights.points.length) {
    doc.fontSize(13).font('Helvetica-Bold').text('Key Points');
    doc.moveDown(0.4);
    insights.points.forEach((point) => {
      doc.fontSize(11).font('Helvetica').text(`- ${sanitizeText(String(point))}`, {
        align: 'left',
        lineGap: 3,
      });
      doc.moveDown(0.3);
    });
    doc.moveDown(0.5);
  }

  if (chart?.data?.length) {
    doc.fontSize(13).font('Helvetica-Bold').text(chart.title || 'Chart Summary');
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica').fillColor('#475569')
      .text(`Chart type: ${(chart.type || 'bar').toUpperCase()} | Metric: ${chart.metric || chart.yKey || 'Value'}`);
    doc.moveDown(0.5);
    doc.fillColor('black');

    chart.data.slice(0, 12).forEach((row) => {
      const label = row?.[chart.xKey || 'label'];
      const value = row?.[chart.yKey || 'value'];
      doc.fontSize(11).font('Helvetica').text(
        `${label ?? 'Item'}: ${value ?? 'N/A'}`,
        {
          align: 'left',
          lineGap: 3,
        }
      );
      doc.moveDown(0.2);
    });
  }

  doc.end();
};

module.exports = {
  buildFileBaseName,
  exportInsightAsPdf,
  exportReportAsPdf,
  exportReportAsDocx,
};
