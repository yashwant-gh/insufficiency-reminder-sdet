function makeSeed() {
  const insufficiencies = [
    {
      id: 1,
      candidateName: "Ravi Kumar",
      reason: "Address proof unclear",
      status: "OPEN",
      createdAt: new Date("2026-07-10T09:00:00Z").toISOString(),
      reminderCount: 0
    },
    {
      id: 2,
      candidateName: "Priya Sharma",
      reason: "Payslip mismatch with declared salary",
      status: "OPEN",
      createdAt: new Date("2026-07-12T09:00:00Z").toISOString(),
      reminderCount: 2
    },
    {
      id: 3,
      candidateName: "Amit Verma",
      reason: "Education marksheet illegible",
      status: "RESOLVED",
      createdAt: new Date("2026-07-05T09:00:00Z").toISOString(),
      reminderCount: 1
    }
  ];

  return { insufficiencies, nextId: 4 };
}

module.exports = { makeSeed };
