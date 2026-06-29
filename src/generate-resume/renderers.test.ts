import { describe, it, expect } from 'vitest'
import {
  renderHeader,
  renderContact,
  renderSummary,
  renderExperienceItem,
  renderExperience,
  renderSkillGroup,
  renderSkills,
  renderEducationItem,
  renderProjectItem,
  renderCertificationItem,
  renderLanguages,
  renderInterests,
} from './renderers.ts'
import type {
  ContactItem,
  ExperienceItem,
  EducationItem,
  ProjectItem,
  CertificationItem,
  SkillGroup,
} from './types.ts'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const job: ExperienceItem = {
  company: 'Acme Corp',
  location: 'Amsterdam',
  role: 'Senior Engineer',
  dates: '01/2023 – Present',
  datetime: '2023-01',
  context: 'A fintech scale-up.',
  bullets: ['Built X', 'Improved Y by 30%'],
  stack: 'React, TypeScript, Node.js',
}

const jobNoContext: ExperienceItem = { ...job, context: null }

const education: EducationItem = {
  school: 'MIT',
  location: 'Cambridge',
  degree: 'BSc Computer Science',
  dates: '2010 – 2014',
  datetime: '2010/2014',
  context: 'Graduated with honours.',
  bullets: [
    {
      text: 'Distributed Systems',
      linkText: 'CS6.824',
      href: 'https://example.com',
    },
    { text: 'Thesis: Foo Bar', linkText: null, href: null },
  ],
}

const project: ProjectItem = {
  title: 'My Side Project',
  context: 'A small tool for developers.',
  links: [{ label: 'GitHub', href: 'https://github.com/example' }],
  stack: 'TypeScript, Vite',
}

const cert: CertificationItem = {
  title: 'AWS Solutions Architect',
  issuer: 'Amazon',
  credentials: [{ id: 'AWS-12345', href: '/certs/aws.pdf' }],
}

const certNoCredentials: CertificationItem = {
  title: 'Example Certified Developer',
  issuer: 'Example Institute',
} as CertificationItem

const contacts: ContactItem[] = [
  {
    label: 'hello@example.com',
    href: 'mailto:hello@example.com',
    icon: 'email',
  },
  { label: 'Amsterdam', icon: 'location' },
  {
    label: 'example.com',
    href: 'https://example.com',
    target: '_blank',
    icon: 'globe',
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com',
    target: '_blank',
    icon: 'linkedin',
  },
]

const skillGroup: SkillGroup = {
  id: 'frontend',
  heading: 'Frontend',
  items: ['React', 'TypeScript', 'CSS'],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('renderHeader', () => {
  it('renders name as h1 and title in bold', () => {
    const output = renderHeader('Jane Doe', 'Senior Software Engineer')
    expect(output).toBe('# Jane Doe\n\n**Senior Software Engineer**')
  })
})

describe('renderContact', () => {
  it('puts items without target on the first row', () => {
    const output = renderContact(contacts)
    const [row1] = output.split('\n')
    expect(row1).toBe('hello@example.com | Amsterdam')
  })

  it("puts items with target='_blank' on the second row", () => {
    const output = renderContact(contacts)
    const [, row2] = output.split('\n')
    expect(row2).toBe('example.com | LinkedIn')
  })
})

describe('renderSummary', () => {
  it('renders the h2 heading followed by the body', () => {
    const output = renderSummary('I am an engineer.')
    expect(output).toBe('## Summary\n\nI am an engineer.')
  })

  it('trims leading/trailing whitespace from body', () => {
    const output = renderSummary('  \n  I am an engineer.  \n  ')
    expect(output).toContain('I am an engineer.')
    expect(output).not.toMatch(/^\s+/)
  })
})

describe('renderExperienceItem', () => {
  it('renders company, location, role and dates', () => {
    const output = renderExperienceItem(job)
    expect(output).toContain('### Acme Corp — Amsterdam')
    expect(output).toContain('**Senior Engineer** | 01/2023 – Present')
  })

  it('includes context when present', () => {
    expect(renderExperienceItem(job)).toContain('A fintech scale-up.')
  })

  it('omits context block when null', () => {
    expect(renderExperienceItem(jobNoContext)).not.toContain(
      'A fintech scale-up.'
    )
  })

  it('renders each bullet as a markdown list item', () => {
    const output = renderExperienceItem(job)
    expect(output).toContain('- Built X')
    expect(output).toContain('- Improved Y by 30%')
  })

  it('renders the tech stack line', () => {
    expect(renderExperienceItem(job)).toContain(
      '**Tech Stack:** React, TypeScript, Node.js'
    )
  })
})

describe('renderExperience', () => {
  it('renders the section heading', () => {
    expect(renderExperience([job])).toContain('## Experience')
  })

  it('separates multiple jobs with a divider', () => {
    const output = renderExperience([job, jobNoContext])
    expect(output).toContain('---')
  })
})

describe('renderSkillGroup', () => {
  it('renders heading in bold followed by comma-separated items', () => {
    expect(renderSkillGroup(skillGroup)).toBe(
      '**Frontend:** React, TypeScript, CSS'
    )
  })
})

describe('renderSkills', () => {
  it('renders the section heading', () => {
    expect(renderSkills([skillGroup])).toContain('## Technical Skills')
  })

  it('renders all groups', () => {
    const backend: SkillGroup = {
      id: 'backend',
      heading: 'Backend',
      items: ['Node.js'],
    }
    const output = renderSkills([skillGroup, backend])
    expect(output).toContain('**Frontend:**')
    expect(output).toContain('**Backend:**')
  })
})

describe('renderEducationItem', () => {
  it('includes school, location, degree and dates', () => {
    const output = renderEducationItem(education)
    expect(output).toContain('### MIT — Cambridge')
    expect(output).toContain('**BSc Computer Science** | 2010 – 2014')
  })

  it('prepends linkText to the bullet text when present', () => {
    const output = renderEducationItem(education)
    expect(output).toContain('- CS6.824 Distributed Systems')
  })

  it('renders bullets without linkText as plain text', () => {
    const output = renderEducationItem(education)
    expect(output).toContain('- Thesis: Foo Bar')
  })

  it('omits location dash when location is null', () => {
    const noLocation: EducationItem = { ...education, location: null }
    expect(renderEducationItem(noLocation)).toContain('### MIT\n')
  })
})

describe('renderProjectItem', () => {
  it('renders title as h3 and includes context and stack', () => {
    const output = renderProjectItem(project)
    expect(output).toContain('### My Side Project')
    expect(output).toContain('A small tool for developers.')
    expect(output).toContain('**Tech Stack:** TypeScript, Vite')
  })

  it('renders link labels separated by pipe', () => {
    const multi: ProjectItem = {
      ...project,
      links: [
        { label: 'GitHub', href: 'https://github.com' },
        { label: 'Demo', href: 'https://demo.com' },
      ],
    }
    expect(renderProjectItem(multi)).toContain('GitHub | Demo')
  })
})

describe('renderCertificationItem', () => {
  it('renders title in bold and issuer', () => {
    const output = renderCertificationItem(cert)
    expect(output).toContain('**AWS Solutions Architect**')
    expect(output).toContain('Amazon')
  })

  it('renders a single credential ID', () => {
    const output = renderCertificationItem(cert)
    expect(output).toContain('Credential ID: AWS-12345')
  })

  it('joins multiple credential IDs with a comma', () => {
    const multi: CertificationItem = {
      ...cert,
      credentials: [
        { id: 'ID-1', href: '/1.pdf' },
        { id: 'ID-2', href: '/2.pdf' },
      ],
    }
    expect(renderCertificationItem(multi)).toContain(
      'Credential ID: ID-1, ID-2'
    )
  })

  it('omits credential line when credentials array is empty', () => {
    const empty: CertificationItem = { ...cert, credentials: [] }
    const output = renderCertificationItem(empty)
    expect(output).toContain('**AWS Solutions Architect**')
    expect(output).not.toContain('Credential ID')
  })

  it('renders without crashing and omits credential line when credentials is absent', () => {
    const output = renderCertificationItem(certNoCredentials)
    expect(output).toContain('**Example Certified Developer**')
    expect(output).toContain('Example Institute')
    expect(output).not.toContain('Credential ID')
  })
})

describe('renderLanguages', () => {
  it('renders each language as a bullet', () => {
    const output = renderLanguages(['English — Fluent', 'Dutch — B1'])
    expect(output).toContain('- English — Fluent')
    expect(output).toContain('- Dutch — B1')
  })
})

describe('renderInterests', () => {
  it('renders the section heading and interest text', () => {
    const output = renderInterests('Cycling · Travel')
    expect(output).toContain('## Interests')
    expect(output).toContain('Cycling · Travel')
  })
})
