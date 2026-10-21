import { apiGet } from './api';

const sanitizeFilename = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'artifact';

const downloadTextFile = (filename: string, content: string) => {
  const blob = new Blob([content || ''], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const extractList = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry) return '';
        if (typeof entry === 'string') return entry;
        try {
          return JSON.stringify(entry);
        } catch {
          return String(entry);
        }
      })
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\n+/)
      .map((line) => line.replace(/^[*-]\s*/, '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    try {
      return Object.values(value)
        .map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)))
        .filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
};

const formatSection = (
  title: string,
  body: string | string[] | null | undefined,
  { asHtml = false }: { asHtml?: boolean } = {}
) => {
  if (!body) return '';
  const formatList = (items: string[]) =>
    asHtml ? `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>` : items.map((item) => `- ${item}`).join('\n');

  if (Array.isArray(body)) {
    if (!body.length) return '';
    return asHtml
      ? `<section><h3>${title}</h3>${formatList(body)}</section>`
      : `## ${title}\n${formatList(body)}\n`;
  }
  const trimmed = body.toString().trim();
  if (!trimmed) return '';
  return asHtml ? `<section><h3>${title}</h3><p>${trimmed}</p></section>` : `## ${title}\n${trimmed}\n`;
};

const safeParseJson = (value?: string) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const openPrintableWindow = (title: string, htmlBody: string) => {
  const printWindow = window.open('', '_blank', 'width=1024,height=768');
  if (!printWindow) {
    throw new Error('Popup blocked. Allow popups to download analysis.');
  }
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: 'Inter', Arial, sans-serif;
            padding: 32px;
            background: #f8fafc;
            color: #0f172a;
            line-height: 1.6;
          }
          h1 {
            margin-bottom: 0;
          }
          h2 {
            margin-top: 32px;
            color: #0f172a;
          }
          h3 {
            margin-top: 24px;
            color: #1d4ed8;
          }
          section {
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          }
          ul {
            padding-left: 20px;
          }
          .meta {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            margin-bottom: 16px;
            font-size: 0.9rem;
            color: #475569;
          }
          .chip {
            display: inline-flex;
            padding: 4px 12px;
            border-radius: 999px;
            background: rgba(37, 99, 235, 0.1);
            color: #1d4ed8;
            font-size: 0.85rem;
            margin-right: 8px;
            margin-bottom: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            margin-bottom: 16px;
          }
          table th, table td {
            border: 1px solid rgba(15, 23, 42, 0.08);
            padding: 8px;
            text-align: left;
          }
          table th {
            background: rgba(226, 232, 240, 0.4);
          }
        </style>
      </head>
      <body>
        ${htmlBody}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
};

const buildTranscriptAnalysisPrintout = (payload: any) => {
  const analysisResult =
    typeof payload?.analysisResult === 'string'
      ? safeParseJson(payload.analysisResult)
      : payload?.analysisResult || {};

  const summary =
    analysisResult?.transcriptSummary ||
    analysisResult?.summary ||
    payload?.transcriptExcerpt ||
    'Summary not available.';

  const speakers = Array.isArray(analysisResult?.speakers) ? analysisResult.speakers : [];
  const speakerTable = speakers.length
    ? `<table>
        <thead>
          <tr>
            <th>Speaker</th>
            <th>Role</th>
            <th>Talk Ratio</th>
            <th>Sentiment</th>
          </tr>
        </thead>
        <tbody>
          ${speakers
            .map(
              (speaker: any) => `
            <tr>
              <td>${speaker.name || 'Speaker'}</td>
              <td>${speaker.role || '—'}</td>
              <td>${speaker.talkRatio ? `${speaker.talkRatio}%` : '—'}</td>
              <td>${speaker.sentiment || speaker.inferredSentiment || '—'}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>`
    : '';

  const pursuitBrief = analysisResult?.pursuitBrief
    ? Object.entries(analysisResult.pursuitBrief)
        .map(
          ([question, answer]) =>
            `<section><h3>${question}</h3><p>${(answer as string) || 'No answer provided.'}</p></section>`
        )
        .join('')
    : '';

  const html = `
    <h1>${payload?.meetingTitle || 'Transcript Analysis'}</h1>
    <div class="meta">
      ${payload?.companyName ? `<span>Account: ${payload.companyName}</span>` : ''}
      ${payload?.analyzedAt ? `<span>Analyzed: ${new Date(payload.analyzedAt).toLocaleString()}</span>` : ''}
      ${typeof payload?.opportunityScore === 'number' ? `<span>Opportunity Score: ${payload.opportunityScore}/100</span>` : ''}
      ${typeof payload?.successProbability === 'number' ? `<span>Win Probability: ${payload.successProbability}%</span>` : ''}
      ${payload?.sentiment ? `<span>Sentiment: ${payload.sentiment}</span>` : ''}
    </div>
    <section>
      <h2>Executive Summary</h2>
      <p>${summary}</p>
    </section>
    ${formatSection(
      'Key Insights',
      extractList(
        analysisResult?.keyPoints || analysisResult?.keyDiscussionPoints || analysisResult?.insights
      ),
      { asHtml: true }
    )}
    ${formatSection('Risks & Challenges', extractList(analysisResult?.riskFactors || analysisResult?.challenges), {
      asHtml: true,
    })}
    ${formatSection(
      'Opportunities',
      extractList(analysisResult?.opportunities || analysisResult?.opportunitiesDetected),
      { asHtml: true }
    )}
    ${formatSection('Recommended Next Steps', extractList(analysisResult?.nextSteps), { asHtml: true })}
    ${formatSection('Buying Signals', extractList(analysisResult?.buyingSignals), { asHtml: true })}
    ${formatSection('Recommended Products / Team', extractList(analysisResult?.recommendedTeam), { asHtml: true })}
    ${formatSection('Relevant Case Studies', extractList(analysisResult?.relevantCaseStudies), { asHtml: true })}
    ${speakerTable}
    ${pursuitBrief}
    ${
      payload?.transcriptText
        ? `<section><h3>Transcript</h3><p>${payload.transcriptText.replace(/\n/g, '<br/>')}</p></section>`
        : ''
    }
  `;

  openPrintableWindow(payload?.meetingTitle || 'Transcript Analysis', html);
};

const buildProposalAnalysisReport = (payload: any, fallbackName: string) => {
  const proposalData = payload?.proposalData || {};
  const lines = [
    '# Solution Proposal Output',
    '',
    payload?.fileName ? `Original File: ${payload.fileName}` : '',
    payload?.completedAt ? `Completed: ${new Date(payload.completedAt).toLocaleString()}` : '',
    '',
    formatSection('Executive Proposal Draft', proposalData.proposal || payload?.rfpSummary),
    formatSection('Outline', proposalData.outline),
    formatSection('Reviewer Notes', proposalData.review),
    proposalData.clientContext
      ? `## Client Context\n${JSON.stringify(proposalData.clientContext, null, 2)}\n`
      : '',
    proposalData.metadata
      ? `## Metadata\n${JSON.stringify(proposalData.metadata, null, 2)}\n`
      : '',
  ];

  const report = lines.filter(Boolean).join('\n');
  const base =
    sanitizeFilename((payload?.fileName || '').replace(/\.docx?$/i, '').trim()) ||
    `${sanitizeFilename(fallbackName)}-proposal`;
  downloadTextFile(`${base}-analysis.txt`, report);
};

export interface ArtifactDownloadRequest {
  artifactType: string;
  fileBaseName?: string | null;
  transcriptAnalysisId?: string | null;
  proposalJobId?: string | null;
  pptDownloadUrl?: string | null;
}

export const downloadArtifactFile = async ({
  artifactType,
  fileBaseName,
  transcriptAnalysisId,
  proposalJobId,
  pptDownloadUrl,
}: ArtifactDownloadRequest): Promise<string> => {
  const kind = (artifactType || '').toLowerCase();
  const safeBaseName = sanitizeFilename(fileBaseName || 'analysis');

  if (kind === 'transcript') {
    if (!transcriptAnalysisId) {
      throw new Error('Transcript analysis is not ready yet.');
    }
    const response = await apiGet(`/api/transcripts/${transcriptAnalysisId}`);
    const payload = response?.data ?? response;
    buildTranscriptAnalysisPrintout({
      ...payload,
      meetingTitle: payload?.meetingTitle || payload?.meeting_title || safeBaseName,
    });
    return 'Transcript analysis ready to print.';
  }

  if (kind === 'proposal') {
    if (!proposalJobId) {
      throw new Error('Proposal job is not ready yet.');
    }
    const response = await apiGet(`/api/proposal/jobs/${proposalJobId}`);
    const payload = response?.data ?? response;
    buildProposalAnalysisReport(payload, safeBaseName);
    return 'Proposal analysis downloaded.';
  }

  if (kind === 'ppt') {
    if (!pptDownloadUrl) {
      throw new Error('Presentation download is not ready yet.');
    }
    const newWindow = window.open(pptDownloadUrl, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      window.location.href = pptDownloadUrl;
    }
    return 'Presentation download started.';
  }

  throw new Error('Unsupported artifact type.');
};
