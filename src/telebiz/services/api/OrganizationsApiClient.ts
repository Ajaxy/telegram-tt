import type {
  ApiResponse,
  CreateOrganizationData,
  CreateTeamData,
  InviteUserData,
  Organization,
  OrganizationInvitation,
  OrganizationMember,
  PaginatedResponse,
  Role,
  Team,
  TeamInvitation,
  TeamMember,
  UpdateMemberRoleData,
} from '../types';

import { BaseApiClient } from './BaseApiClient';

/**
 * Telebiz Organizations API Client
 * Handles all organization, team, and member management operations
 */
export class OrganizationsApiClient extends BaseApiClient {
  // Organization Management
  async getOrganizations(page = 1, limit = 20): Promise<Organization[]> {
    const response = await this.request<ApiResponse<PaginatedResponse<Organization>>>(
      `/organizations?page=${page}&limit=${limit}`,
    );

    if (response.status !== 'success' || !response.data.organizations) {
      throw new Error('Failed to fetch organizations');
    }

    return response.data.organizations;
  }

  async getOrganization(organizationId: number): Promise<Organization> {
    const response = await this.request<ApiResponse<Organization>>(
      `/organizations/${organizationId}`,
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch organization');
    }

    return response.data;
  }

  async createOrganization(data: CreateOrganizationData): Promise<Organization> {
    const response = await this.request<ApiResponse<{ organization: Organization }>>('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to create organization');
    }

    return response.data.organization;
  }

  async updateOrganization(
    organizationId: number,
    data: Partial<CreateOrganizationData>,
  ): Promise<Organization> {
    const response = await this.request<ApiResponse<{ organization: Organization }>>(
      `/organizations/${organizationId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to update organization');
    }

    return response.data.organization;
  }

  async deleteOrganization(organizationId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/organizations/${organizationId}`,
      {
        method: 'DELETE',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to delete organization');
    }
  }

  // Organization Members
  async getOrganizationMembers(
    organizationId: number,
    page = 1,
    limit = 20,
  ): Promise<OrganizationMember[]> {
    const response = await this.request<ApiResponse<PaginatedResponse<OrganizationMember>>>(
      `/organizations/${organizationId}/members?page=${page}&limit=${limit}`,
    );

    if (response.status !== 'success' || !response.data.members) {
      throw new Error('Failed to fetch organization members');
    }

    return response.data.members;
  }

  async updateOrganizationMemberRole(
    organizationId: number,
    userId: number,
    data: UpdateMemberRoleData,
  ): Promise<OrganizationMember> {
    const response = await this.request<ApiResponse<OrganizationMember>>(
      `/organizations/${organizationId}/members/${userId}/role`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to update member role');
    }

    return response.data;
  }

  async removeOrganizationMember(organizationId: number, userId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/organizations/${organizationId}/members/${userId}`,
      {
        method: 'DELETE',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to remove organization member');
    }
  }

  // Team Management
  async getTeams(organizationId?: number, page = 1, limit = 20): Promise<Team[]> {
    const endpoint = organizationId
      ? `/organizations/${organizationId}/teams?page=${page}&limit=${limit}`
      : `/teams?page=${page}&limit=${limit}`;

    const response = await this.request<ApiResponse<PaginatedResponse<Team>>>(endpoint);

    if (response.status !== 'success' || !response.data.teams) {
      throw new Error('Failed to fetch teams');
    }

    return response.data.teams;
  }

  async getTeam(teamId: number): Promise<Team> {
    const response = await this.request<ApiResponse<Team>>(`/teams/${teamId}`);

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch team');
    }

    return response.data;
  }

  async createTeam(data: CreateTeamData): Promise<Team> {
    const response = await this.request<ApiResponse<Team>>('/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to create team');
    }

    return response.data;
  }

  async updateTeam(teamId: number, data: Partial<CreateTeamData>): Promise<Team> {
    const response = await this.request<ApiResponse<Team>>(`/teams/${teamId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to update team');
    }

    return response.data;
  }

  async deleteTeam(teamId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(`/teams/${teamId}`, {
      method: 'DELETE',
    });

    if (response.status !== 'success') {
      throw new Error('Failed to delete team');
    }
  }

  // Team Members
  async getTeamMembers(teamId: number, page = 1, limit = 20): Promise<TeamMember[]> {
    const response = await this.request<ApiResponse<PaginatedResponse<TeamMember>>>(
      `/teams/${teamId}/members?page=${page}&limit=${limit}`,
    );

    if (response.status !== 'success' || !response.data.members) {
      throw new Error('Failed to fetch team members');
    }

    return response.data.members;
  }

  async updateTeamMemberRole(
    teamId: number,
    userId: number,
    data: UpdateMemberRoleData,
  ): Promise<TeamMember> {
    const response = await this.request<ApiResponse<TeamMember>>(
      `/teams/${teamId}/members/${userId}/role`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to update team member role');
    }

    return response.data;
  }

  async removeTeamMember(teamId: number, userId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/teams/${teamId}/members/${userId}`,
      {
        method: 'DELETE',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to remove team member');
    }
  }

  // Invitations
  async sendOrganizationInvitation(
    organizationId: number,
    data: InviteUserData,
  ): Promise<OrganizationInvitation> {
    const response = await this.request<ApiResponse<OrganizationInvitation>>(
      `/organizations/${organizationId}/invitations`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to send organization invitation');
    }

    return response.data;
  }

  async sendTeamInvitation(teamId: number, data: InviteUserData): Promise<TeamInvitation> {
    const response = await this.request<ApiResponse<TeamInvitation>>(
      `/teams/${teamId}/invitations`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to send team invitation');
    }

    return response.data;
  }

  async getMyInvitations(): Promise<OrganizationInvitation[]> {
    const response = await this.request<ApiResponse<{
      invitations: OrganizationInvitation[];
    }>>('/invitations');

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch invitations');
    }

    return response.data.invitations;
  }

  async acceptOrganizationInvitation(invitationId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/invitations/organizations/${invitationId}/accept`,
      {
        method: 'POST',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to accept organization invitation');
    }
  }

  async declineOrganizationInvitation(invitationId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/invitations/organization/${invitationId}/decline`,
      {
        method: 'POST',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to decline organization invitation');
    }
  }

  async acceptTeamInvitation(invitationId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/invitations/team/${invitationId}/accept`,
      {
        method: 'POST',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to accept team invitation');
    }
  }

  async declineTeamInvitation(invitationId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/invitations/team/${invitationId}/decline`,
      {
        method: 'POST',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to decline team invitation');
    }
  }

  // Roles
  async getOrganizationRoles(): Promise<Role[]> {
    const response = await this.request<ApiResponse<Role[]>>(`/roles?scope=organization`);

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch roles');
    }

    return response.data;
  }

  async getRolePermissions(roleId: number): Promise<string[]> {
    const response = await this.request<ApiResponse<string[]>>(`/roles/${roleId}/permissions`);

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch role permissions');
    }

    return response.data;
  }
}
