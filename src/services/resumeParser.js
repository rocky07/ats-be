// Extracts text from an uploaded resume buffer and pulls out structured fields.
import mammoth from 'mammoth';

// A small, pragmatic skill dictionary used to detect skills in resume text.
const KNOWN_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Redux', 'Node.js', 'Node', 'Express',
  'Java', 'Spring', 'Python', 'Django', 'Flask', 'C++', 'C#', '.NET', 'Go',
  'Rust', 'Ruby', 'Rails', 'PHP', 'Laravel', 'HTML', 'CSS', 'SASS', 'Tailwind',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD',
  'Git', 'Jenkins', 'Kafka', 'RabbitMQ', 'Vue', 'Angular', 'Next.js',
  'Machine Learning', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy',
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;

// Extract raw text from a resume file based on its mimetype/extension.
export const extractText = async (buffer, mimetype = '', filename = '') => {
  const name = filename.toLowerCase();

  if (mimetype === 'application/pdf' || name.endsWith('.pdf')) {
    // Import the lib entry directly: pdf-parse's index.js runs a debug harness
    // (reading a bundled test PDF) on import, which throws in this context.
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  // Fallback: treat as plain text (.txt and anything else).
  return buffer.toString('utf-8');
};

// Guess the candidate name from the first meaningful line of the resume.
const guessName = (text, email) => {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Skip lines that are clearly contact info or headings.
    if (EMAIL_RE.test(line) || PHONE_RE.test(line)) continue;
    if (/resume|curriculum|vitae|cv/i.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && /^[A-Za-z.,'-\s]+$/.test(line)) {
      return line.replace(/[.,]+$/, '');
    }
  }

  // Fall back to the local part of the email address.
  if (email) {
    return email
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return 'Unknown Candidate';
};

const detectSkills = (text) => {
  const found = new Set();
  for (const skill of KNOWN_SKILLS) {
    // Word-boundary-ish match, escaping regex special chars in the skill name.
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i');
    if (re.test(text)) found.add(skill);
  }
  return [...found];
};

// Rule-based parse — always available, no API cost.
const parseResumeBasic = (text) => {
  const email = (text.match(EMAIL_RE) || [])[0] || '';
  const phone = (text.match(PHONE_RE) || [])[0]?.trim() || '';
  const name = guessName(text, email);
  const skills = detectSkills(text);
  return { name, email, phone, skills };
};

// AI-powered parse using Claude.
const parseResumeWithAI = async (text) => {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Extract structured data from this resume and return ONLY a valid JSON object with no extra text or markdown:
{
  "name": "full name of the candidate",
  "email": "email address",
  "phone": "phone number",
  "location": "city, state or country if mentioned",
  "title": "current or most recent job title",
  "summary": "2-3 sentence professional summary capturing the candidate's background, strengths, and career focus — write it in third person",
  "yearsOfExperience": 0,
  "skills": ["array", "of", "technical", "and", "soft", "skills"],
  "experience": [
    {
      "company": "company name",
      "title": "job title",
      "startDate": "month year or year",
      "endDate": "month year, year, or Present",
      "description": "brief summary of role and achievements"
    }
  ],
  "education": [
    {
      "institution": "school name",
      "degree": "degree and field of study",
      "year": "graduation year or year range"
    }
  ],
  "certifications": ["list of certifications if any"],
  "languages": ["spoken or programming languages if listed separately from skills"]
}

Rules:
- yearsOfExperience: integer, estimate from work history if not stated explicitly
- summary: always generate one even if the resume has no summary section — infer from the overall profile
- If a field is not found, use empty string, 0, or empty array as appropriate
- Do not include markdown fences in your response

Resume text:
---
${text.slice(0, 8000)}`,
    }],
  });

  try {
    const raw = message.content[0].text.trim();
    const json = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(json);
    // Ensure basic fields always present for backwards compatibility
    return {
      name: parsed.name || '',
      email: parsed.email || '',
      phone: parsed.phone || '',
      location: parsed.location || '',
      title: parsed.title || '',
      summary: parsed.summary || '',
      yearsOfExperience: parsed.yearsOfExperience || 0,
      skills: parsed.skills || [],
      experience: parsed.experience || [],
      education: parsed.education || [],
      certifications: parsed.certifications || [],
      languages: parsed.languages || [],
    };
  } catch {
    console.warn('[resumeParser] AI response could not be parsed, falling back to basic');
    return parseResumeBasic(text);
  }
};

// Parse a resume file into a structured candidate record.
// Pass useAI=true to use Claude; falls back to rule-based on any error.
export const parseResume = async (buffer, mimetype, filename, useAI = false) => {
  const text = await extractText(buffer, mimetype, filename);
  if (useAI) {
    try {
      return await parseResumeWithAI(text);
    } catch (e) {
      console.warn('[resumeParser] AI parsing failed, falling back to basic:', e.message);
    }
  }
  return parseResumeBasic(text);
};
