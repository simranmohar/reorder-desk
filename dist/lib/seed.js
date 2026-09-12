import { addDays, today } from "./domain.js";
export function demoData(asOf = today()) {
  const seed = [
    ["Coastal Grove", "Vancouver", "Avery Chen", 14, 27, 245000],
    ["Northline Collective", "Burnaby", "Jordan Park", 21, 32, 186000],
    ["Pacific Junction", "Surrey", "Taylor Singh", 14, 22, 321000],
    ["Cedar & Coast", "Victoria", "Morgan Lee", 28, 33, 154000],
    ["Summit Trading", "Kelowna", "Casey Wilson", 21, 23, 215000],
    ["Harbour House", "Nanaimo", "Alex Brooks", 30, 31, 128000],
    ["Fraser Corner", "Langley", "Jamie Patel", 14, 12, 98000],
    ["Seaside Supply", "White Rock", "Riley Wong", 21, 18, 174000],
    ["Pine District", "Kamloops", "Sam Reid", 28, 11, 267000],
    ["Westward Market", "New Westminster", "Drew Thompson", 14, 5, 146000],
    ["Valley Trading Co.", "Abbotsford", "Robin Ellis", 21, 9, 198000],
    ["Bridgeview Collective", "Richmond", "Cameron Ross", 14, 7, 235000],
    ["Mountain Bend", "Squamish", "Skyler Davis", 28, 17, 124000],
    ["Lakefront Supply", "Penticton", "Quinn Martin", 30, 13, 163000],
    ["Evergreen Corner", "Port Moody", "Parker Kim", 21, 4, 107000],
    ["Island Junction", "Courtenay", "Reese Bell", 28, 7, 119000],
  ];
  const accounts = [],
    orders = [];
  seed.forEach(([name, city, contact, cadence, last, amount], i) => {
    const id = `A${String(i + 1).padStart(3, "0")}`;
    accounts.push({
      id,
      name,
      city,
      contact,
      email: `account${i + 1}@example.com`,
    });
    for (let n = 0; n < 6; n++)
      orders.push({
        id: `ORD-${i + 1}-${6 - n}`,
        accountId: id,
        date: addDays(asOf, -last - n * cadence + (n > 0 ? (n % 3) - 1 : 0)),
        totalCents: Math.round(amount * (1 + (((i + n) % 5) - 2) * 0.045)),
      });
  });
  return {
    version: 1,
    source: "demo",
    asOf,
    accounts,
    orders,
    interactions: [
      {
        id: "demo-note-1",
        accountId: "A001",
        type: "Note",
        date: addDays(asOf, -12),
        createdAt: addDays(asOf, -12) + "T15:00:00.000Z",
        note: "Prefers a quick availability check before placing the next order.",
        nextFollowUp: null,
      },
      {
        id: "demo-note-2",
        accountId: "A004",
        type: "Email",
        date: addDays(asOf, -2),
        createdAt: addDays(asOf, -2) + "T16:00:00.000Z",
        note: "Buyer is reviewing remaining stock. Follow up after the weekend.",
        nextFollowUp: addDays(asOf, 3),
      },
    ],
  };
}
