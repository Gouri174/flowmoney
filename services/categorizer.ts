const RULES: { patterns: RegExp[]; category: string }[] = [
  {
    patterns: [/swiggy|zomato|dominos|pizza|mcdonald|kfc|burger|restaurant|cafe|chai|dhaba|popeyes|wow momo|theobroma|haldirams|biryani|dunzo food|barbeque|bbq|subway|starbucks|chaayos|faasos|freshmenu|lunchbox|box8/i],
    category: 'Food & Dining',
  },
  {
    patterns: [/bigbasket|dmart|grofer|blinkit|zepto|jiomart|grocery|supermarket|reliance fresh|nature.s basket|spar|natures basket/i],
    category: 'Groceries',
  },
  {
    patterns: [/rent|housing|pg |paying guest|lodging/i],
    category: 'Rent',
  },
  {
    patterns: [/uber|ola |rapido|metro|irctc|railway|bus |flight|indigo|spice jet|air india|taxi|makemytrip|yatra|goibibo|redbus|booking\.com|booking co|agoda|trivago|airbnb|hotel|hostel|bolt by|bolt  by|nammayatri|yulu/i],
    category: 'Travel',
  },
  {
    patterns: [/amazon|flipkart|myntra|ajio|meesho|nykaa|shopping|mall|retail|snapdeal|tatacliq|croma|reliance digital|vijay sales/i],
    category: 'Shopping',
  },
  {
    patterns: [/netflix|spotify|hotstar|prime video|zee5|sonyliv|youtube premium|subscription|apple medi|appleservices|apple\.com|itunes|google play|googleplay|microsoft 365|adobe|icloud/i],
    category: 'Subscriptions',
  },
  {
    patterns: [/electricity|water bill|gas bill|broadband|jio |airtel|vi |vodafone|bill payment|recharge|postpaid|bsnl|bescom|tata power|msedcl/i],
    category: 'Bills',
  },
  {
    patterns: [/movie|cinema|pvr|inox|multiplex|concert|gaming|entertainment|bookmyshow|norebang|karaoke|amusement|theme park|orbgen/i],
    category: 'Entertainment',
  },
  {
    patterns: [/sip|mutual fund|zerodha|groww|upstox|stock |invest|fixed deposit|ppf|nps|coin|brokentusk|kuvera|smallcase|angel one/i],
    category: 'Investments',
  },
  {
    // upi\/[a-z] acts as catch-all: any UPI payment not matched above falls here
    patterns: [/transfer|sent to|received from|inft|prithvi exchang|forex|foreign exchange|tc fee|dpchg|posdec|upi\/[a-z]/i],
    category: 'Transfers',
  },
];

export function categorize(merchant: string, description: string): string {
  const text = `${merchant} ${description}`;
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.category;
  }
  return 'Others';
}
