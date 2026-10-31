/** One CSV cell. A leading = + - @ tab or CR would run as a formula in Excel, so it gets a ' prefix. */
export const csvCell = (v: unknown) => `"${String(v).replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
