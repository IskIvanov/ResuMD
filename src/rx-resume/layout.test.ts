import { describe, it, expect } from "vitest";
import { applySectionOrder, SECTION_ORDER, SectionId } from "./layout.ts";
import type { Layout, ResumeData } from "./types.ts";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A two-column default layout, as a newly created resume might have. */
function makeLayout(): Layout {
  return {
    sidebarWidth: 35,
    pages: [
      {
        fullWidth: false,
        main: ["profiles", "summary", "experience", "education", "projects"],
        sidebar: ["skills", "languages", "interests", "certifications"],
      },
      {
        fullWidth: false,
        main: ["awards", "custom-section-uuid"],
        sidebar: ["references"],
      },
    ],
  };
}

function makeData(layout: Layout): ResumeData {
  // Only the layout matters here; the other blocks are not read.
  return { metadata: { template: "onyx", layout } } as unknown as ResumeData;
}

// ─── SECTION_ORDER ────────────────────────────────────────────────────────────

describe("SECTION_ORDER", () => {
  it("starts with the summary, then follows the resume's reading order", () => {
    expect(SECTION_ORDER).toEqual([
      SectionId.Summary,
      SectionId.Skills,
      SectionId.Experience,
      SectionId.Education,
      SectionId.Projects,
      SectionId.Languages,
      SectionId.Certifications,
      SectionId.References,
      SectionId.Interests,
    ]);
  });
});

// ─── applySectionOrder ────────────────────────────────────────────────────────

describe("applySectionOrder", () => {
  it("puts the ordered sections first on a single full-width page", () => {
    const { pages } = applySectionOrder(makeData(makeLayout()), SECTION_ORDER)
      .metadata.layout;

    expect(pages).toHaveLength(1);
    expect(pages[0].fullWidth).toBe(true);
    expect(pages[0].sidebar).toEqual([]);
    expect(pages[0].main.slice(0, SECTION_ORDER.length)).toEqual([
      ...SECTION_ORDER,
    ]);
  });

  it("keeps the remaining sections after them, in their existing order", () => {
    const { pages } = applySectionOrder(makeData(makeLayout()), SECTION_ORDER)
      .metadata.layout;

    expect(pages[0].main.slice(SECTION_ORDER.length)).toEqual([
      "profiles",
      "awards",
      "custom-section-uuid",
    ]);
  });

  it("lists each section once, even if the layout repeats it", () => {
    const layout = makeLayout();
    layout.pages[1].main.push("skills", "awards");
    const { main } = applySectionOrder(makeData(layout), SECTION_ORDER).metadata
      .layout.pages[0];

    expect(main).toHaveLength(new Set(main).size);
  });

  it("includes an ordered section the layout did not list", () => {
    const layout: Layout = { sidebarWidth: 35, pages: [] };
    expect(
      applySectionOrder(makeData(layout), ["skills", "summary"]).metadata.layout
        .pages[0].main,
    ).toEqual(["skills", "summary"]);
  });

  it("keeps the sidebar width and the rest of the metadata", () => {
    const { metadata } = applySectionOrder(
      makeData(makeLayout()),
      SECTION_ORDER,
    );
    expect(metadata.layout.sidebarWidth).toBe(35);
    expect(metadata.template).toBe("onyx");
  });

  it("does not mutate the given data", () => {
    const data = makeData(makeLayout());
    applySectionOrder(data, SECTION_ORDER);
    expect(data.metadata.layout).toEqual(makeLayout());
  });
});
