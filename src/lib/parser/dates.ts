export function parseRevolutDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Try ISO format: YYYY-MM-DD HH:MM:SS or YYYY-MM-DDTHH:MM:SS
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Try European format: DD/MM/YYYY or DD-MM-YYYY
  const euMatch = dateStr.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (euMatch) {
    const day = parseInt(euMatch[1]);
    const month = parseInt(euMatch[2]);
    const year = parseInt(euMatch[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day) {
      return `${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`;
    }
  }

  // Try US format: MM/DD/YYYY
  const usMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (usMatch) {
    const month = parseInt(usMatch[1]);
    const day = parseInt(usMatch[2]);
    const year = parseInt(usMatch[3]);
    if (month <= 12 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day) {
        return `${usMatch[3]}-${usMatch[1]}-${usMatch[2]}`;
      }
    }
  }

  return null;
}

export function normalizeAmount(amountStr: string): number {
  // Handle comma as decimal separator (European format)
  const normalized = amountStr.replace(/\s/g, "").replace(",", ".");
  return parseFloat(normalized);
}
