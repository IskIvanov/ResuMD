import { describe, it, expect, vi } from "vitest";
import {
  mergeExperience,
  mergeSkills,
  mergeEducation,
  merge,
} from "./merger.ts";
import type { CvData } from "./types.ts";
import type { ParsedJob, ParsedResume } from "./parser.ts";

// ─── CvData fixture ───────────────────────────────────────────────────────────

function makeCv(): CvData {
  return {
    header: { name: "Test User", title: "Engineer" },
    contact: { items: [] },
    skillGroups: [
      {
        id: "languages",
        heading: "Languages",
        items: ["TypeScript", "JavaScript"],
      },
      { id: "frontend", heading: "Frontend", items: ["React"] },
    ],
    summary: { heading: "Summary" },
    experience: {
      items: [
        {
          company: "Acme Corp",
          location: "Amsterdam",
          role: "Senior Engineer",
          dates: "01/2023 – Present",
          datetime: "2023-01",
          context: "Acme Corp builds widgets.",
          bullets: ["Old bullet one.", "Old bullet two."],
          stack: "Old Stack",
        },
        {
          company: "Beta Inc",
          location: "Utrecht",
          role: "Engineer",
          dates: "01/2021 – 12/2022",
          datetime: "2021-01/2022-12",
          bullets: ["Old beta bullet."],
          stack: "Old Beta Stack",
        },
      ],
    },
    education: {
      items: [
        {
          school: "University A",
          location: "Springfield",
          degree: "Master's degree",
          dates: "2018 – 2019",
          datetime: "2018/2019",
          context: "Old context.",
          bullets: [
            {
              text: "Course Title Here",
              linkText: "LINK101",
              href: "/doc/LINK101.pdf",
            },
            { text: "Plain bullet." },
          ],
        },
        {
          school: "University B",
          degree: "Bachelor's",
          dates: "2012 – 2016",
          datetime: "2012/2016",
          context: "Old average.",
          bullets: [{ text: "Old thesis." }],
        },
      ],
    },
    projects: { items: [] },
    certifications: { items: [] },
    footer: {
      languages: { items: ["English"] },
      interests: { text: "Cycling" },
      references: "Available on request",
    },
  };
}

// ─── ParsedJob fixture ────────────────────────────────────────────────────────

/** Minimal ParsedJob matching the "Acme Corp" entry in makeCv(). */
function makeParsedJob(overrides: Partial<ParsedJob> = {}): ParsedJob {
  return {
    company: "Acme Corp",
    role: "Senior Engineer",
    bullets: ["New bullet."],
    stack: "New Stack",
    ...overrides,
  };
}

// ─── mergeExperience ──────────────────────────────────────────────────────────

describe("mergeExperience", () => {
  it("updates bullets and stack for matching company", () => {
    const cv = makeCv();
    mergeExperience(cv, [
      makeParsedJob({
        bullets: ["New bullet one.", "New bullet two.", "New bullet three."],
        stack: "React, TypeScript",
      }),
    ]);
    expect(cv.experience.items[0].bullets).toEqual([
      "New bullet one.",
      "New bullet two.",
      "New bullet three.",
    ]);
    expect(cv.experience.items[0].stack).toBe("React, TypeScript");
  });

  it("updates role for matching company", () => {
    const cv = makeCv();
    mergeExperience(cv, [makeParsedJob({ role: "Staff Engineer" })]);
    expect(cv.experience.items[0].role).toBe("Staff Engineer");
  });

  it("keeps the existing role when the parsed role is empty", () => {
    const cv = makeCv();
    mergeExperience(cv, [makeParsedJob({ role: "" })]);
    expect(cv.experience.items[0].role).toBe("Senior Engineer");
  });

  it("does not touch other fields on the matched job", () => {
    const cv = makeCv();
    mergeExperience(cv, [makeParsedJob()]);
    expect(cv.experience.items[0].location).toBe("Amsterdam");
    expect(cv.experience.items[0].context).toBe("Acme Corp builds widgets.");
    expect(cv.experience.items[0].datetime).toBe("2023-01");
  });

  it("warns and skips on unknown company", () => {
    const cv = makeCv();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mergeExperience(cv, [makeParsedJob({ company: "Unknown Corp" })]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unknown Corp"));
    warn.mockRestore();
  });
});

// ─── mergeSkills ──────────────────────────────────────────────────────────────

describe("mergeSkills", () => {
  it("updates items for matching heading", () => {
    const cv = makeCv();
    mergeSkills(cv, [
      { heading: "Languages", items: ["TypeScript", "JavaScript", "Python"] },
    ]);
    expect(cv.skillGroups[0].items).toEqual([
      "TypeScript",
      "JavaScript",
      "Python",
    ]);
  });

  it("does not touch non-matching groups", () => {
    const cv = makeCv();
    mergeSkills(cv, [{ heading: "Languages", items: ["TypeScript"] }]);
    expect(cv.skillGroups[1].items).toEqual(["React"]);
  });

  it("warns and skips on unknown heading", () => {
    const cv = makeCv();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mergeSkills(cv, [{ heading: "Unknown Group", items: [] }]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unknown Group"));
    warn.mockRestore();
  });
});

// ─── mergeEducation ───────────────────────────────────────────────────────────

describe("mergeEducation", () => {
  it("updates context for matching school", () => {
    const cv = makeCv();
    mergeEducation(cv, [
      {
        school: "University A",
        context: "New context text.",
        bullets: ["LINK101 Updated Course Title", "Updated plain bullet."],
      },
    ]);
    expect(cv.education.items[0].context).toBe("New context text.");
  });

  it("strips linkText prefix when updating bullets that have linkText", () => {
    const cv = makeCv();
    mergeEducation(cv, [
      {
        school: "University A",
        context: "Some context.",
        bullets: ["LINK101 Updated Course Title", "Updated plain bullet."],
      },
    ]);
    const bullets = cv.education.items[0].bullets;
    expect(bullets[0].text).toBe("Updated Course Title");
    expect(bullets[0].linkText).toBe("LINK101");
    expect(bullets[0].href).toBe("/doc/LINK101.pdf");
  });

  it("updates text directly for bullets without linkText", () => {
    const cv = makeCv();
    mergeEducation(cv, [
      {
        school: "University A",
        context: "Some context.",
        bullets: ["LINK101 Course Title Here", "New plain bullet text."],
      },
    ]);
    expect(cv.education.items[0].bullets[1].text).toBe(
      "New plain bullet text.",
    );
  });

  it("warns on bullet count mismatch and updates overlapping indices", () => {
    const cv = makeCv();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mergeEducation(cv, [
      {
        school: "University B",
        context: "90% average.",
        bullets: ["Thesis: My Research.", "Extra bullet that has no match."],
      },
    ]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("bullet count mismatch"),
    );
    expect(cv.education.items[1].bullets[0].text).toBe("Thesis: My Research.");
    warn.mockRestore();
  });

  it("warns and skips on unknown school", () => {
    const cv = makeCv();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mergeEducation(cv, [{ school: "Unknown Uni", context: "", bullets: [] }]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unknown Uni"));
    warn.mockRestore();
  });
});

// ─── merge ────────────────────────────────────────────────────────────────────

describe("merge", () => {
  it("returns the parsed summary as the new body", () => {
    const cv = makeCv();
    const parsed: ParsedResume = {
      summary: "New summary paragraph.",
      jobs: [],
      skillGroups: [],
      eduItems: [],
    };
    const summary = merge(cv, parsed);
    expect(summary).toBe("New summary paragraph.");
  });
});
