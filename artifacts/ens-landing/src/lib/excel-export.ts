export interface ExcelSheet {
  name: string;
  rows: Array<Array<string | number | boolean | null | undefined>>;
}

export function downloadExcelWorkbook(filename: string, sheets: ExcelSheet[]) {
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF" />
      <Interior ss:Color="#1F2937" ss:Pattern="Solid" />
    </Style>
  </Styles>
  ${sheets.map(renderSheet).join("\n")}
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderSheet(sheet: ExcelSheet) {
  return `<Worksheet ss:Name="${escapeXml(sanitizeSheetName(sheet.name))}">
    <Table>
      ${sheet.rows.map((row, index) => renderRow(row, index === 0)).join("\n")}
    </Table>
  </Worksheet>`;
}

function renderRow(row: ExcelSheet["rows"][number], isHeader: boolean) {
  return `<Row>${row.map((cell) => renderCell(cell, isHeader)).join("")}</Row>`;
}

function renderCell(value: string | number | boolean | null | undefined, isHeader: boolean) {
  const type = typeof value === "number" ? "Number" : typeof value === "boolean" ? "Boolean" : "String";
  const content = type === "String" ? escapeXml(value) : String(value ?? "");
  return `<Cell${isHeader ? ' ss:StyleID="Header"' : ""}><Data ss:Type="${type}">${content}</Data></Cell>`;
}

function sanitizeSheetName(value: string) {
  const cleaned = value.replace(/[\\/?*\[\]:]/g, " ").trim();
  return (cleaned || "Sheet").slice(0, 31);
}

function escapeXml(value: string | number | boolean | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
