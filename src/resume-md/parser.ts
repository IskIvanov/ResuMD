/**
 * parser.ts
 *
 * Parses a Resume.md string into a validated ParsedResume. Pure: no file I/O.
 *
 * The document is read once: the header above the first `## ` heading, then
 * each section as logical lines (hard-wrapped lines joined) and `### ` entries.
 * Every logical line gets one LineKind from classifyLine, the only place that
 * decides what a line is; the section readers below only consume kinds.
 */

import { splitSections } from "../utils/markdown.ts";
import { splitList } from "../utils/string.ts";
import { validateParsedResume } from "./schema.ts";
import {
  type Entry,
  type Line,
  LineKind,
  type LineOf,
  type ParsedCertification,
  type ParsedContact,
  type ParsedEduItem,
  type ParsedJob,
  type ParsedLanguage,
  type ParsedLink,
  type ParsedProject,
  type ParsedResume,
  type ParsedSkillGroup,
  type ResumeDocument,
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
  const rest = text.replace(MARKDOWN_LINK_REGEX, "");
  return rest !== text && rest.split(CONTACT_SEPARATOR).join("").trim() === "";
}

/**
 * Decides what a logical line is. The checks run in a fixed order, so a line
 * that fits several shapes (a bold reference line is also bold text) gets the
 * first kind that fits.
 */
function classifyLine(text: string): Line {
  if (text === RULE) return { kind: LineKind.Rule, text };
  if (text.startsWith(BULLET_PREFIX)) {
    const item = text.slice(BULLET_PREFIX.length).trim();
    return { kind: LineKind.Bullet, text, item };
  }

  const reference = REFERENCE_LINE_REGEX.exec(text);
  if (reference) {
    const references = splitList(reference[1]);
    return { kind: LineKind.Reference, text, references };
  }

  if (text.startsWith(TECH_STACK_PREFIX)) {
    const stack = text.slice(TECH_STACK_PREFIX.length).trim();
    return { kind: LineKind.TechStack, text, stack };
  }

  const title = TITLE_LINE_REGEX.exec(text);
  if (title) {
    return {
      kind: LineKind.Title,
      text,
      title: title[1].trim(),
      period: title[2].trim(),
    };
  }

  const labelled = BOLD_PREFIX_REGEX.exec(text);
  if (labelled) {
    return {
      kind: LineKind.Labelled,
      text,
      label: labelled[1].trim(),
      rest: labelled[2],
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
function startsLogicalLine(raw: string): boolean {
  const line = classifyLine(raw);
  return (
    BLOCK_START_PREFIXES.some((prefix) => raw.startsWith(prefix)) ||
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
  const logical: string[] = [];
  let current: string | null = null;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length > 0 && current !== null && !startsLogicalLine(raw)) {
      current = `${current} ${line}`;
      continue;
    }
    if (current !== null) logical.push(current);
    current = null;
    if (line.length > 0) current = line;
  }
  if (current !== null) logical.push(current);

  return logical.map(classifyLine);
}

/** Reads one `### ` block; a block with no lines at all has no entry. */
function readEntries(chunk: string): Entry[] {
  const [heading, ...lines] = readLines(chunk).filter(
    (line) => line.kind !== LineKind.Rule,
  );
  if (heading === undefined) return [];
  return [{ heading: heading.text, lines }];
}

function readSection(body: string): Section {
  return {
    lines: readLines(body),
    entries: body
      .split(ENTRY_START)
      .filter((chunk) => chunk.trim().length > 0)
      .flatMap(readEntries),
  };
}

function readDocument(md: string): ResumeDocument {
  const [preamble] = `\n${md}`.split(SECTION_START);
  const header = preamble
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== RULE);
  const sections = new Map(
    Object.entries(splitSections(md)).map(([heading, body]) => [
      heading,
      readSection(body),
    ]),
  );
  return { header, sections };
}

// ─── Line helpers ─────────────────────────────────────────────────────────────

function sectionOf(document: ResumeDocument, heading: SectionHeading): Section {
  return document.sections.get(heading) ?? EMPTY_SECTION;
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

/** The items of every bullet line. */
function bulletItems(lines: Line[]): string[] {
  return linesOfKind(lines, LineKind.Bullet).map((line) => line.item);
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
 * The context paragraph after the `**Title** | dates` line; empty when the
 * entry has no title line.
 */
function contextAfterTitle(lines: Line[]): string {
  const titleIdx = lines.findIndex((line) => line.kind === LineKind.Title);
  if (titleIdx < 0) return "";
  return firstParagraph(lines.slice(titleIdx + 1));
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
  const separatorIdx = text.indexOf(NAME_SEPARATOR);
  if (separatorIdx < 0) return { name: text.trim(), qualifier: "" };
  return {
    name: text.slice(0, separatorIdx).trim(),
    qualifier: text.slice(separatorIdx + NAME_SEPARATOR.length).trim(),
  };
}

/** The value of the first `**Label** value` line with this label, or "". */
function labelledValue(lines: Line[], label: string): string {
  const line = linesOfKind(lines, LineKind.Labelled).find(
    (labelled) => labelled.label === label,
  );
  return line?.rest.trim() ?? "";
}

/**
 * Splits `Degree, Area` on its first `, `; the area is empty without one.
 */
function splitDegree(title: string): { degree: string; area: string } {
  const separatorIdx = title.indexOf(DEGREE_SEPARATOR);
  if (separatorIdx < 0) return { degree: title.trim(), area: "" };
  return {
    degree: title.slice(0, separatorIdx).trim(),
    area: title.slice(separatorIdx + DEGREE_SEPARATOR.length).trim(),
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
function parseLinks(text: string): ParsedLink[] {
  return [...text.matchAll(MARKDOWN_LINK_REGEX)].map((match) => ({
    label: match[1].trim(),
    url: match[2],
  }));
}

// ─── Section readers ──────────────────────────────────────────────────────────

/**
 * Personal details from the header: `# Name`, a `**Headline**` line and an
 * `a | b | c` contact line whose parts are recognised by shape (email, phone,
 * website), not position. The first unrecognised part is the location.
 * Markdown links anywhere below the headline become profiles.
 */
function readContact(header: string[]): ParsedContact {
  const nameLine = header.find((line) => line.startsWith(NAME_PREFIX));
  const headlineIdx = header.findIndex((line) => BOLD_LINE_REGEX.test(line));
  const headline = BOLD_LINE_REGEX.exec(header[headlineIdx] ?? "");
  // Contact details come from the first line only; links are read from every
  // line, so profiles may share the contact line or follow on their own.
  const contactLines = header
    .slice(headlineIdx + 1)
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
function readJob({ heading, lines }: Entry): ParsedJob {
  const { name, qualifier } = splitQualified(heading);
  const title = firstOfKind(lines, LineKind.Title);
  const references = firstOfKind(lines, LineKind.Reference)?.references;

  return {
    company: name,
    location: qualifier,
    role: title?.title ?? "",
    period: title?.period ?? "",
    context: contextAfterTitle(lines),
    bullets: bulletItems(lines),
    stack: firstOfKind(lines, LineKind.TechStack)?.stack ?? "",
    website: firstOfKind(lines, LineKind.Url)?.text ?? "",
    ...(references !== undefined && { references }),
  };
}

/**
 * A `### School — Location` entry of `## Education`. Optional `**Area:**`,
 * `**Grade:**` and `**Location:**` lines set those fields; the location line
 * overrides the heading's.
 */
function readEducation({ heading, lines }: Entry): ParsedEduItem {
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
    context: contextAfterTitle(lines),
    bullets: bulletItems(lines),
  };
}

/**
 * A `### Title` entry of `## Projects`. The heading is kept whole, since a
 * project title may itself contain ` — `; links come from every line.
 */
function readProject({ heading, lines }: Entry): ParsedProject {
  return {
    title: heading.trim(),
    context: firstParagraph(lines),
    stack: firstOfKind(lines, LineKind.TechStack)?.stack ?? "",
    links: lines.flatMap((line) => parseLinks(line.text)),
  };
}

/** Each `**Heading:** a, b` line of `## Technical Skills`. */
function readSkillGroups(lines: Line[]): ParsedSkillGroup[] {
  return linesOfKind(lines, LineKind.Labelled)
    .filter(
      (line) => line.label.endsWith(SKILL_LABEL_SUFFIX) && line.rest.length > 0,
    )
    .map((line) => ({
      heading: line.label.slice(0, -SKILL_LABEL_SUFFIX.length).trim(),
      items: line.rest
        .split(SKILL_SEPARATOR)
        .map((item) => item.trim())
        .filter(Boolean),
    }));
}

/**
 * A `### Title — Issuer` entry of `## Certifications`. A description
 * paragraph, a `**Credential ID:** a, b` line and a markdown link are each
 * optional; only the first link is kept.
 */
function readCertification({ heading, lines }: Entry): ParsedCertification {
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
function readLanguages(lines: Line[]): ParsedLanguage[] {
  return bulletItems(lines).map((item) => {
    const { name, qualifier } = splitQualified(item);
    return { language: name, ...splitFluency(qualifier) };
  });
}

/** Splits a language qualifier into its fluency and level; either may be absent. */
function splitFluency(qualifier: string): { fluency: string; level: number } {
  if (LANGUAGE_LEVEL_REGEX.test(qualifier)) {
    return { fluency: "", level: Number(qualifier) };
  }
  const rated = LANGUAGE_RATED_REGEX.exec(qualifier);
  if (rated) return { fluency: rated[1], level: Number(rated[2]) };
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
  if (line.kind === LineKind.Bullet) return line.item;
  return line.text;
}

/**
 * Each line of `## References`; without that section, a standalone note such
 * as "References available upon request" anywhere in the sections.
 */
function readReferences(document: ResumeDocument): string[] {
  const listed = sectionOf(document, SectionHeading.References).lines.filter(
    (line) => line.kind !== LineKind.Rule,
  );
  if (listed.length > 0) return listed.map(listedText);

  return [...document.sections.values()]
    .flatMap((section) => linesOfKind(section.lines, LineKind.Paragraph))
    .filter((line) => REFERENCES_NOTE_REGEX.test(line.text))
    .map((line) => line.text);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Parses a full Resume.md string into a structured ParsedResume object and
 * validates it against ParsedResumeSchema.
 *
 * @param markdown - The full Resume.md string.
 * @returns The parsed and validated resume.
 * @throws If required content is missing (the summary, a job's role or tech
 *   stack, a whole required section, …); the error names each path, e.g.
 *   `jobs[2].role: required`.
 *
 * @example
 * parseResume(readFileSync("Resume.md", "utf-8")).jobs[0].company;
 * // "Acme Corp"
 */
// todo; add a custom section for additional
export function parseResume(markdown: string): ParsedResume {
  const document = readDocument(markdown);
  const section = (heading: SectionHeading): Section =>
    sectionOf(document, heading);

  return validateParsedResume({
    contact: readContact(document.header),
    summary: textBeforeRule(section(SectionHeading.Summary).lines),
    jobs: section(SectionHeading.Experience).entries.map(readJob),
    skillGroups: readSkillGroups(section(SectionHeading.Skills).lines),
    eduItems: section(SectionHeading.Education).entries.map(readEducation),
    projects: section(SectionHeading.Projects).entries.map(readProject),
    certifications: section(SectionHeading.Certifications).entries.map(
      readCertification,
    ),
    languages: readLanguages(section(SectionHeading.Languages).lines),
    interests: readInterests(section(SectionHeading.Interests).lines),
    references: readReferences(document),
  });
}
