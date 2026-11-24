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
 *
 * Both a hand-written Resume.md and Reactive Resume's Markdown export parse,
 * except that bullets are always `- text`: a `• ` line is rejected.
 */

import { splitSections } from "../utils/markdown.ts";
import { splitList } from "../utils/string.ts";
import { validateResumeMd } from "./schema.ts";
import {
  type DatedEntry,
  type Entry,
  type Line,
  LineKind,
  type LineOf,
  type Certification,
  type Header,
  type Interest,
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
/** A bullet typed as text, as stored resumes hold it; rejected, not read. */
const DOT_BULLET_PREFIX = "• ";
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
/** Separates the parts of an exported entry's italic details line. */
const DETAILS_SEPARATOR = " · ";
/** Opens the grade in an exported school's details line. */
const GRADE_PREFIX = "Grade: ";
const CONTACT_SEPARATOR = "|";
const INTEREST_SEPARATOR = "·";

/** Opens a section; the leading newline anchors it to the start of a line. */
const SECTION_START = /\n## /;
/** Opens an entry inside a section. */
const ENTRY_START = /\n### /;
/** Matches a `**Title** | dates` line; group 1 is the title, 2 the dates. */
const TITLE_LINE_REGEX = /^\*\*(.+?)\*\* \| (.+)$/;
/**
 * Matches an exported `Name — Title (dates)` heading; group 1 is the name, 2
 * the title and 3 the dates, always the last parentheses.
 */
const EXPORTED_HEADING_REGEX = /^(.+?) — (.+) \(([^()]+)\)$/;
/**
 * Matches an exported skill: `**Label** — Proficiency: a, b`, the proficiency
 * and the keywords each optional; group 1 is the label, 2 the proficiency and
 * 3 the keywords.
 */
const EXPORTED_SKILL_REGEX = /^\*\*(.+?)\*\*(?: — ([^:]+))?(?:: (.*))?$/;
/** Matches an exported `**Name**: a, b`; group 1 is the name, 2 the keywords. */
const EXPORTED_INTEREST_REGEX = /^\*\*(.+?)\*\*(?:: (.*))?$/;
/** Matches a title ending in `(period)`; group 1 is the title, 2 the period. */
const TRAILING_PERIOD_REGEX = /^(.+) \(([^()]+)\)$/;
/** Matches a language qualifier that is only a level: `English — 5`. */
const LANGUAGE_LEVEL_REGEX = /^\d+$/;
/** Matches `Fluency (n/5)`; group 1 is the fluency, 2 the level. */
const LANGUAGE_RATED_REGEX = /^(.*?)\s*\((\d+)\/5\)$/;
/** The level of a language bullet that gives none; hides the indicator. */
const NO_LANGUAGE_LEVEL = 0;
/** Matches a line that is only bold text; group 1 is the text. */
const BOLD_LINE_REGEX = /^\*\*(.+)\*\*$/;
/** Matches a line that is only italic text; group 1 is the text. */
const ITALIC_LINE_REGEX = /^_([^_]+)_$/;
/** Splits a contact line: `|` by hand, ` · ` in Reactive Resume's export. */
const CONTACT_PART_SEPARATOR_REGEX = /[|·]/;
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
/** What's left at the end of a line once its links are removed. */
const TRAILING_LINK_SEPARATORS_REGEX = /[\s|]+$/;
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
      title: (titleMatch[1] ?? "").trim(),
      period: (titleMatch[2] ?? "").trim(),
    };
  }

  // The only label Reactive Resume's export leaves plain.
  if (text.startsWith(CREDENTIAL_ID_LABEL)) {
    return {
      kind: LineKind.Labelled,
      text,
      label: CREDENTIAL_ID_LABEL,
      value: text.slice(CREDENTIAL_ID_LABEL.length).trim(),
    };
  }

  const labelledMatch = BOLD_PREFIX_REGEX.exec(text);
  if (labelledMatch) {
    return {
      kind: LineKind.Labelled,
      text,
      label: (labelledMatch[1] ?? "").trim(),
      value: labelledMatch[2] ?? "",
    };
  }

  if (text.startsWith(BOLD_MARKER) || text.startsWith(HEADING_MARKER)) {
    return { kind: LineKind.Markup, text };
  }
  if (URL_LINE_REGEX.test(text)) return { kind: LineKind.Url, text };
  if (isLinkLine(text)) return { kind: LineKind.Links, text };

  const italicMatch = ITALIC_LINE_REGEX.exec(text);
  if (italicMatch) {
    return {
      kind: LineKind.Italic,
      text,
      italicText: (italicMatch[1] ?? "").trim(),
    };
  }

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
  const [preamble = ""] = `\n${markdown}`.split(SECTION_START);
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
    if (line.kind === LineKind.Paragraph || line.kind === LineKind.Italic) {
      return line.text;
    }
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

/**
 * Reads a job or school written either way: an entry with a `**Title** | dates`
 * line is hand-written; any other takes the title and dates from an exported
 * `Name — Title (dates)` heading, with an optional italic details line right
 * under it. A heading that fits neither leaves the title and dates empty, for
 * validation to name.
 */
function readDatedEntry({ heading, lines }: Entry): DatedEntry {
  const titleLine = firstOfKind(lines, LineKind.Title);
  if (titleLine !== undefined) {
    return {
      name: splitQualified(heading).name,
      title: titleLine.title,
      period: titleLine.period,
      details: splitQualified(heading).qualifier,
      intro: introAfterTitle(lines),
    };
  }

  const headingMatch = EXPORTED_HEADING_REGEX.exec(heading);
  if (!headingMatch) {
    const { name, qualifier } = splitQualified(heading);
    return { name, title: "", period: "", details: qualifier, intro: "" };
  }

  const [, name = "", title = "", period = ""] = headingMatch;
  const [firstLine] = lines;
  if (firstLine?.kind === LineKind.Italic) {
    return {
      name,
      title,
      period,
      details: firstLine.italicText,
      intro: firstParagraph(lines.slice(1)),
    };
  }
  return { name, title, period, details: "", intro: firstParagraph(lines) };
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
    label: (linkMatch[1] ?? "").trim(),
    url: linkMatch[2] ?? "",
  }));
}

// ─── Section readers ──────────────────────────────────────────────────────────

/**
 * Personal details from the header: `# Name`, a `**Headline**` or `_Headline_`
 * line and an `a | b | c` or `a · b · c` contact line whose parts are
 * recognised by shape (email, phone, website), not position. The first
 * unrecognised part is the location. Markdown links anywhere below the
 * headline become profiles, except that without a bare website, a link
 * labelled with a domain is the website.
 */
function readHeader(headerLines: string[]): Header {
  const nameLine = headerLines.find((line) => line.startsWith(NAME_PREFIX));
  const headlineIndex = headerLines.findIndex(
    (line) => BOLD_LINE_REGEX.test(line) || ITALIC_LINE_REGEX.test(line),
  );
  const headlineLine = headerLines[headlineIndex] ?? "";
  const headline =
    BOLD_LINE_REGEX.exec(headlineLine) ?? ITALIC_LINE_REGEX.exec(headlineLine);
  // Contact details come from the first line only; links are read from every
  // line, so profiles may share the contact line or follow on their own.
  const contactLines = headerLines
    .slice(headlineIndex + 1)
    .filter((line) => !line.startsWith(HEADING_MARKER));
  const parts = (contactLines[0] ?? "")
    .split(CONTACT_PART_SEPARATOR_REGEX)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && parseLinks(part).length === 0);

  const email = parts.find((part) => EMAIL_REGEX.test(part)) ?? "";
  const phone = parts.find((part) => PHONE_REGEX.test(part)) ?? "";
  const bareWebsite =
    parts.find((part) => part !== email && WEBSITE_REGEX.test(part)) ?? "";
  const location =
    parts.find((part) => ![email, phone, bareWebsite].includes(part)) ?? "";
  const links = parseLinks(contactLines.join("\n"));
  const websiteLink = links.find(
    (link) => bareWebsite === "" && WEBSITE_REGEX.test(link.label),
  );

  return {
    name: nameLine?.slice(NAME_PREFIX.length).trim() ?? "",
    headline: headline?.[1]?.trim() ?? "",
    email,
    phone,
    location,
    website: websiteLink?.label ?? bareWebsite,
    ...(websiteLink !== undefined && { websiteUrl: websiteLink.url }),
    profiles: links.filter((link) => link !== websiteLink),
  };
}

/** The link on an entry's last links line, where the export puts a website. */
function linkedWebsite(lines: Line[]): Link | undefined {
  const linksLine = linesOfKind(lines, LineKind.Links).at(-1);
  return parseLinks(linksLine?.text ?? "").at(-1);
}

/**
 * A job of `## Experience`: `### Company — Location` with a `**Role** | dates`
 * line, or an exported `### Company — Role (dates)` with an `_Location_` line.
 */
function readJob(entry: Entry): Job {
  const { lines } = entry;
  const { name, title, period, details, intro } = readDatedEntry(entry);
  const references = firstOfKind(lines, LineKind.Reference)?.references;

  return {
    company: name,
    location: details,
    role: title,
    period,
    intro,
    bullets: bulletTexts(lines),
    techStack: firstOfKind(lines, LineKind.TechStack)?.techStack ?? "",
    website:
      firstOfKind(lines, LineKind.Url)?.text ?? linkedWebsite(lines)?.url ?? "",
    ...(references !== undefined && { references }),
  };
}

/** Splits a school's `Location · Grade: value` details; either may be absent. */
function readSchoolDetails(details: string): {
  location: string;
  grade: string;
} {
  const parts = details.split(DETAILS_SEPARATOR);
  const gradePart = parts.find((part) => part.startsWith(GRADE_PREFIX));
  return {
    location: parts
      .filter((part) => part !== gradePart)
      .join(DETAILS_SEPARATOR),
    grade: gradePart?.slice(GRADE_PREFIX.length) ?? "",
  };
}

/**
 * A school of `## Education`: `### School — Location` with a
 * `**Degree, Area** | dates` line, or an exported
 * `### School — Degree, Area (dates)` with an `_Location · Grade: value_` line.
 * Optional `**Area:**`, `**Grade:**` and `**Location:**` lines set those
 * fields and override the location and grade written elsewhere.
 */
function readSchool(entry: Entry): School {
  const { lines } = entry;
  const { name, title, period, details, intro } = readDatedEntry(entry);
  const { degree, area } = readDegree(
    title,
    labelledValue(lines, EducationLabel.Area),
  );
  const detailed = readSchoolDetails(details);
  let location = labelledValue(lines, EducationLabel.Location);
  if (location === "") location = detailed.location;
  let grade = labelledValue(lines, EducationLabel.Grade);
  if (grade === "") grade = detailed.grade;
  const website = linkedWebsite(lines);

  return {
    school: name,
    location,
    degree,
    area,
    grade,
    period,
    intro,
    bullets: bulletTexts(lines),
    ...(website !== undefined && { website }),
  };
}

/** The tech stack, without any links written on the same line. */
function techStackWithoutLinks(lines: Line[]): string {
  const techStack = firstOfKind(lines, LineKind.TechStack)?.techStack ?? "";
  return techStack
    .replace(MARKDOWN_LINK_REGEX, "")
    .replace(TRAILING_LINK_SEPARATORS_REGEX, "");
}

/** The links, each URL once, at its first position. */
function uniqueLinks(links: Link[]): Link[] {
  return links.filter(
    (link, index) =>
      links.findIndex((candidate) => candidate.url === link.url) === index,
  );
}

/**
 * A project's links from every line, the website first. The export writes the
 * website after the description, so a lone link on the entry's last line is
 * the website even when other links come before it.
 */
function readProjectLinks(lines: Line[]): Link[] {
  const links = lines.flatMap((line) => parseLinks(line.text));
  const lastLine = lines.at(-1);
  if (lastLine?.kind !== LineKind.Links) return uniqueLinks(links);

  const lastLineLinks = parseLinks(lastLine.text);
  if (lastLineLinks.length !== 1) return uniqueLinks(links);
  return uniqueLinks([...lastLineLinks, ...links]);
}

/**
 * A `### Title` or exported `### Title (period)` entry of `## Projects`. The
 * title is kept whole, since it may itself contain ` — `.
 */
function readProject({ heading, lines }: Entry): Project {
  const periodMatch = TRAILING_PERIOD_REGEX.exec(heading.trim());
  return {
    title: periodMatch?.[1] ?? heading.trim(),
    ...(periodMatch !== null && { period: periodMatch[2] }),
    intro: firstParagraph(lines),
    techStack: techStackWithoutLinks(lines),
    links: readProjectLinks(lines),
  };
}

function splitSkills(text: string): string[] {
  return text
    .split(SKILL_SEPARATOR)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

/**
 * Each `**Heading:** a, b` line of `## Technical Skills`, and each exported
 * `- **Heading** — Proficiency: a, b` bullet of `## Skills`. A skill with no
 * keywords stays in, for validation to name.
 */
function readSkillGroups(lines: Line[]): SkillGroup[] {
  const labelledGroups = linesOfKind(lines, LineKind.Labelled)
    .filter(
      (line) =>
        line.label.endsWith(SKILL_LABEL_SUFFIX) && line.value.length > 0,
    )
    .map((line) => ({
      label: line.label.slice(0, -SKILL_LABEL_SUFFIX.length).trim(),
      skills: splitSkills(line.value),
    }));
  const exportedGroups = bulletTexts(lines).flatMap((bulletText) => {
    const skillMatch = EXPORTED_SKILL_REGEX.exec(bulletText);
    if (!skillMatch) return [];
    const [, label = "", proficiency, keywords] = skillMatch;
    return [
      {
        label: label.trim(),
        ...(proficiency !== undefined && { proficiency: proficiency.trim() }),
        skills: splitSkills(keywords ?? ""),
      },
    ];
  });
  return [...labelledGroups, ...exportedGroups];
}

/**
 * A `### Title — Issuer` or exported `### Title — Issuer (date)` entry of
 * `## Certifications`. A description paragraph, a `**Credential ID:** a, b`
 * line and a markdown link are each optional; only the first link is kept.
 */
function readCertification({ heading, lines }: Entry): Certification {
  const { name, qualifier } = splitQualified(heading);
  const dateMatch = TRAILING_PERIOD_REGEX.exec(qualifier);
  const [link] = lines.flatMap((line) => parseLinks(line.text));

  return {
    title: name,
    issuer: dateMatch?.[1] ?? qualifier,
    ...(dateMatch !== null && { date: dateMatch[2] }),
    description: firstParagraph(lines),
    credentialIds: splitList(labelledValue(lines, CREDENTIAL_ID_LABEL)),
    ...(link !== undefined && { link }),
  };
}

/** The text without its `**` markers, which the export puts around names. */
function withoutBold(text: string): string {
  return text.replaceAll(BOLD_MARKER, "").trim();
}

/**
 * Each `- Language — Fluency (n/5)` bullet of `## Languages`, the name plain
 * or bold; the fluency and the level are each optional, and `- Language — n`
 * gives a level alone.
 */
function readLanguages(lines: Line[]): Language[] {
  return bulletTexts(lines).map((bulletText) => {
    const { name, qualifier } = splitQualified(bulletText);
    return { language: withoutBold(name), ...splitFluency(qualifier) };
  });
}

/** Splits a language qualifier into its fluency and level; either may be absent. */
function splitFluency(qualifier: string): { fluency: string; level: number } {
  if (LANGUAGE_LEVEL_REGEX.test(qualifier)) {
    return { fluency: "", level: Number(qualifier) };
  }
  const ratedMatch = LANGUAGE_RATED_REGEX.exec(qualifier);
  if (ratedMatch) {
    return { fluency: ratedMatch[1] ?? "", level: Number(ratedMatch[2]) };
  }
  return { fluency: qualifier, level: NO_LANGUAGE_LEVEL };
}

/**
 * The exported `- **Name**: a, b` bullets of `## Interests`; without bullets,
 * the `A · B · C` line up to the first rule.
 */
function readInterests(lines: Line[]): Interest[] {
  const bullets = bulletTexts(lines);
  if (bullets.length > 0) {
    return bullets.map((bulletText) => {
      const interestMatch = EXPORTED_INTEREST_REGEX.exec(bulletText);
      return {
        name: interestMatch?.[1]?.trim() ?? bulletText,
        keywords: splitSkills(interestMatch?.[2] ?? ""),
      };
    });
  }

  return textBeforeRule(lines)
    .split(INTEREST_SEPARATOR)
    .map((interest) => interest.trim())
    .filter(Boolean)
    .map((name) => ({ name, keywords: [] }));
}

/**
 * A reference line as listed: a bullet without its `- `. An exported
 * `- **Name** — Position` gives only the name, since the rest is its own
 * fields in the resume, not part of the name.
 */
function listedText(line: Line): string {
  if (line.kind !== LineKind.Bullet) return line.text;
  return (
    BOLD_PREFIX_REGEX.exec(line.bulletText)?.[1]?.trim() ?? line.bulletText
  );
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

/**
 * Refuses `• ` lines before anything is read. They would otherwise pass as
 * plain text, leaving jobs without bullets and a write erasing them.
 */
function rejectDotBullets(markdown: string): void {
  const dotBullets = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(DOT_BULLET_PREFIX));
  if (dotBullets.length === 0) return;

  let lineCount = `${dotBullets.length} lines start`;
  if (dotBullets.length === 1) lineCount = "1 line starts";
  throw new Error(
    `Invalid Resume.md:\n  ${lineCount} with "${DOT_BULLET_PREFIX}"; use "${BULLET_PREFIX}" instead. First: "${dotBullets[0]}"`,
  );
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
 *   `jobs[2].role: required`. Also if any line is a `• ` bullet.
 *
 * @example
 * parseResumeMd(readFileSync("Resume.md", "utf-8")).jobs[0].company;
 * // "Acme Corp"
 */
// todo; add a custom section for additional
export function parseResumeMd(markdown: string): ResumeMd {
  rejectDotBullets(markdown);
  const outline = readOutline(markdown);
  const sectionNamed = (heading: SectionHeading): Section =>
    sectionOf(outline, heading);

  return validateResumeMd({
    header: readHeader(outline.headerLines),
    summary: textBeforeRule(sectionNamed(SectionHeading.Summary).lines),
    jobs: sectionNamed(SectionHeading.Experience).entries.map(readJob),
    skillGroups: readSkillGroups([
      ...sectionNamed(SectionHeading.Skills).lines,
      ...sectionNamed(SectionHeading.ExportedSkills).lines,
    ]),
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
