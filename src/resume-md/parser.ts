/**
 * parser.ts
 *
 * Parses a Resume.md string into a validated ResumeMd. Pure: no file I/O.
 *
 * Resume.md is read once into an outline: the header above the first `## `
 * heading, then each section as logical lines (hard-wrapped lines joined) and
 * `### ` entries.
 * Every logical line gets one LineKind from classifyLine, the only place that
 * decides what a line is; the section readers below only consume kinds.
 */

import { splitSections } from "../utils/markdown.ts";
import { splitList } from "../utils/string.ts";
import { validateResumeMd } from "./schema.ts";
import {
  type Entry,
  type Line,
  LineKind,
  type LineOf,
  type Certification,
  type Header,
  type School,
  type Job,
  type Language,
  type Link,
  type Project,
  type ResumeMd,
  type SkillGroup,
  type ResumeOutline,
  type Section,
  SectionHeading,
} from "./types.ts";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Raw line prefixes that always open a new logical line. */
const BLOCK_START_PREFIXES = ["- ", "#", "---"] as const;

const RULE = "---";
const BULLET_PREFIX = "- ";
const BOLD_MARKER = "**";
const HEADING_MARKER = "#";
const NAME_PREFIX = "# ";
const TECH_STACK_PREFIX = "**Tech Stack:**";
const CREDENTIAL_ID_LABEL = "Credential ID:";
/** Bold labels of the optional `**Label:** value` lines of an education entry. */
const EducationLabel = {
  Area: "Area:",
  Grade: "Grade:",
  Location: "Location:",
} as const;
const EDUCATION_LABELS: readonly string[] = Object.values(EducationLabel);
/** Ends the bold label of a `**Heading:** a, b` skill group. */
const SKILL_LABEL_SUFFIX = ":";
const SKILL_SEPARATOR = ", ";
/** Separates a name from its qualifier: `Company — Location`. */
const NAME_SEPARATOR = " — ";
/** Separates a degree from its area of study: `Degree, Area`. */
const DEGREE_SEPARATOR = ", ";
const CONTACT_SEPARATOR = "|";
const INTEREST_SEPARATOR = "·";

/** Opens a section; the leading newline anchors it to the start of a line. */
const SECTION_START = /\n## /;
/** Opens an entry inside a section. */
const ENTRY_START = /\n### /;
/** Matches a `**Title** | dates` line; group 1 is the title, 2 the dates. */
const TITLE_LINE_REGEX = /^\*\*(.+?)\*\* \| (.+)$/;
/** Matches a language qualifier that is only a level: `English — 5`. */
const LANGUAGE_LEVEL_REGEX = /^\d+$/;
/** Matches `Fluency (n/5)`; group 1 is the fluency, 2 the level. */
const LANGUAGE_RATED_REGEX = /^(.*?)\s*\((\d+)\/5\)$/;
/** The level of a language bullet that gives none; hides the indicator. */
const NO_LANGUAGE_LEVEL = 0;
/** Matches a line that is only bold text; group 1 is the text. */
const BOLD_LINE_REGEX = /^\*\*(.+)\*\*$/;
/** Matches a line opening with bold text; group 1 is it, 2 the remainder. */
const BOLD_PREFIX_REGEX = /^\*\*(.+?)\*\*\s*(.*)$/;
/**
 * Matches a `Reference: a, b` line in any case, singular or plural, plain or
 * bold with the colon inside or outside (`**Reference:**`, `**References**:`);
 * group 1 is the list.
 */
const REFERENCE_LINE_REGEX =
  /^(?:\*\*references?(?::\*\*|\*\*:)|references?:)\s*(.*)$/i;
const URL_LINE_REGEX = /^https?:\/\/\S+$/;
/** Matches `[label](http(s)://url)`; group 1 is the label, 2 the URL. */
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s().-]{6,}$/;
const WEBSITE_REGEX = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;
/** Matches a standalone note such as "References available upon request". */
const REFERENCES_NOTE_REGEX = /^References\b/i;

const EMPTY_SECTION: Section = { lines: [], entries: [] };

// ─── Reading the document ─────────────────────────────────────────────────────

/** True for a line made up only of markdown links and `|` separators. */
function isLinkLine(text: string): boolean {
  const withoutLinks = text.replace(MARKDOWN_LINK_REGEX, "");
  return (
    withoutLinks !== text &&
    withoutLinks.split(CONTACT_SEPARATOR).join("").trim() === ""
  );
}

/**
 * Decides what a logical line is. The checks run in a fixed order, so a line
 * that fits several shapes (a bold reference line is also bold text) gets the
 * first kind that fits.
 */
function classifyLine(text: string): Line {
  if (text === RULE) return { kind: LineKind.Rule, text };
  if (text.startsWith(BULLET_PREFIX)) {
    const bulletText = text.slice(BULLET_PREFIX.length).trim();
    return { kind: LineKind.Bullet, text, bulletText };
  }

  const referenceMatch = REFERENCE_LINE_REGEX.exec(text);
  if (referenceMatch) {
    const references = splitList(referenceMatch[1]);
    return { kind: LineKind.Reference, text, references };
  }

  if (text.startsWith(TECH_STACK_PREFIX)) {
    const techStack = text.slice(TECH_STACK_PREFIX.length).trim();
    return { kind: LineKind.TechStack, text, techStack };
  }

  const titleMatch = TITLE_LINE_REGEX.exec(text);
  if (titleMatch) {
    return {
      kind: LineKind.Title,
      text,
      title: titleMatch[1].trim(),
      period: titleMatch[2].trim(),
    };
  }

  const labelledMatch = BOLD_PREFIX_REGEX.exec(text);
  if (labelledMatch) {
    return {
      kind: LineKind.Labelled,
      text,
      label: labelledMatch[1].trim(),
      value: labelledMatch[2],
    };
  }

  if (text.startsWith(BOLD_MARKER) || text.startsWith(HEADING_MARKER)) {
    return { kind: LineKind.Markup, text };
  }
  if (URL_LINE_REGEX.test(text)) return { kind: LineKind.Url, text };
  if (isLinkLine(text)) return { kind: LineKind.Links, text };
  return { kind: LineKind.Paragraph, text };
}

/** True for an education entry's `**Grade:** value`-style line. */
function isEducationField(line: Line): boolean {
  return (
    line.kind === LineKind.Labelled && EDUCATION_LABELS.includes(line.label)
  );
}

/**
 * True when a raw line opens a new logical line rather than continuing a
 * hard-wrapped one: a bullet, heading or rule at the start of the line, a
 * reference line or an education field line.
 */
function startsLogicalLine(rawLine: string): boolean {
  const line = classifyLine(rawLine);
  return (
    BLOCK_START_PREFIXES.some((prefix) => rawLine.startsWith(prefix)) ||
    line.kind === LineKind.Reference ||
    isEducationField(line)
  );
}

/**
 * Joins hard-wrapped lines (e.g. Prettier's 80-char wrap) into logical lines
 * and classifies each. A blank line or a line that starts a block opens a new
 * logical line; any other line, indented or not, continues the previous one.
 */
function readLines(text: string): Line[] {
  const logicalLines: string[] = [];
  let currentLine: string | null = null;

  for (const rawLine of text.split("\n")) {
    const trimmedLine = rawLine.trim();
    if (
      trimmedLine.length > 0 &&
      currentLine !== null &&
      !startsLogicalLine(rawLine)
    ) {
      currentLine = `${currentLine} ${trimmedLine}`;
      continue;
    }
    if (currentLine !== null) logicalLines.push(currentLine);
    currentLine = null;
    if (trimmedLine.length > 0) currentLine = trimmedLine;
  }
  if (currentLine !== null) logicalLines.push(currentLine);

  return logicalLines.map(classifyLine);
}

/** Reads one `### ` block; a block with no lines at all has no entry. */
function readEntries(entryMarkdown: string): Entry[] {
  const [heading, ...lines] = readLines(entryMarkdown).filter(
    (line) => line.kind !== LineKind.Rule,
  );
  if (heading === undefined) return [];
  return [{ heading: heading.text, lines }];
}

function readSection(sectionMarkdown: string): Section {
  return {
    lines: readLines(sectionMarkdown),
    entries: sectionMarkdown
      .split(ENTRY_START)
      .filter((entryMarkdown) => entryMarkdown.trim().length > 0)
      .flatMap(readEntries),
  };
}

function readOutline(markdown: string): ResumeOutline {
  const [preamble] = `\n${markdown}`.split(SECTION_START);
  const headerLines = preamble
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== RULE);
  const sections = new Map(
    Object.entries(splitSections(markdown)).map(
      ([heading, sectionMarkdown]) => [heading, readSection(sectionMarkdown)],
    ),
  );
  return { headerLines, sections };
}

// ─── Line helpers ─────────────────────────────────────────────────────────────

function sectionOf(outline: ResumeOutline, heading: SectionHeading): Section {
  return outline.sections.get(heading) ?? EMPTY_SECTION;
}

function linesOfKind<TKind extends LineKind>(
  lines: Line[],
  kind: TKind,
): LineOf<TKind>[] {
  return lines.filter((line): line is LineOf<TKind> => line.kind === kind);
}

function firstOfKind<TKind extends LineKind>(
  lines: Line[],
  kind: TKind,
): LineOf<TKind> | undefined {
  return linesOfKind(lines, kind).at(0);
}

/** The text of every bullet line, without its `- `. */
function bulletTexts(lines: Line[]): string[] {
  return linesOfKind(lines, LineKind.Bullet).map((line) => line.bulletText);
}

/** The first paragraph, stopping at the first bullet; empty without one. */
function firstParagraph(lines: Line[]): string {
  for (const line of lines) {
    if (line.kind === LineKind.Bullet) break;
    if (line.kind === LineKind.Paragraph) return line.text;
  }
  return "";
}

/**
 * The intro paragraph after the `**Title** | dates` line; empty when the
 * entry has no title line.
 */
function introAfterTitle(lines: Line[]): string {
  const titleIndex = lines.findIndex((line) => line.kind === LineKind.Title);
  if (titleIndex < 0) return "";
  return firstParagraph(lines.slice(titleIndex + 1));
}

/** The text of every line before the first rule, joined with spaces. */
function textBeforeRule(lines: Line[]): string {
  let end = lines.findIndex((line) => line.kind === LineKind.Rule);
  if (end < 0) end = lines.length;
  return lines
    .slice(0, end)
    .map((line) => line.text)
    .join(" ");
}

/**
 * Splits `Name — Qualifier` on its first ` — `; the qualifier is empty
 * without one.
 */
function splitQualified(text: string): { name: string; qualifier: string } {
  const separatorIndex = text.indexOf(NAME_SEPARATOR);
  if (separatorIndex < 0) return { name: text.trim(), qualifier: "" };
  return {
    name: text.slice(0, separatorIndex).trim(),
    qualifier: text.slice(separatorIndex + NAME_SEPARATOR.length).trim(),
  };
}

/** The value of the first `**Label** value` line with this label, or "". */
function labelledValue(lines: Line[], label: string): string {
  const line = linesOfKind(lines, LineKind.Labelled).find(
    (labelledLine) => labelledLine.label === label,
  );
  return line?.value.trim() ?? "";
}

/**
 * Splits `Degree, Area` on its first `, `; the area is empty without one.
 */
function splitDegree(title: string): { degree: string; area: string } {
  const separatorIndex = title.indexOf(DEGREE_SEPARATOR);
  if (separatorIndex < 0) return { degree: title.trim(), area: "" };
  return {
    degree: title.slice(0, separatorIndex).trim(),
    area: title.slice(separatorIndex + DEGREE_SEPARATOR.length).trim(),
  };
}

/**
 * The degree and area of study: an `**Area:**` line keeps the whole title as
 * the degree; without one, the title splits as `Degree, Area`.
 */
function readDegree(
  title: string,
  areaField: string,
): { degree: string; area: string } {
  if (areaField !== "") return { degree: title.trim(), area: areaField };
  return splitDegree(title);
}

/** Every markdown link with an http(s) URL, in document order. */
function parseLinks(text: string): Link[] {
  return [...text.matchAll(MARKDOWN_LINK_REGEX)].map((linkMatch) => ({
    label: linkMatch[1].trim(),
    url: linkMatch[2],
  }));
}

// ─── Section readers ──────────────────────────────────────────────────────────

/**
 * Personal details from the header: `# Name`, a `**Headline**` line and an
 * `a | b | c` contact line whose parts are recognised by shape (email, phone,
 * website), not position. The first unrecognised part is the location.
 * Markdown links anywhere below the headline become profiles.
 */
function readHeader(headerLines: string[]): Header {
  const nameLine = headerLines.find((line) => line.startsWith(NAME_PREFIX));
  const headlineIndex = headerLines.findIndex((line) =>
    BOLD_LINE_REGEX.test(line),
  );
  const headline = BOLD_LINE_REGEX.exec(headerLines[headlineIndex] ?? "");
  // Contact details come from the first line only; links are read from every
  // line, so profiles may share the contact line or follow on their own.
  const contactLines = headerLines
    .slice(headlineIndex + 1)
    .filter((line) => !line.startsWith(HEADING_MARKER));
  const parts = (contactLines[0] ?? "")
    .split(CONTACT_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && parseLinks(part).length === 0);

  const email = parts.find((part) => EMAIL_REGEX.test(part)) ?? "";
  const phone = parts.find((part) => PHONE_REGEX.test(part)) ?? "";
  const website =
    parts.find((part) => part !== email && WEBSITE_REGEX.test(part)) ?? "";
  const location =
    parts.find((part) => ![email, phone, website].includes(part)) ?? "";

  return {
    name: nameLine?.slice(NAME_PREFIX.length).trim() ?? "",
    headline: headline?.[1].trim() ?? "",
    email,
    phone,
    location,
    website,
    profiles: parseLinks(contactLines.join("\n")),
  };
}

/** A `### Company — Location` entry of `## Experience`. */
function readJob({ heading, lines }: Entry): Job {
  const { name, qualifier } = splitQualified(heading);
  const title = firstOfKind(lines, LineKind.Title);
  const references = firstOfKind(lines, LineKind.Reference)?.references;

  return {
    company: name,
    location: qualifier,
    role: title?.title ?? "",
    period: title?.period ?? "",
    intro: introAfterTitle(lines),
    bullets: bulletTexts(lines),
    techStack: firstOfKind(lines, LineKind.TechStack)?.techStack ?? "",
    website: firstOfKind(lines, LineKind.Url)?.text ?? "",
    ...(references !== undefined && { references }),
  };
}

/**
 * A `### School — Location` entry of `## Education`. Optional `**Area:**`,
 * `**Grade:**` and `**Location:**` lines set those fields; the location line
 * overrides the heading's.
 */
function readSchool({ heading, lines }: Entry): School {
  const { name, qualifier } = splitQualified(heading);
  const title = firstOfKind(lines, LineKind.Title);
  const { degree, area } = readDegree(
    title?.title ?? "",
    labelledValue(lines, EducationLabel.Area),
  );
  let location = labelledValue(lines, EducationLabel.Location);
  if (location === "") location = qualifier;

  return {
    school: name,
    location,
    degree,
    area,
    grade: labelledValue(lines, EducationLabel.Grade),
    period: title?.period ?? "",
    intro: introAfterTitle(lines),
    bullets: bulletTexts(lines),
  };
}

/**
 * A `### Title` entry of `## Projects`. The heading is kept whole, since a
 * project title may itself contain ` — `; links come from every line.
 */
function readProject({ heading, lines }: Entry): Project {
  return {
    title: heading.trim(),
    intro: firstParagraph(lines),
    techStack: firstOfKind(lines, LineKind.TechStack)?.techStack ?? "",
    links: lines.flatMap((line) => parseLinks(line.text)),
  };
}

/** Each `**Heading:** a, b` line of `## Technical Skills`. */
function readSkillGroups(lines: Line[]): SkillGroup[] {
  return linesOfKind(lines, LineKind.Labelled)
    .filter(
      (line) =>
        line.label.endsWith(SKILL_LABEL_SUFFIX) && line.value.length > 0,
    )
    .map((line) => ({
      label: line.label.slice(0, -SKILL_LABEL_SUFFIX.length).trim(),
      skills: line.value
        .split(SKILL_SEPARATOR)
        .map((skill) => skill.trim())
        .filter(Boolean),
    }));
}

/**
 * A `### Title — Issuer` entry of `## Certifications`. A description
 * paragraph, a `**Credential ID:** a, b` line and a markdown link are each
 * optional; only the first link is kept.
 */
function readCertification({ heading, lines }: Entry): Certification {
  const { name, qualifier } = splitQualified(heading);
  const [link] = lines.flatMap((line) => parseLinks(line.text));

  return {
    title: name,
    issuer: qualifier,
    description: firstParagraph(lines),
    credentialIds: splitList(labelledValue(lines, CREDENTIAL_ID_LABEL)),
    ...(link !== undefined && { link }),
  };
}

/**
 * Each `- Language — Fluency (n/5)` bullet of `## Languages`; the fluency and
 * the level are each optional, and `- Language — n` gives a level alone.
 */
function readLanguages(lines: Line[]): Language[] {
  return bulletTexts(lines).map((bulletText) => {
    const { name, qualifier } = splitQualified(bulletText);
    return { language: name, ...splitFluency(qualifier) };
  });
}

/** Splits a language qualifier into its fluency and level; either may be absent. */
function splitFluency(qualifier: string): { fluency: string; level: number } {
  if (LANGUAGE_LEVEL_REGEX.test(qualifier)) {
    return { fluency: "", level: Number(qualifier) };
  }
  const ratedMatch = LANGUAGE_RATED_REGEX.exec(qualifier);
  if (ratedMatch) {
    return { fluency: ratedMatch[1], level: Number(ratedMatch[2]) };
  }
  return { fluency: qualifier, level: NO_LANGUAGE_LEVEL };
}

/** The `A · B · C` line of `## Interests`, up to the first rule. */
function readInterests(lines: Line[]): string[] {
  return textBeforeRule(lines)
    .split(INTEREST_SEPARATOR)
    .map((interest) => interest.trim())
    .filter(Boolean);
}

/** A reference line as listed: a bullet without its `- `. */
function listedText(line: Line): string {
  if (line.kind === LineKind.Bullet) return line.bulletText;
  return line.text;
}

/**
 * Each line of `## References`; without that section, a standalone note such
 * as "References available upon request" anywhere in the sections.
 */
function readReferences(outline: ResumeOutline): string[] {
  const listed = sectionOf(outline, SectionHeading.References).lines.filter(
    (line) => line.kind !== LineKind.Rule,
  );
  if (listed.length > 0) return listed.map(listedText);

  return [...outline.sections.values()]
    .flatMap((section) => linesOfKind(section.lines, LineKind.Paragraph))
    .filter((line) => REFERENCES_NOTE_REGEX.test(line.text))
    .map((line) => line.text);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Parses a full Resume.md string into what it says, a ResumeMd, and
 * validates it against ResumeMdSchema.
 *
 * @param markdown - The full Resume.md string.
 * @returns What Resume.md says, validated.
 * @throws If required content is missing (the summary, a job's role or tech
 *   stack, a whole required section, …); the error names each path, e.g.
 *   `jobs[2].role: required`.
 *
 * @example
 * parseResumeMd(readFileSync("Resume.md", "utf-8")).jobs[0].company;
 * // "Acme Corp"
 */
// todo; add a custom section for additional
export function parseResumeMd(markdown: string): ResumeMd {
  const outline = readOutline(markdown);
  const sectionNamed = (heading: SectionHeading): Section =>
    sectionOf(outline, heading);

  return validateResumeMd({
    header: readHeader(outline.headerLines),
    summary: textBeforeRule(sectionNamed(SectionHeading.Summary).lines),
    jobs: sectionNamed(SectionHeading.Experience).entries.map(readJob),
    skillGroups: readSkillGroups(sectionNamed(SectionHeading.Skills).lines),
    schools: sectionNamed(SectionHeading.Education).entries.map(readSchool),
    projects: sectionNamed(SectionHeading.Projects).entries.map(readProject),
    certifications: sectionNamed(SectionHeading.Certifications).entries.map(
      readCertification,
    ),
    languages: readLanguages(sectionNamed(SectionHeading.Languages).lines),
    interests: readInterests(sectionNamed(SectionHeading.Interests).lines),
    references: readReferences(outline),
  });
}
