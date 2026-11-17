/**
 * example.ts
 *
 * The Resume.md that example-resume writes: Jane Doe's, in the hand-written
 * format, with every section the parser reads, for a person to fill in. It
 * lives in code rather than a `.md` file because `.gitignore` blocks `*.md`
 * and a single-file build ships only code.
 */

/** Jane Doe's Resume.md, which parseResumeMd accepts. */
export const EXAMPLE_RESUME_MD = `# Jane Doe

**Software Engineer**

jane.doe@example.com | +31 6 12345678 | Amsterdam, Netherlands | example.com
[LinkedIn](https://linkedin.com/in/jane-doe) |
[GitHub](https://github.com/jane-doe)

---

## Summary

Software engineer who builds reliable products end to end, from API design to
the interface people use every day.

---

## Experience

### Acme BV — Amsterdam

**Senior Software Engineer** | 01/2021 – Present

Acme BV makes scheduling software for clinics across Europe.

- Led the move of a legacy dashboard to a typed component library, cutting
  release time in half.
- Designed the public REST API that partner integrations use.

**Tech Stack:** TypeScript, React, Node.js, PostgreSQL

**Reference:** john.smith@example.com

---

### Example Corp — Utrecht

**Software Engineer** | 09/2016 – 12/2020

- Built the billing service that handles every customer invoice.
- Cut the test suite's run time from 20 minutes to 4.

**Tech Stack:** Python, Django, Vue.js

---

## Technical Skills

**Languages:** TypeScript, Python, SQL

**Frontend:** React, Vue.js

**Backend:** Node.js, Django, PostgreSQL

---

## Education

### Example University — Amsterdam

**Bachelor's degree, Computer Science** | 2012 – 2016

**Grade:** 8.5 / 10

---

## Projects

### Example Project (2024)

A small tool that turns a Markdown file into a printable resume.

**Tech Stack:** TypeScript, Bun

[GitHub](https://github.com/jane-doe/example-project)

---

## Certifications

### Example Certification — Example Issuer

What the certification covers, in one sentence.

**Credential ID:** EX-0001

[Credential](https://example.com/cert/EX-0001)

---

## Languages

- English — Native
- Dutch — Conversational

---

## Interests

Cycling · Travel · Photography

---

References available upon request
`;
