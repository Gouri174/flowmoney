import { categorize } from './categorizer';

export interface RawTransaction {
  id: string;
  amount: number;
  currency: string;
  merchant: string;
  description: string;
  paymentMethod: string;
  date: string;
  accountId: string;
  isDebit: boolean;
}

export interface MockProvider {
  providerId: string;
  accountName: string;
  accountType: string;
  maskedNumber: string;
  fetchTransactions(startDate: Date, endDate: Date): Promise<RawTransaction[]>;
}

const MERCHANT_POOL = [
  { merchant: 'Swiggy', description: 'UPI/Swiggy Order', amount: 350, method: 'UPI' },
  { merchant: 'Zomato', description: 'UPI/Zomato Food', amount: 420, method: 'UPI' },
  { merchant: 'Uber', description: 'UPI/Uber Ride', amount: 180, method: 'UPI' },
  { merchant: 'Ola', description: 'UPI/Ola Cab', amount: 220, method: 'UPI' },
  { merchant: 'Amazon', description: 'UPI/Amazon Shopping', amount: 1299, method: 'UPI' },
  { merchant: 'Flipkart', description: 'UPI/Flipkart Order', amount: 899, method: 'UPI' },
  { merchant: 'BigBasket', description: 'UPI/BigBasket Groceries', amount: 650, method: 'UPI' },
  { merchant: 'Blinkit', description: 'UPI/Blinkit Quick Commerce', amount: 480, method: 'UPI' },
  { merchant: 'Netflix', description: 'UPI/Netflix Subscription', amount: 499, method: 'UPI' },
  { merchant: 'Spotify', description: 'UPI/Spotify Premium', amount: 119, method: 'UPI' },
  { merchant: 'Jio', description: 'UPI/Jio Postpaid Bill', amount: 399, method: 'UPI' },
  { merchant: 'IRCTC', description: 'UPI/IRCTC Train Ticket', amount: 1450, method: 'UPI' },
  { merchant: 'BookMyShow', description: 'UPI/BookMyShow Movie', amount: 280, method: 'UPI' },
  { merchant: 'Groww', description: 'UPI/Groww SIP Investment', amount: 5000, method: 'UPI' },
  { merchant: 'Electricity Board', description: 'UPI/Electricity Bill', amount: 1200, method: 'UPI' },
  { merchant: 'Myntra', description: 'Card/Myntra Shopping', amount: 1599, method: 'Card' },
  { merchant: 'Zepto', description: 'UPI/Zepto Delivery', amount: 340, method: 'UPI' },
  { merchant: 'Rapido', description: 'UPI/Rapido Bike', amount: 80, method: 'UPI' },
  { merchant: 'Hotstar', description: 'Card/Disney+Hotstar', amount: 299, method: 'Card' },
  { merchant: 'MakeMyTrip', description: 'Card/MakeMyTrip Flight', amount: 4500, method: 'Card' },
];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTransactions(
  accountId: string,
  startDate: Date,
  endDate: Date,
  count: number
): RawTransaction[] {
  const range = endDate.getTime() - startDate.getTime();
  return Array.from({ length: count }, (_, i) => {
    const template = MERCHANT_POOL[rand(0, MERCHANT_POOL.length - 1)];
    const variance = 0.85 + Math.random() * 0.3;
    const date = new Date(startDate.getTime() + Math.random() * range);
    return {
      id: `txn_${accountId}_${i}_${date.getTime()}`,
      amount: Math.round(template.amount * variance),
      currency: 'INR',
      merchant: template.merchant,
      description: template.description,
      paymentMethod: template.method,
      date: date.toISOString(),
      accountId,
      isDebit: true,
    };
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export const MOCK_PROVIDERS: MockProvider[] = [
  {
    providerId: 'mock_upi',
    accountName: 'Google Pay / PhonePe',
    accountType: 'upi',
    maskedNumber: 'user@okaxis',
    fetchTransactions: async (s, e) => generateTransactions('acc_upi', s, e, rand(15, 25)),
  },
  {
    providerId: 'mock_bank',
    accountName: 'HDFC Savings Account',
    accountType: 'savings',
    maskedNumber: 'XXXX 4821',
    fetchTransactions: async (s, e) => generateTransactions('acc_bank', s, e, rand(8, 15)),
  },
  {
    providerId: 'mock_wallet',
    accountName: 'Paytm Wallet',
    accountType: 'wallet',
    maskedNumber: 'XXXX 7654',
    fetchTransactions: async (s, e) => generateTransactions('acc_wallet', s, e, rand(5, 10)),
  },
];

export function buildTransaction(raw: RawTransaction, userId: string, accountId: string | null) {
  return {
    user_id: userId,
    account_id: accountId,
    external_id: raw.id,
    amount: raw.amount,
    currency: raw.currency,
    merchant: raw.merchant,
    description: raw.description,
    category_name: categorize(raw.merchant, raw.description),
    payment_method: raw.paymentMethod,
    date: raw.date,
    is_debit: raw.isDebit,
    notes: null as string | null,
  };
}
