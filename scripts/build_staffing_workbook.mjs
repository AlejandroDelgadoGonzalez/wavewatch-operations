import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(projectRoot, "outputs", "blue-current-staffing");
const dataDir = path.join(projectRoot, "data");

const colors = {
  navy: "#0B1F3A",
  blue: "#1877C9",
  aqua: "#3CCFD5",
  paleAqua: "#DDF7F8",
  coral: "#FF7A66",
  sand: "#F4EBDD",
  white: "#FFFFFF",
  ink: "#172033",
  gray: "#667085",
  lightGray: "#E7ECF2",
  green: "#DDF5E7",
};

const rotationDefinitions = [
  { id: "SW-CC-01", zone: "Current Cove", role: "Shallow Water Lifeguard", name: "Tidepool Loop", attractionId: "AT-CC-01", attraction: "Tidepool Terrace", stands: ["North Shore", "Activity Island", "South Shore"] },
  { id: "SW-CC-02", zone: "Current Cove", role: "Shallow Water Lifeguard", name: "Harbor Drift", attractionId: "AT-CC-02", attraction: "Harbor Drift", stands: ["Entry Bend", "Lighthouse Curve", "Exit Bend"] },
  { id: "SW-CC-03", zone: "Current Cove", role: "Shallow Water Lifeguard", name: "Coral Crossing", attractionId: "AT-CC-03", attraction: "Coral Crossing", stands: ["Spray Deck", "Bridge Pool", "Lagoon Exit"] },
  { id: "SW-BB-01", zone: "Tidal Bay", role: "Shallow Water Lifeguard", name: "Tidal East", attractionId: "AT-BB-01", attraction: "Tidal Bay Wave Pool", stands: ["East Shore One", "East Shore Two", "East Shore Three"] },
  { id: "SW-BB-02", zone: "Tidal Bay", role: "Shallow Water Lifeguard", name: "Tidal West", attractionId: "AT-BB-01", attraction: "Tidal Bay Wave Pool", stands: ["West Shore One", "West Shore Two", "West Shore Three"] },
  { id: "SW-RR-01", zone: "Rapids Ridge", role: "Shallow Water Lifeguard", name: "Rapids Landing", attractionId: "AT-RR-01", attraction: "Riverstone Rafts", stands: ["Landing Left", "Landing Center", "Landing Right"] },
  { id: "SW-BP-01", zone: "Blue Peak", role: "Shallow Water Lifeguard", name: "Summit Landing", attractionId: "AT-BP-04", attraction: "Summit Landing Pool", stands: ["Surge Runout", "Shared Center", "Velocity Runout"] },
  { id: "SW-BP-02", zone: "Blue Peak", role: "Shallow Water Lifeguard", name: "Current Falls", attractionId: "AT-BP-05", attraction: "Current Falls", stands: ["Falls Entry", "Falls Center", "Falls Exit"] },
  { id: "DW-BB-01", zone: "Tidal Bay", role: "Deep Water Lifeguard", name: "Tidal Deep North", attractionId: "AT-BB-01", attraction: "Tidal Bay Wave Pool", stands: ["North Platform", "North Center", "North Transition"] },
  { id: "DW-BB-02", zone: "Tidal Bay", role: "Deep Water Lifeguard", name: "Tidal Deep South", attractionId: "AT-BB-01", attraction: "Tidal Bay Wave Pool", stands: ["South Platform", "South Center", "South Transition"] },
  { id: "DW-BP-01", zone: "Blue Peak", role: "Deep Water Lifeguard", name: "Blue Peak Deep Landing", attractionId: "AT-BP-03", attraction: "Abyss Drop", stands: ["Deep Entry", "Deep Center", "Deep Exit"] },
  { id: "SO-RR-01", zone: "Rapids Ridge", role: "Slide Operator", name: "Riverstone Rafts", attractionId: "AT-RR-01", attraction: "Riverstone Rafts", stands: ["Queue Entry", "Raft Load", "Dispatch"] },
  { id: "SO-RR-02", zone: "Rapids Ridge", role: "Slide Operator", name: "Canyon Current", attractionId: "AT-RR-02", attraction: "Canyon Current", stands: ["Tower Entry", "Raft Load", "Dispatch"] },
  { id: "SO-RR-03", zone: "Rapids Ridge", role: "Slide Operator", name: "Ridge Racers", attractionId: "AT-RR-03", attraction: "Ridge Racers", stands: ["Mat Pickup", "Lane Load", "Dispatch"] },
  { id: "SO-BP-01", zone: "Blue Peak", role: "Slide Operator", name: "Blue Surge", attractionId: "AT-BP-01", attraction: "Blue Surge", stands: ["Tower Entry", "Load Platform", "Dispatch"] },
  { id: "SO-BP-02", zone: "Blue Peak", role: "Slide Operator", name: "Velocity Falls", attractionId: "AT-BP-02", attraction: "Velocity Falls", stands: ["Queue Entry", "Tube Load", "Dispatch"] },
  { id: "SO-BP-03", zone: "Blue Peak", role: "Slide Operator", name: "Abyss Drop", attractionId: "AT-BP-03", attraction: "Abyss Drop", stands: ["Queue Entry", "Launch Platform", "Dispatch"] },
];
const rotations = rotationDefinitions.map((rotation, rotationIndex) => ({
  ...rotation,
  stands: rotation.stands.map((name, index) => ({
    id: `${rotation.id}-S${index + 1}`, name,
    extension: String(1001 + rotationIndex * 3 + index),
  })),
}));

const attractions = [
  ["AT-CC-01", "Current Cove", "Tidepool Terrace", "Family activity pool"],
  ["AT-CC-02", "Current Cove", "Harbor Drift", "Slow-current river"],
  ["AT-CC-03", "Current Cove", "Coral Crossing", "Children's water-play area"],
  ["AT-BB-01", "Tidal Bay", "Tidal Bay Wave Pool", "Large wave pool"],
  ["AT-RR-01", "Rapids Ridge", "Riverstone Rafts", "Family raft slide"],
  ["AT-RR-02", "Rapids Ridge", "Canyon Current", "Enclosed raft slide"],
  ["AT-RR-03", "Rapids Ridge", "Ridge Racers", "Multi-lane mat slide"],
  ["AT-BP-01", "Blue Peak", "Blue Surge", "High-speed body slide"],
  ["AT-BP-02", "Blue Peak", "Velocity Falls", "Multi-rider tube slide"],
  ["AT-BP-03", "Blue Peak", "Abyss Drop", "Drop slide with deep landing pool"],
  ["AT-BP-04", "Blue Peak", "Summit Landing Pool", "Shared shallow landing pool"],
  ["AT-BP-05", "Blue Peak", "Current Falls", "Shallow-water slide complex"],
];

const firstNames = [
  "Maya", "Ethan", "Sofia", "Jordan", "Camila", "Noah", "Aaliyah", "Lucas", "Priya", "Mateo",
  "Zoe", "Daniel", "Nia", "Adrian", "Isabella", "Marcus", "Elena", "Owen", "Jasmine", "Diego",
];

const lastNames = [
  "Rivera", "Carter", "Patel", "Nguyen", "Brooks", "Morales", "Kim", "Foster", "Santos", "Reed",
  "Johnson", "Torres", "Chen", "Williams", "Bennett", "Hernandez", "Lewis", "Ramirez", "Morgan",
];

function fictionalName(index) {
  return `${firstNames[index % firstNames.length]} ${lastNames[(index * 7 + 3) % lastNames.length]}`;
}

const shiftTemplates = [
  { arrival: "8:00 AM", assignment: "Stand 3", break1: 45, break2: 30, breakPlan: "45 + 30" },
  { arrival: "9:00 AM", assignment: "Stand 2", break1: 30, break2: 30, breakPlan: "30 + 30" },
  { arrival: "9:45 AM", assignment: "Stand 1", break1: 30, break2: 30, breakPlan: "30 + 30" },
  { arrival: "11:00 AM", assignment: "Breaker", break1: 45, break2: 0, breakPlan: "45" },
];

const employees = [];
let employeeIndex = 0;

for (const rotation of rotations) {
  for (const shift of shiftTemplates) {
    const certification = rotation.role === "Slide Operator"
      ? "Slide Operations"
      : rotation.role === "Deep Water Lifeguard"
        ? "Deep Water"
        : "Shallow Water";

    employees.push({
      employeeId: `BCAP-${String(employeeIndex + 1).padStart(4, "0")}`,
      employeeName: fictionalName(employeeIndex),
      jobRole: rotation.role,
      zone: rotation.zone,
      rotationId: rotation.id,
      rotationName: rotation.name,
      arrivalTime: shift.arrival,
      shiftEnd: "6:30 PM",
      startingAssignment: shift.assignment,
      break1Minutes: shift.break1,
      break2Minutes: shift.break2,
      breakPlan: shift.breakPlan,
      certification,
      status: "Scheduled",
      dataClassification: "Synthetic",
    });
    employeeIndex += 1;
  }
}

const coordinatorTemplates = [
  { role: "Operations Lead", zone: "Parkwide", arrival: "7:30 AM", assignment: "Operations Leadership" },
  { role: "Base Coordinator", zone: "Parkwide", arrival: "8:00 AM", assignment: "Operations Base" },
  { role: "Area Coordinator", zone: "Current Cove", arrival: "8:30 AM", assignment: "Current Cove Coverage" },
  { role: "Area Coordinator", zone: "Tidal Bay", arrival: "8:30 AM", assignment: "Tidal Bay Coverage" },
  { role: "Area Coordinator", zone: "Rapids Ridge", arrival: "8:30 AM", assignment: "Rapids Ridge Coverage" },
  { role: "Area Coordinator", zone: "Blue Peak", arrival: "8:30 AM", assignment: "Blue Peak Coverage" },
];

for (const coordinator of coordinatorTemplates) {
  employees.push({
    employeeId: `BCAP-${String(employeeIndex + 1).padStart(4, "0")}`,
    employeeName: fictionalName(employeeIndex),
    jobRole: coordinator.role,
    zone: coordinator.zone,
    rotationId: "N/A",
    rotationName: "N/A",
    arrivalTime: coordinator.arrival,
    shiftEnd: "6:30 PM",
    startingAssignment: coordinator.assignment,
    break1Minutes: null,
    break2Minutes: null,
    breakPlan: "Coordinated coverage",
    certification: "Coordination",
    status: "Scheduled",
    dataClassification: "Synthetic",
  });
  employeeIndex += 1;
}

if (employees.length !== 74) {
  throw new Error(`Expected 74 employees, received ${employees.length}.`);
}

const uniqueNames = new Set(employees.map((employee) => employee.employeeName));
if (uniqueNames.size !== employees.length) {
  throw new Error("Employee names must be unique in the synthetic roster.");
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(dataDir, { recursive: true });

const dataPackage = {
  metadata: {
    parkName: "Blue Current Adventure Park",
    operatingDate: "2026-08-15",
    parkOpen: "10:00 AM",
    parkClose: "6:00 PM",
    employeeShiftEnd: "6:30 PM",
    dataClassification: "Synthetic training data",
    notes: "All names, assignments, attractions, and operational records are fictional.",
  },
  staffingSummary: {
    totalEmployees: 74,
    rotationEmployees: 68,
    coordinators: 6,
    rotations: 17,
  },
  attractions: attractions.map(([id, zone, name, type]) => ({ id, zone, name, type })),
  rotations,
  employees,
};

await fs.writeFile(
  path.join(dataDir, "blue_current_staffing.json"),
  `${JSON.stringify(dataPackage, null, 2)}\n`,
  "utf8",
);

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Summary");
const roster = workbook.worksheets.add("Roster");
const rotationSheet = workbook.worksheets.add("Rotations");
const attractionSheet = workbook.worksheets.add("Attractions");
const dictionary = workbook.worksheets.add("Data Dictionary");

for (const sheet of [summary, roster, rotationSheet, attractionSheet, dictionary]) {
  sheet.showGridLines = false;
}

// Summary sheet
summary.getRange("A1:H2").merge();
summary.getRange("A1").values = [["Blue Current Adventure Park — Staffing Overview"]];
summary.getRange("A1:H2").format = {
  fill: colors.navy,
  font: { bold: true, color: colors.white, size: 20 },
  verticalAlignment: "center",
  horizontalAlignment: "left",
};
summary.getRange("A3:H3").merge();
summary.getRange("A3").values = [["Synthetic operating-day dataset | Park hours: 10:00 AM–6:00 PM | Employee shifts end: 6:30 PM"]];
summary.getRange("A3:H3").format = {
  fill: colors.paleAqua,
  font: { italic: true, color: colors.ink },
};

summary.getRange("A5:B5").merge();
summary.getRange("C5:D5").merge();
summary.getRange("E5:F5").merge();
summary.getRange("G5:H5").merge();
summary.getRange("A5").values = [["TOTAL EMPLOYEES"]];
summary.getRange("C5").values = [["ROTATION STAFF"]];
summary.getRange("E5").values = [["COORDINATORS"]];
summary.getRange("G5").values = [["ROTATIONS"]];

summary.getRange("A6:B7").merge();
summary.getRange("C6:D7").merge();
summary.getRange("E6:F7").merge();
summary.getRange("G6:H7").merge();
summary.getRange("A6").formulas = [["=COUNTA(Roster!$A$5:$A$78)"]];
summary.getRange("C6").formulas = [["=COUNTIF(Roster!$E$5:$E$78,\"<>N/A\")"]];
summary.getRange("E6").formulas = [["=COUNTIF(Roster!$E$5:$E$78,\"N/A\")"]];
summary.getRange("G6").formulas = [["=COUNTA(Rotations!$A$5:$A$21)"]];

summary.getRange("A5:H5").format = {
  fill: colors.blue,
  font: { bold: true, color: colors.white },
  horizontalAlignment: "center",
};
summary.getRange("A6:H7").format = {
  fill: colors.white,
  font: { bold: true, color: colors.navy, size: 22 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: { preset: "all", style: "thin", color: colors.lightGray },
};

summary.getRange("A9:B9").values = [["Staff by Role", "Count"]];
summary.getRange("A10:A14").values = [
  ["Shallow Water Lifeguard"],
  ["Deep Water Lifeguard"],
  ["Slide Operator"],
  ["Area Coordinator"],
  ["Parkwide Leadership"],
];
summary.getRange("B10").formulas = [["=COUNTIF(Roster!$C$5:$C$78,A10)"]];
summary.getRange("B10:B13").fillDown();
summary.getRange("B14").formulas = [["=COUNTIF(Roster!$C$5:$C$78,\"Operations Lead\")+COUNTIF(Roster!$C$5:$C$78,\"Base Coordinator\")"]];

summary.getRange("D9:E9").values = [["Staff by Zone", "Count"]];
summary.getRange("D10:D14").values = [
  ["Current Cove"],
  ["Tidal Bay"],
  ["Rapids Ridge"],
  ["Blue Peak"],
  ["Parkwide"],
];
summary.getRange("E10").formulas = [["=COUNTIF(Roster!$D$5:$D$78,D10)"]];
summary.getRange("E10:E14").fillDown();

summary.getRange("A9:B14").format.borders = { preset: "all", style: "thin", color: colors.lightGray };
summary.getRange("D9:E14").format.borders = { preset: "all", style: "thin", color: colors.lightGray };
summary.getRange("A9:B9").format = { fill: colors.aqua, font: { bold: true, color: colors.navy } };
summary.getRange("D9:E9").format = { fill: colors.aqua, font: { bold: true, color: colors.navy } };

summary.getRange("A16:C16").values = [["Rotation Staffing Check", "Zone", "Scheduled Staff"]];
summary.getRange("A17:A33").values = rotations.map((rotation) => [rotation.id]);
summary.getRange("B17:B33").values = rotations.map((rotation) => [rotation.zone]);
summary.getRange("C17").formulas = [["=COUNTIF(Roster!$E$5:$E$78,A17)"]];
summary.getRange("C17:C33").fillDown();
summary.getRange("A16:C33").format.borders = { preset: "all", style: "thin", color: colors.lightGray };
summary.getRange("A16:C16").format = { fill: colors.navy, font: { bold: true, color: colors.white } };
summary.getRange("C17:C33").format = { fill: colors.green, font: { bold: true, color: colors.navy }, horizontalAlignment: "center" };

const roleChart = summary.charts.add("bar", summary.getRange("A9:B14"));
roleChart.title = "Scheduled Employees by Role";
roleChart.hasLegend = false;
roleChart.setPosition("G9", "N24");

summary.getRange("A35:H36").merge();
summary.getRange("A35").values = [["Training note: this workbook contains fictional names and fictional operations only. It is designed for prototype development and portfolio use."]];
summary.getRange("A35:H36").format = {
  fill: colors.sand,
  font: { italic: true, color: colors.ink },
  wrapText: true,
  verticalAlignment: "center",
};

summary.getRange("A1:H36").format.rowHeight = 20;
summary.getRange("A:H").format.columnWidth = 18;
summary.getRange("A:A").format.columnWidth = 28;
summary.getRange("D:D").format.columnWidth = 22;
summary.freezePanes.freezeRows(3);

// Roster sheet
roster.getRange("A1:O2").merge();
roster.getRange("A1").values = [["Blue Current Adventure Park — Synthetic Employee Roster"]];
roster.getRange("A1:O2").format = {
  fill: colors.navy,
  font: { bold: true, color: colors.white, size: 18 },
  verticalAlignment: "center",
};
roster.getRange("A3:O3").merge();
roster.getRange("A3").values = [["Operating date: August 15, 2026 | Default prototype scenario: 6:00 PM park closing"]];
roster.getRange("A3:O3").format = { fill: colors.paleAqua, font: { italic: true, color: colors.ink } };

const rosterHeaders = [
  "Employee ID", "Employee Name", "Job Role", "Zone", "Rotation ID", "Rotation Name",
  "Arrival Time", "Shift End", "Starting Assignment", "Break 1 Minutes", "Break 2 Minutes",
  "Break Plan", "Certification", "Status", "Data Classification",
];
roster.getRange("A4:O4").values = [rosterHeaders];
roster.getRange("A5:O78").values = employees.map((employee) => [
  employee.employeeId,
  employee.employeeName,
  employee.jobRole,
  employee.zone,
  employee.rotationId,
  employee.rotationName,
  employee.arrivalTime,
  employee.shiftEnd,
  employee.startingAssignment,
  employee.break1Minutes,
  employee.break2Minutes,
  employee.breakPlan,
  employee.certification,
  employee.status,
  employee.dataClassification,
]);
roster.getRange("A4:O4").format = {
  fill: colors.blue,
  font: { bold: true, color: colors.white },
  wrapText: true,
  verticalAlignment: "center",
};
roster.getRange("A4:O78").format.borders = { preset: "all", style: "thin", color: colors.lightGray };
roster.getRange("J5:K78").format.numberFormat = "0";
roster.getRange("N5:N78").format = { fill: colors.green, font: { color: colors.ink } };
roster.getRange("O5:O78").format = { fill: colors.sand, font: { italic: true, color: colors.gray } };
roster.tables.add("A4:O78", true, "RosterTable").style = "TableStyleMedium2";
roster.freezePanes.freezeRows(4);
roster.freezePanes.freezeColumns(2);
roster.getRange("A:O").format.autofitColumns();
roster.getRange("A:A").format.columnWidth = 14;
roster.getRange("B:B").format.columnWidth = 20;
roster.getRange("C:C").format.columnWidth = 25;
roster.getRange("D:D").format.columnWidth = 18;
roster.getRange("F:F").format.columnWidth = 24;
roster.getRange("I:I").format.columnWidth = 24;
roster.getRange("O:O").format.columnWidth = 18;

// Rotations sheet
rotationSheet.getRange("A1:L2").merge();
rotationSheet.getRange("A1").values = [["Blue Current Adventure Park — Rotation Registry"]];
rotationSheet.getRange("A1:L2").format = {
  fill: colors.navy,
  font: { bold: true, color: colors.white, size: 18 },
  verticalAlignment: "center",
};
rotationSheet.getRange("A3:L3").merge();
rotationSheet.getRange("A3").values = [["Each rotation has three active stands and four scheduled employees for continuous break coverage."]];
rotationSheet.getRange("A3:L3").format = { fill: colors.paleAqua, font: { italic: true, color: colors.ink } };
rotationSheet.getRange("A4:L4").values = [[
  "Rotation ID", "Rotation Name", "Zone", "Employee Role", "Attraction ID", "Attraction",
  "Stand 1", "Stand 2", "Stand 3", "Scheduled Staff", "Required Staff", "Staffing Status",
]];
rotationSheet.getRange("A5:I21").values = rotations.map((rotation) => [
  rotation.id,
  rotation.name,
  rotation.zone,
  rotation.role,
  rotation.attractionId,
  rotation.attraction,
  ...rotation.stands.map(stand => `${stand.name} (ext. ${stand.extension})`),
]);
rotationSheet.getRange("J5").formulas = [["=COUNTIF(Roster!$E$5:$E$78,A5)"]];
rotationSheet.getRange("J5:J21").fillDown();
rotationSheet.getRange("K5:K21").values = rotations.map(() => [4]);
rotationSheet.getRange("L5").formulas = [["=IF(J5=K5,\"Ready\",\"Review\")"]];
rotationSheet.getRange("L5:L21").fillDown();
rotationSheet.getRange("A4:L4").format = { fill: colors.blue, font: { bold: true, color: colors.white }, wrapText: true };
rotationSheet.getRange("A4:L21").format.borders = { preset: "all", style: "thin", color: colors.lightGray };
rotationSheet.getRange("L5:L21").format = { fill: colors.green, font: { bold: true, color: colors.navy }, horizontalAlignment: "center" };
rotationSheet.tables.add("A4:L21", true, "RotationsTable").style = "TableStyleMedium2";
rotationSheet.freezePanes.freezeRows(4);
rotationSheet.getRange("A:L").format.autofitColumns();
rotationSheet.getRange("B:B").format.columnWidth = 24;
rotationSheet.getRange("D:D").format.columnWidth = 25;
rotationSheet.getRange("F:I").format.columnWidth = 22;

// Attractions sheet
attractionSheet.getRange("A1:E2").merge();
attractionSheet.getRange("A1").values = [["Blue Current Adventure Park — Attraction Registry"]];
attractionSheet.getRange("A1:E2").format = {
  fill: colors.navy,
  font: { bold: true, color: colors.white, size: 18 },
  verticalAlignment: "center",
};
attractionSheet.getRange("A3:E3").merge();
attractionSheet.getRange("A3").values = [["Fictional attractions used to model the park's operational zones and rotations."]];
attractionSheet.getRange("A3:E3").format = { fill: colors.paleAqua, font: { italic: true, color: colors.ink } };
attractionSheet.getRange("A4:E4").values = [["Attraction ID", "Zone", "Attraction Name", "Attraction Type", "Assigned Rotations"]];
attractionSheet.getRange("A5:D16").values = attractions;
attractionSheet.getRange("E5").formulas = [["=COUNTIF(Rotations!$E$5:$E$21,A5)"]];
attractionSheet.getRange("E5:E16").fillDown();
attractionSheet.getRange("A4:E4").format = { fill: colors.blue, font: { bold: true, color: colors.white }, wrapText: true };
attractionSheet.getRange("A4:E16").format.borders = { preset: "all", style: "thin", color: colors.lightGray };
attractionSheet.tables.add("A4:E16", true, "AttractionsTable").style = "TableStyleMedium2";
attractionSheet.freezePanes.freezeRows(4);
attractionSheet.getRange("A:E").format.autofitColumns();
attractionSheet.getRange("C:C").format.columnWidth = 28;
attractionSheet.getRange("D:D").format.columnWidth = 34;

// Data dictionary sheet
dictionary.getRange("A1:D2").merge();
dictionary.getRange("A1").values = [["Data Dictionary and Prototype Assumptions"]];
dictionary.getRange("A1:D2").format = {
  fill: colors.navy,
  font: { bold: true, color: colors.white, size: 18 },
  verticalAlignment: "center",
};
dictionary.getRange("A4:D4").values = [["Field", "Meaning", "Example", "Notes"]];
dictionary.getRange("A5:D16").values = [
  ["Employee ID", "Unique fictional identifier", "BCAP-0001", "Does not identify a real employee"],
  ["Rotation ID", "Stable code for one four-person rotation", "SW-CC-01", "SW = shallow water; DW = deep water; SO = slide operator"],
  ["Starting Assignment", "Position assigned when the employee arrives", "Stand 3", "Default order is Stand 1 → Stand 2 → Stand 3 → Break/Extra"],
  ["Breaker", "Fourth employee who starts the rotation's break cycle", "11:00 AM arrival", "First handoff is expected at 11:10 AM"],
  ["Break 1 Minutes", "Planned first break length", "45", "Based on a 6:00 PM park closing scenario"],
  ["Break 2 Minutes", "Planned second break length", "30", "Zero means the shift has one planned break"],
  ["Status", "Scheduling state for the prototype day", "Scheduled", "Future versions may include Clocked In, On Break, Extra, and Clocked Out"],
  ["Data Classification", "Source category for privacy and portfolio safety", "Synthetic", "No real workplace or employee data is included"],
  ["Park Hours", "Guest operating hours for this scenario", "10:00 AM–6:00 PM", "Employees may arrive before opening and leave after closing"],
  ["Staffing Rule", "Required staffing per active rotation", "4 employees", "Three active stands plus one person moving through break/extra"],
  ["Coordinator Model", "Leadership structure", "1 lead + 1 base + 4 area", "Six coordinators are separate from the 68 rotation employees"],
  ["Workbook Purpose", "Training and prototype development", "Portfolio project", "Not an official operational system"],
];
dictionary.getRange("A4:D4").format = { fill: colors.blue, font: { bold: true, color: colors.white } };
dictionary.getRange("A4:D16").format.borders = { preset: "all", style: "thin", color: colors.lightGray };
dictionary.getRange("A5:D16").format.wrapText = true;
dictionary.tables.add("A4:D16", true, "DictionaryTable").style = "TableStyleMedium2";
dictionary.freezePanes.freezeRows(4);
dictionary.getRange("A:D").format.autofitColumns();
dictionary.getRange("A:A").format.columnWidth = 24;
dictionary.getRange("B:B").format.columnWidth = 38;
dictionary.getRange("C:C").format.columnWidth = 25;
dictionary.getRange("D:D").format.columnWidth = 55;
dictionary.getRange("A5:D16").format.autofitRows();

const workbookInspection = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 8000,
  tableMaxRows: 5,
  tableMaxCols: 8,
  tableMaxCellChars: 60,
});

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
  maxChars: 4000,
});

const summaryPreview = await workbook.render({
  sheetName: "Summary",
  range: "A1:N36",
  scale: 1,
  format: "png",
});
await fs.writeFile(
  path.join(outputDir, "staffing_summary_preview.png"),
  new Uint8Array(await summaryPreview.arrayBuffer()),
);

const rosterPreview = await workbook.render({
  sheetName: "Roster",
  range: "A1:O18",
  scale: 1,
  format: "png",
});
await fs.writeFile(
  path.join(outputDir, "roster_preview.png"),
  new Uint8Array(await rosterPreview.arrayBuffer()),
);

const output = await SpreadsheetFile.exportXlsx(workbook);
const workbookPath = path.join(outputDir, "blue_current_staffing_roster.xlsx");
await output.save(workbookPath);

console.log(JSON.stringify({
  workbookPath,
  dataPath: path.join(dataDir, "blue_current_staffing.json"),
  employeeCount: employees.length,
  rotationCount: rotations.length,
  attractionCount: attractions.length,
  workbookInspection,
  formulaErrors,
}, null, 2));
