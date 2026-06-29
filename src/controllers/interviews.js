import {
  checkConflicts,
  scheduleTeamsMeeting,
  getPanelMembers,
  upsertPanelMember,
  deletePanelMember,
  saveInterview,
  getInterviewsByCandidate,
} from '../services/interviewService.js';

// GET /api/interviews/panel
export const listPanel = (req, res) => {
  const { department, region } = req.query;
  res.json(getPanelMembers({ department, region }));
};

// POST /api/interviews/panel  (create)
export const addPanelMember = (req, res) => {
  const { name, email, role, departments, regions } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  res.json(upsertPanelMember({ name, email, role, departments: departments ?? [], regions: regions ?? [] }));
};

// PUT /api/interviews/panel/:id  (update)
export const updatePanelMember = (req, res) => {
  const { name, email, role, departments, regions } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  res.json(upsertPanelMember({ id: req.params.id, name, email, role, departments: departments ?? [], regions: regions ?? [] }));
};

// DELETE /api/interviews/panel/:id
export const removePanelMember = (req, res) => {
  res.json(deletePanelMember(req.params.id));
};

// POST /api/interviews/check-conflicts
export const conflictCheck = async (req, res) => {
  try {
    const { attendeeEmails, startISO, endISO } = req.body;
    if (!attendeeEmails?.length || !startISO || !endISO)
      return res.status(400).json({ error: 'attendeeEmails, startISO, endISO required' });
    const result = await checkConflicts(attendeeEmails, startISO, endISO);
    res.json(result);
  } catch (err) {
    console.error('[interviews] conflict check error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/interviews/schedule
export const scheduleInterview = async (req, res) => {
  try {
    const {
      candidateId,
      candidateName,
      candidateEmail,
      requirementId,
      jobTitle,
      panelEmails,
      startISO,
      endISO,
      notes,
    } = req.body;

    if (!startISO || !endISO || !panelEmails?.length)
      return res.status(400).json({ error: 'startISO, endISO, and panelEmails are required' });

    const subject = `Interview: ${candidateName ?? 'Candidate'} — ${jobTitle ?? 'Position'}`;
    const attendeeEmails = [...new Set([candidateEmail, ...panelEmails].filter(Boolean))];

    const meeting = await scheduleTeamsMeeting({ subject, attendeeEmails, startISO, endISO, notes });

    const record = saveInterview({
      candidateId,
      candidateName,
      candidateEmail,
      requirementId,
      jobTitle,
      panelEmails,
      startISO,
      endISO,
      notes,
      teamsLink: meeting.teamsLink,
      meetingId: meeting.id,
      mock: meeting.mock,
    });

    res.json({ meeting, record });
  } catch (err) {
    console.error('[interviews] schedule error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/interviews/candidate/:candidateId
export const listCandidateInterviews = (req, res) => {
  res.json(getInterviewsByCandidate(req.params.candidateId));
};
