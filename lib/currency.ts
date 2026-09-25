// Formats whole rands the South African way: "R 100 000".
//
// Deliberately not Intl.NumberFormat("en-ZA"): Node and browsers ship
// different locale data, and some format en-ZA as "R 35,500" while others
// give "R 35 500", which made server-rendered and animated numbers disagree.
// Non-breaking spaces keep an amount from wrapping across lines.
const NBSP = " ";

export function formatCurrency(amount: number) {
  const rounded = Math.round(amount);
  const digits = Math.abs(rounded).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${rounded < 0 ? "-" : ""}R${NBSP}${grouped}`;
}

/** A shelf price: "R 25", or "R 24.99" when there are cents. */
export function formatPrice(amount: number) {
  const cents = Math.round(amount * 100) % 100;
  if (cents === 0) return formatCurrency(amount);
  const whole = formatCurrency(Math.trunc(amount));
  return `${whole}.${String(Math.abs(cents)).padStart(2, "0")}`;
}
