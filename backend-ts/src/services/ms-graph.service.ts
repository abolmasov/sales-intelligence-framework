import axios from 'axios';

/**
 * Microsoft Graph Service — OAuth 2.0 + common Graph API helpers.
 */

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface UserInfo {
  id: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  userPrincipalName: string;
  mail?: string;
  jobTitle?: string;
}

export class MSGraphService {
  private clientId: string;
  private clientSecret: string;
  private tenantId: string;
  private redirectUri: string;
  private scopes: string[];

  constructor() {
    this.clientId = process.env.MS_CLIENT_ID || '';
    this.clientSecret = process.env.MS_CLIENT_SECRET || '';
    this.tenantId = process.env.MS_TENANT_ID || 'common';
    this.redirectUri =
      process.env.MS_REDIRECT_URI || 'http://localhost:3001/auth/callback';
    this.scopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'User.Read',
      'Calendars.Read',
      'Mail.Send',
    ];
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      response_mode: 'query',
      scope: this.scopes.join(' '),
      prompt: 'select_account',
    });
    if (state) {
      params.set('state', state);
    }
    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  private getTokenEndpoint(): string {
    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
  }

  async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
    });
    const { data } = await axios.post<TokenResponse>(this.getTokenEndpoint(), params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data;
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: this.scopes.join(' '),
    });
    const { data } = await axios.post<TokenResponse>(this.getTokenEndpoint(), params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data;
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const { data } = await axios.get<UserInfo>('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data;
  }

  async getUserPhoto(accessToken: string): Promise<Buffer> {
    try {
      const { data } = await axios.get<ArrayBuffer>(
        'https://graph.microsoft.com/v1.0/me/photo/$value',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          responseType: 'arraybuffer',
        }
      );
      return Buffer.from(data);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        throw new Error('User photo not found');
      }
      throw error;
    }
  }

  async getCalendarEvents(
    accessToken: string,
    startDateTime: string,
    endDateTime: string,
    top = 50
  ): Promise<any[]> {
    const params = new URLSearchParams({
      startDateTime,
      endDateTime,
      $top: String(top),
      $orderby: 'start/dateTime',
    });
    const { data } = await axios.get(
      `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return data.value || [];
  }

  async getEventDetails(accessToken: string, eventId: string): Promise<any> {
    const { data } = await axios.get(
      `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return data;
  }

  async sendEmail(
    accessToken: string,
    to: string[],
    subject: string,
    body: string,
    isHtml = false
  ): Promise<boolean> {
    const message = {
      message: {
        subject,
        body: { contentType: isHtml ? 'HTML' : 'Text', content: body },
        toRecipients: to.map((address) => ({
          emailAddress: { address },
        })),
      },
      saveToSentItems: true,
    };
    await axios.post('https://graph.microsoft.com/v1.0/me/sendMail', message, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return true;
  }

  async sendEmailWithAttachments(
    accessToken: string,
    to: string[],
    subject: string,
    body: string,
    attachments: Array<{ name: string; contentType: string; contentBytes: string }>,
    isHtml = false
  ): Promise<boolean> {
    const message = {
      message: {
        subject,
        body: { contentType: isHtml ? 'HTML' : 'Text', content: body },
        toRecipients: to.map((address) => ({
          emailAddress: { address },
        })),
        attachments: attachments.map((att) => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: att.name,
          contentType: att.contentType,
          contentBytes: att.contentBytes,
        })),
      },
    };

    await axios.post('https://graph.microsoft.com/v1.0/me/sendMail', message, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return true;
  }

  async createCalendarEvent(
    accessToken: string,
    subject: string,
    startTime: Date,
    endTime: Date,
    attendees: string[],
    body?: string,
    location?: string,
    isTeamsMeeting = true
  ): Promise<any> {
    const event = {
      subject,
      body: { contentType: 'HTML', content: body || '' },
      start: { dateTime: startTime.toISOString(), timeZone: 'UTC' },
      end: { dateTime: endTime.toISOString(), timeZone: 'UTC' },
      location: location ? { displayName: location } : undefined,
      attendees: attendees.map((email) => ({
        emailAddress: { address: email },
        type: 'required',
      })),
      isOnlineMeeting: isTeamsMeeting,
      onlineMeetingProvider: isTeamsMeeting ? 'teamsForBusiness' : undefined,
    };

    const { data } = await axios.post(
      'https://graph.microsoft.com/v1.0/me/calendar/events',
      event,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return data;
  }

  parseMeetingForAnalysis(event: any): any {
    const companyName = this.extractCompanyName(event.subject || '');
    const attendees = (event.attendees || []).map((attendee: any) => ({
      name: attendee.emailAddress?.name || '',
      email: attendee.emailAddress?.address || '',
      role: 'Attendee',
    }));
    const startTime = event.start?.dateTime || '';
    const meetingDate = startTime.split('T')[0];

    return {
      meeting_id: event.id,
      meeting_title: event.subject || '',
      company_name: companyName,
      meeting_date: meetingDate,
      meeting_time: startTime,
      attendees,
      location: event.location?.displayName || '',
      is_online: event.isOnlineMeeting || false,
      online_meeting_url: event.onlineMeeting?.joinUrl || '',
      description: event.bodyPreview || '',
    };
  }

  async checkTranscript(_accessToken: string, _meetingId: string): Promise<boolean> {
    return false;
  }

  async getMeetingTranscripts(_accessToken: string, _meetingId: string): Promise<any[]> {
    return [];
  }

  async getTranscriptContent(
    _accessToken: string,
    _meetingId: string,
    _transcriptId: string
  ): Promise<string> {
    return '';
  }

  private extractCompanyName(subject: string): string {
    const subjectLower = subject.toLowerCase();
    if (subjectLower.includes('with')) {
      const parts = subject.split('with');
      if (parts.length > 1) {
        return parts[1].trim().split(/\s+/)[0];
      }
    }
    if (subject.includes(' - ')) {
      return subject.split(' - ')[0].trim();
    }
    return subject.split(/\s+/)[0] || 'Unknown Company';
  }
}

let msGraphService: MSGraphService | null = null;

export function getMSGraphService(): MSGraphService {
  if (!msGraphService) {
    msGraphService = new MSGraphService();
  }
  return msGraphService;
}
