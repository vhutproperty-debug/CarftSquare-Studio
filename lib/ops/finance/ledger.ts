export type LedgerPayment = {
  id: string;
  dealId: string;
  amount: number;
  verified: boolean;
  deletedAt?: string | null;
};

export type LedgerExpense = {
  id: string;
  amount: number;
  deletedAt?: string | null;
};

export function verifiedCollected(payments: LedgerPayment[], dealId: string): number {
  return payments
    .filter((payment) => payment.dealId === dealId && payment.verified && !payment.deletedAt)
    .reduce((sum, payment) => sum + (Number.isFinite(payment.amount) ? payment.amount : 0), 0);
}

/** Commission is collected only when verified payments cover the expected amount. */
export function canMarkCommissionCollected(payments: LedgerPayment[], dealId: string, expected: number): boolean {
  if (!(expected > 0)) return false;
  return verifiedCollected(payments, dealId) >= expected;
}

export function profitability(input: { expected: number; payments: LedgerPayment[]; expenses: LedgerExpense[] }) {
  const collected = input.payments
    .filter((payment) => payment.verified && !payment.deletedAt)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const expenses = input.expenses
    .filter((expense) => !expense.deletedAt)
    .reduce((sum, expense) => sum + expense.amount, 0);
  return {
    expected: input.expected,
    collected,
    expenses,
    profit: collected - expenses,
  };
}
