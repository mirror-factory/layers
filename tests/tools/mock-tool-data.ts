export const mockToolInputs = {
  searchMeetings: {
    query: "pricing",
    limit: 3,
  },
  getMeetingDetails: {
    meetingId: "meeting_1",
  },
  listRecentMeetings: {
    limit: 1,
  },
  codeReview: {
    code: "const value = eval(input);",
    language: "typescript",
  },
} as const;

export const mockToolOutputs = {
  searchMeetings: {
    results: [{ meetingId: "meeting_1", relevance: 91 }],
  },
  getMeetingDetails: {
    id: "meeting_1",
    title: "Demo call",
    transcript: "Hello there",
    keyPoints: ["Budget"],
  },
  listRecentMeetings: {
    meetings: [{ id: "meeting_1", title: "Untitled", status: "completed" }],
  },
  codeReview: {
    critical: 1,
    totalIssues: 1,
  },
} as const;
