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

// Parse a resume file into a structured candidate record.
export const parseResume = async (buffer, mimetype, filename) => {
  const text = await extractText(buffer, mimetype, filename);

  const email = (text.match(EMAIL_RE) || [])[0] || '';
  const phone = (text.match(PHONE_RE) || [])[0]?.trim() || '';
  const name = guessName(text, email);
  const skills = detectSkills(text);

  return { name, email, phone, skills };
};
