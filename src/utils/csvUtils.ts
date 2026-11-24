export type CsvValue = string | number | null | undefined;

/** RFC 4180 準拠でセルをエスケープする（カンマ・ダブルクォート・改行を含む値はクォートで囲む） */
export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 2次元配列をCSV文字列に変換する（改行は CRLF、Excel互換） */
export function toCsv(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n') + '\r\n';
}

/** 小数を指定桁で丸める（-0 は 0 にする） */
export function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  return r === 0 ? 0 : r;
}

/** UTF-8 BOM付きCSVとしてダウンロードさせる（Mac版Excelの文字化け対策） */
export function downloadCsv(filename: string, rows: CsvValue[][]): void {
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
