/**
 * Phase 11 Week 2: Task 2.4 - Invitation Notification Service
 * Handles email and webhook notifications for team invitations
 */

import type { TenantInvitation } from './invite-service';

/**
 * Notification preferences for a tenant
 */
export interface NotificationPreferences {
  emailOnInviteSent: boolean;
  emailOnInviteAccepted: boolean;
  emailOnInviteRejected: boolean;
  slackWebhookUrl?: string;
  discordWebhookUrl?: string;
  sendReminders: boolean;
  reminderIntervalDays?: number;
}

/**
 * Email content for different notification types
 */
interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

/**
 * Invitation Notification Service
 * Manages all notifications related to team invitations
 */
export class InvitationNotifierService {
  /**
   * Send invitation email to invited user
   */
  async sendInvitationEmail(
    invitee: { email: string; name?: string },
    tenant: { id: string; name: string },
    invitationToken: string,
    invitedByUser: { email: string; name: string }
  ): Promise<void> {
    const template = this.getInvitationEmailTemplate(
      tenant,
      invitationToken,
      invitedByUser
    );

    try {
      await this.sendEmail(invitee.email, template);
      console.log(`✓ Invitation email sent to ${invitee.email}`);
    } catch (error) {
      console.error(`Failed to send invitation email to ${invitee.email}:`, error);
      throw new Error(`Failed to send invitation email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send acceptance confirmation email to inviter
   */
  async sendAcceptanceEmail(
    invitedUser: { email: string; name?: string },
    tenant: { id: string; name: string },
    inviter: { email: string; name: string }
  ): Promise<void> {
    const template = this.getAcceptanceEmailTemplate(invitedUser, tenant, inviter);

    try {
      await this.sendEmail(inviter.email, template);
      console.log(`✓ Acceptance notification sent to ${inviter.email}`);
    } catch (error) {
      console.error(`Failed to send acceptance notification:`, error);
      throw new Error(`Failed to send acceptance notification`);
    }
  }

  /**
   * Send rejection notification to inviter
   */
  async sendRejectionEmail(
    invitedUser: { email: string; name?: string },
    tenant: { id: string; name: string },
    inviter: { email: string; name: string }
  ): Promise<void> {
    const template = this.getRejectionEmailTemplate(invitedUser, tenant, inviter);

    try {
      await this.sendEmail(inviter.email, template);
      console.log(`✓ Rejection notification sent to ${inviter.email}`);
    } catch (error) {
      console.error(`Failed to send rejection notification:`, error);
      throw new Error(`Failed to send rejection notification`);
    }
  }

  /**
   * Send reminder email for pending invitation
   */
  async sendReminderEmail(
    invitee: { email: string; name?: string },
    tenant: { id: string; name: string },
    invitationToken: string,
    daysOld: number
  ): Promise<void> {
    const template = this.getReminderEmailTemplate(
      tenant,
      invitationToken,
      daysOld
    );

    try {
      await this.sendEmail(invitee.email, template);
      console.log(`✓ Reminder email sent to ${invitee.email}`);
    } catch (error) {
      console.error(`Failed to send reminder email:`, error);
      // Don't throw for reminders - they're less critical
    }
  }

  /**
   * Send Discord webhook notification for admin
   */
  async notifyDiscord(
    webhookUrl: string,
    event: 'invite_sent' | 'invite_accepted' | 'invite_rejected',
    data: {
      invitee?: string;
      inviter?: string;
      tenant: string;
      role?: string;
    }
  ): Promise<void> {
    const embed = this.getDiscordEmbed(event, data);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.statusText}`);
      }

      console.log(`✓ Discord notification sent for event: ${event}`);
    } catch (error) {
      console.error(`Failed to send Discord notification:`, error);
      throw new Error(`Discord notification failed`);
    }
  }

  /**
   * Build invitation email template
   */
  private getInvitationEmailTemplate(
    tenant: { id: string; name: string },
    token: string,
    inviter: { email: string; name: string }
  ): EmailTemplate {
    const acceptUrl = `${this.getAppUrl()}/accept?token=${token}`;

    return {
      subject: `You're invited to join ${tenant.name}`,
      htmlBody: `
        <h2>You're invited to join ${tenant.name}</h2>
        <p>${inviter.name} (${inviter.email}) has invited you to join their team.</p>
        <p>
          <a href="${acceptUrl}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Accept Invitation
          </a>
        </p>
        <p>This invitation expires in 6 hours.</p>
      `,
      textBody: `
You're invited to join ${tenant.name}

${inviter.name} (${inviter.email}) has invited you to join their team.

Accept invitation: ${acceptUrl}

This invitation expires in 6 hours.
      `,
    };
  }

  /**
   * Build acceptance confirmation email template
   */
  private getAcceptanceEmailTemplate(
    invitedUser: { email: string; name?: string },
    tenant: { id: string; name: string },
    inviter: { email: string; name: string }
  ): EmailTemplate {
    return {
      subject: `${invitedUser.name || invitedUser.email} accepted your invitation`,
      htmlBody: `
        <h2>Invitation Accepted</h2>
        <p>${invitedUser.name || invitedUser.email} has accepted your invitation to join ${tenant.name}.</p>
        <p>They can now access the team and view all shared data.</p>
      `,
      textBody: `
Invitation Accepted

${invitedUser.name || invitedUser.email} has accepted your invitation to join ${tenant.name}.

They can now access the team and view all shared data.
      `,
    };
  }

  /**
   * Build rejection email template
   */
  private getRejectionEmailTemplate(
    invitedUser: { email: string; name?: string },
    tenant: { id: string; name: string },
    inviter: { email: string; name: string }
  ): EmailTemplate {
    return {
      subject: `${invitedUser.name || invitedUser.email} declined your invitation`,
      htmlBody: `
        <h2>Invitation Declined</h2>
        <p>${invitedUser.name || invitedUser.email} has declined your invitation to join ${tenant.name}.</p>
      `,
      textBody: `
Invitation Declined

${invitedUser.name || invitedUser.email} has declined your invitation to join ${tenant.name}.
      `,
    };
  }

  /**
   * Build reminder email template
   */
  private getReminderEmailTemplate(
    tenant: { id: string; name: string },
    token: string,
    daysOld: number
  ): EmailTemplate {
    const acceptUrl = `${this.getAppUrl()}/accept?token=${token}`;

    return {
      subject: `Reminder: You're invited to join ${tenant.name}`,
      htmlBody: `
        <h2>Reminder: Join ${tenant.name}</h2>
        <p>You have a pending invitation to ${tenant.name} that will expire soon.</p>
        <p>You've had this invitation for ${daysOld} day(s).</p>
        <p>
          <a href="${acceptUrl}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Accept Invitation Now
          </a>
        </p>
        <p>This invitation expires in 6 hours - make sure to accept before it's too late!</p>
      `,
      textBody: `
Reminder: Join ${tenant.name}

You have a pending invitation to ${tenant.name} that will expire soon.

You've had this invitation for ${daysOld} day(s).

Accept invitation: ${acceptUrl}

This invitation expires in 6 hours - make sure to accept before it's too late!
      `,
    };
  }

  /**
   * Send email using configured provider
   * In real app, would integrate with SendGrid, AWS SES, or similar
   */
  private async sendEmail(to: string, template: EmailTemplate): Promise<void> {
    // Mock implementation - in production would call actual email service
    const emailPayload = {
      to,
      subject: template.subject,
      html: template.htmlBody,
      text: template.textBody,
      timestamp: new Date().toISOString(),
    };

    // Log email for audit purposes
    console.log('📧 Email prepared:', {
      to: emailPayload.to,
      subject: emailPayload.subject,
    });

    // In production, integrate with email service:
    // return await sendgridClient.send({
    //   to: emailPayload.to,
    //   from: process.env.SENDER_EMAIL,
    //   subject: emailPayload.subject,
    //   html: emailPayload.html,
    //   text: emailPayload.text,
    // });
  }

  /**
   * Get Discord embed for notification
   */
  private getDiscordEmbed(
    event: 'invite_sent' | 'invite_accepted' | 'invite_rejected',
    data: { invitee?: string; inviter?: string; tenant: string; role?: string }
  ): Record<string, any> {
    const embedsByEvent: Record<string, Record<string, any>> = {
      invite_sent: {
        title: 'Team Invitation Sent',
        description: `${data.inviter} invited ${data.invitee} to ${data.tenant}`,
        color: 0x00ff00,
        fields: [
          { name: 'Invitee', value: data.invitee || 'Unknown', inline: true },
          { name: 'Team', value: data.tenant, inline: true },
          { name: 'Role', value: data.role || 'member', inline: true },
        ],
      },
      invite_accepted: {
        title: 'Invitation Accepted',
        description: `${data.invitee} accepted the invitation to ${data.tenant}`,
        color: 0x00ff00,
        fields: [
          { name: 'Member', value: data.invitee || 'Unknown', inline: true },
          { name: 'Team', value: data.tenant, inline: true },
        ],
      },
      invite_rejected: {
        title: 'Invitation Rejected',
        description: `${data.invitee} rejected the invitation to ${data.tenant}`,
        color: 0xff0000,
        fields: [
          { name: 'Invitee', value: data.invitee || 'Unknown', inline: true },
          { name: 'Team', value: data.tenant, inline: true },
        ],
      },
    };

    return {
      ...embedsByEvent[event],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get application URL
   */
  private getAppUrl(): string {
    return process.env.VITE_APP_URL || 'http://localhost:5173';
  }
}

/**
 * Singleton instance
 */
let notifierInstance: InvitationNotifierService | null = null;

/**
 * Get or create notification service instance
 */
export function getInvitationNotifier(): InvitationNotifierService {
  if (!notifierInstance) {
    notifierInstance = new InvitationNotifierService();
  }
  return notifierInstance;
}
