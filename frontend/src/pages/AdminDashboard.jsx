import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, PlusCircle, BarChart3, FolderKanban, Mail, Users, CalendarDays, MessageSquare, CheckCircle2, Bell, Shield, Download, Database } from 'lucide-react';
import { useLanguage } from '../components/LanguageContext';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://the-developers-guild-backend.onrender.com').replace(/\/$/, '');

const emptyEventForm = {
  name: '',
  date: '',
  registrationDeadline: '',
  time: '',
  description: '',
  category: '',
  location: '',
  capacity: 60,
};

const emptyProjectForm = {
  title: '',
  summary: '',
  techStack: '',
  githubUrl: '',
  demoUrl: '',
  status: 'In Progress',
};

const emptySubAdminForm = {
  name: '',
  email: '',
  password: '',
  role: 'sub_admin',
};

const emptyMemberForm = {
  name: '',
  email: '',
  designation: '',
  password: '',
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [events, setEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [adminTeam, setAdminTeam] = useState([]);
  const [memberDirectory, setMemberDirectory] = useState([]);
  const [users, setUsers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [backups, setBackups] = useState([]);
  const [contentSettings, setContentSettings] = useState({
    announcement: '',
    heroBadge: '',
    aboutTitle: "About The Developers' Guild",
    aboutIntro: '',
    aboutMission: '',
  });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [savingSubAdmin, setSavingSubAdmin] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [subAdminForm, setSubAdminForm] = useState(emptySubAdminForm);
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [activeSection, setActiveSection] = useState('events');

  const token = useMemo(() => localStorage.getItem('adminToken') || '', []);
  const adminSession = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('adminSession') || 'null');
    } catch {
      return null;
    }
  }, []);
  const isHighestAuthority = adminSession?.role === 'super_admin';
  const resolvedPermissions = useMemo(() => {
    if (!adminSession) return [];
    if (Array.isArray(adminSession.permissions) && adminSession.permissions.length > 0) return adminSession.permissions;
    if (adminSession.role === 'super_admin') return ['*'];
    if (adminSession.role === 'sub_admin') return ['events.*', 'projects.*', 'members.read', 'members.write', 'users.read', 'contacts.read', 'notifications.read', 'reports.read', 'content.read', 'content.write'];
    if (adminSession.role === 'member') return ['events.*', 'projects.*'];
    return ['contacts.read'];
  }, [adminSession]);

  const hasUiPermission = (permission) => {
    if (resolvedPermissions.includes('*')) return true;
    if (resolvedPermissions.includes(permission)) return true;
    const category = String(permission).split('.')[0];
    return resolvedPermissions.includes(`${category}.*`);
  };

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: 'success' }), 2800);
  };

  const authFetch = (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  };

  const handleSessionError = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminSession');
    navigate('/login');
  };

  const loadDashboardData = async () => {
    try {
      const safeLoad = async (url, fallbackValue) => {
        const res = await authFetch(url, { method: 'GET' });
        let data = fallbackValue;
        try {
          data = await res.json();
        } catch {
          data = fallbackValue;
        }

        if (res.status === 401) {
          throw new Error('Admin session expired or invalid. Please login again.');
        }

        if (res.status === 403) {
          return fallbackValue;
        }

        if (!res.ok) {
          throw new Error(data?.message || 'Failed to load dashboard data.');
        }

        return data;
      };

      const [eventsData, projectsData, analyticsData, contactsData, adminTeamData, membersData, usersData, registrationsData, auditData, notificationsData, backupsData, contentSettingsData] = await Promise.all([
        safeLoad(`${API_BASE_URL}/api/admin/events`, []),
        safeLoad(`${API_BASE_URL}/api/admin/projects`, []),
        safeLoad(`${API_BASE_URL}/api/admin/analytics`, { totals: {}, categoryCounts: {}, registrationSeries: [] }),
        safeLoad(`${API_BASE_URL}/api/admin/contact-submissions`, []),
        safeLoad(`${API_BASE_URL}/api/admin/admin-users`, []),
        safeLoad(`${API_BASE_URL}/api/admin/members`, []),
        safeLoad(`${API_BASE_URL}/api/admin/users`, []),
        safeLoad(`${API_BASE_URL}/api/admin/registrations`, []),
        safeLoad(`${API_BASE_URL}/api/admin/audit-logs?limit=80`, []),
        safeLoad(`${API_BASE_URL}/api/admin/notifications`, []),
        safeLoad(`${API_BASE_URL}/api/admin/backups`, []),
        safeLoad(`${API_BASE_URL}/api/admin/content-settings`, {
          announcement: '',
          heroBadge: '',
          aboutTitle: "About The Developers' Guild",
          aboutIntro: '',
          aboutMission: '',
        }),
      ]);

      setEvents(eventsData);
      setProjects(projectsData);
      setContacts(Array.isArray(contactsData) ? contactsData : []);
      setAdminTeam(Array.isArray(adminTeamData) ? adminTeamData : []);
      setMemberDirectory(Array.isArray(membersData) ? membersData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setRegistrations(Array.isArray(registrationsData) ? registrationsData : []);
      setAuditLogs(Array.isArray(auditData) ? auditData : []);
      setNotifications(Array.isArray(notificationsData) ? notificationsData : []);
      setBackups(Array.isArray(backupsData) ? backupsData : []);
      setContentSettings({
        announcement: contentSettingsData?.announcement || '',
        heroBadge: contentSettingsData?.heroBadge || '',
        aboutTitle: contentSettingsData?.aboutTitle || "About The Developers' Guild",
        aboutIntro: contentSettingsData?.aboutIntro || '',
        aboutMission: contentSettingsData?.aboutMission || '',
      });
      setAnalytics(analyticsData);
    } catch (err) {
      if (String(err.message).toLowerCase().includes('session') || String(err.message).toLowerCase().includes('token')) {
        handleSessionError();
        return;
      }
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadDashboardData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) return undefined;

    const intervalId = setInterval(async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/admin/me`, { method: 'GET' });
        if (res.status === 401) {
          handleSessionError();
        }
      } catch {
        // Ignore transient network errors; regular requests handle failures.
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetEventForm = () => {
    setEventForm(emptyEventForm);
    setEditingEventId(null);
  };

  const resetProjectForm = () => {
    setProjectForm(emptyProjectForm);
    setEditingProjectId(null);
  };

  const handleEventChange = (e) => {
    setEventForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleProjectChange = (e) => {
    setProjectForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const startEventEdit = (event) => {
    setEditingEventId(event.id);
    setEventForm({
      name: event.name || '',
      date: event.date || '',
      registrationDeadline: event.registrationDeadline || '',
      time: event.time || '',
      description: event.description || '',
      category: event.category || '',
      location: event.location || '',
      capacity: event.capacity || 60,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startProjectEdit = (project) => {
    setEditingProjectId(project.id);
    setProjectForm({
      title: project.title || '',
      summary: project.summary || '',
      techStack: project.techStack || '',
      githubUrl: project.githubUrl || '',
      demoUrl: project.demoUrl || '',
      status: project.status || 'In Progress',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Only super_admin or sub_admin can submit events
  const submitEvent = async (e) => {
    if (!isHighestAuthority && !['sub_admin', 'member'].includes(adminSession?.role)) {
      showToast('Insufficient permissions.', 'error');
      return;
    }
    e.preventDefault();
    setSavingEvent(true);

    try {
      const isEditing = Boolean(editingEventId);
      const endpoint = isEditing
        ? `${API_BASE_URL}/api/admin/events/${editingEventId}`
        : `${API_BASE_URL}/api/admin/events`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await authFetch(endpoint, {
        method,
        body: JSON.stringify({ ...eventForm, capacity: Number(eventForm.capacity) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to save event.');

      showToast(isEditing ? 'Event updated successfully.' : 'Event created successfully.');
      resetEventForm();
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingEvent(false);
    }
  };

  const submitProject = async (e) => {
    e.preventDefault();
    setSavingProject(true);

    try {
      const isEditing = Boolean(editingProjectId);
      const endpoint = isEditing
        ? `${API_BASE_URL}/api/admin/projects/${editingProjectId}`
        : `${API_BASE_URL}/api/admin/projects`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await authFetch(endpoint, {
        method,
        body: JSON.stringify(projectForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to save project.');

      showToast(isEditing ? 'Project updated successfully.' : 'Project created successfully.');
      resetProjectForm();
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingProject(false);
    }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event? This will remove related registrations too.')) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/events/${eventId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to delete event.');
      showToast('Event deleted.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteProject = async (projectId) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/projects/${projectId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to delete project.');
      showToast('Project deleted.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const markContactRead = async (contactId) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/contact-submissions/${contactId}/read`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not mark as read.');
      showToast('Marked as read.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteContact = async (contactId) => {
    if (!window.confirm('Delete this contact submission?')) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/contact-submissions/${contactId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not delete submission.');
      showToast('Submission deleted.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const updateUserStatus = async (userId, status) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to update user status.');
      showToast(data.message || 'User status updated.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const updateUserVerification = async (userId, isVerified) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/users/${userId}/verification`, {
        method: 'PUT',
        body: JSON.stringify({ isVerified }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to update verification status.');
      showToast(data.message || 'Verification updated.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const updateRegistrationStatus = async (userId, eventId, status) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/registrations/${userId}/${eventId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to update registration status.');
      showToast(data.message || 'Registration updated.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const updateContactStatus = async (contactId, status) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/contact-submissions/${contactId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not update contact status.');
      showToast('Contact updated.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const markNotificationRead = async (notificationId) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/notifications/${notificationId}/read`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to mark notification as read.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const downloadReport = async (type) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/reports/export?type=${encodeURIComponent(type)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Unable to export report.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast(`${type} report downloaded.`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const createBackup = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/backups`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to create backup.');
      showToast('Backup created successfully.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const restoreBackup = async (backupName) => {
    if (!window.confirm(`Restore backup ${backupName}? This will replace current database data.`)) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/backups/${encodeURIComponent(backupName)}/restore`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to restore backup.');
      showToast('Backup restored successfully.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const saveContentSettings = async () => {
    setSavingContent(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/content-settings`, {
        method: 'PUT',
        body: JSON.stringify(contentSettings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to save content settings.');
      showToast('Content settings saved.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingContent(false);
    }
  };

  // Only super_admin can create sub-admins
  const createSubAdmin = async (e) => {
    if (!isHighestAuthority) {
      showToast('Only super admin can add sub-admins.', 'error');
      return;
    }
    e.preventDefault();
    setSavingSubAdmin(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/admin-users`, {
        method: 'POST',
        body: JSON.stringify(subAdminForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to create sub-admin.');
      showToast(data.message || 'Sub-admin created successfully.');
      setSubAdminForm(emptySubAdminForm);
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingSubAdmin(false);
    }
  };

  const updateAdminAccount = async (adminId, payload) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/admin-users/${adminId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to update admin account.');
      showToast(data.message || 'Admin account updated.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const removeAdminAccount = async (adminId) => {
    if (!window.confirm('Remove this admin account?')) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/admin-users/${adminId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to remove admin account.');
      showToast(data.message || 'Admin account removed.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const resetSubAdminPassword = async (adminId) => {
    const newPassword = window.prompt('Enter new password for this sub-admin (minimum 8 characters):');
    if (!newPassword) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/admin-users/${adminId}/reset-password`, {
        method: 'PUT',
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to reset sub-admin password.');
      showToast(data.message || 'Password reset successfully.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Only super_admin can add members
  const addMember = async (e) => {
    if (!isHighestAuthority) {
      showToast('Only super admin can add members.', 'error');
      return;
    }
    e.preventDefault();
    setSavingMember(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/members`, {
        method: 'POST',
        body: JSON.stringify(memberForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to add member.');
      showToast(data.message || 'Member added successfully.');
      setMemberForm(emptyMemberForm);
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingMember(false);
    }
  };

  // Only super_admin can remove members
  const removeMember = async (memberId) => {
    if (!isHighestAuthority) {
      showToast('Only super admin can remove members.', 'error');
      return;
    }
    if (!window.confirm('Remove this member?')) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/members/${memberId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to remove member.');
      showToast(data.message || 'Member removed.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const bulkUserAction = async (action) => {
    if (selectedUserIds.length === 0) {
      showToast('Select at least one user.', 'error');
      return;
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/users/bulk-action`, {
        method: 'POST',
        body: JSON.stringify({ userIds: selectedUserIds, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to apply bulk action.');
      showToast(data.message || 'Bulk action applied.');
      setSelectedUserIds([]);
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const categoryRows = Object.entries(analytics?.categoryCounts || {});
  const maxCategoryCount = categoryRows.length ? Math.max(...categoryRows.map(([, count]) => count)) : 1;
  const totals = analytics?.totals || {};
  const searchLower = globalSearch.trim().toLowerCase();
  const matchSearch = (...values) => {
    if (!searchLower) return true;
    return values.some((v) => String(v ?? '').toLowerCase().includes(searchLower));
  };

  const filteredAdminTeam = adminTeam.filter(a => matchSearch(a.name, a.email, a.role));
  const filteredMembers = memberDirectory.filter(m => matchSearch(m.name, m.email, m.designation));
  const filteredEvents = events.filter(e => matchSearch(e.name, e.category, e.location, e.description));
  const filteredContacts = contacts.filter(c => matchSearch(c.name, c.email, c.message, c.status));
  const filteredUsers = users.filter(u => matchSearch(u.name, u.email, u.collegeId, u.status));
  const filteredRegistrations = registrations.filter(r => matchSearch(r.userName, r.userEmail, r.eventName, r.status));
  const filteredProjects = projects.filter(p => matchSearch(p.title, p.summary, p.techStack, p.status));
  const filteredAuditLogs = auditLogs.filter(l => matchSearch(l.action, l.adminEmail, l.adminRole));
  const filteredNotifications = notifications.filter(n => matchSearch(n.title, n.message, n.type));

  const registrationSeries = analytics?.registrationSeries || [];
  const maxRegistrationValue = registrationSeries.length ? Math.max(...registrationSeries.map(item => item.value), 1) : 1;
  const aiInsights = useMemo(() => {
    const unreadContacts = contacts.filter(c => !c.isRead).length;
    const pendingRegistrations = registrations.filter(r => r.status === 'pending').length;
    const rejectedRegistrations = registrations.filter(r => r.status === 'rejected').length;
    const lowCapacityEvents = events.filter(e => {
      const capacity = Number(e.capacity || 0);
      if (!capacity) return false;
      const confirmed = registrations.filter(r => r.eventId === e.id && r.status === 'confirmed').length;
      return confirmed / capacity < 0.3;
    }).slice(0, 3);

    const summary = language === 'hi'
      ? `कुल ${events.length} इवेंट्स, ${registrations.length} रजिस्ट्रेशन और ${contacts.length} कॉन्टैक्ट संदेश हैं।`
      : `You currently have ${events.length} events, ${registrations.length} registrations, and ${contacts.length} contact submissions.`;

    const issues = [];
    if (unreadContacts > 0) {
      issues.push(language === 'hi'
        ? `${unreadContacts} अनरीड कॉन्टैक्ट संदेश पेंडिंग हैं।`
        : `${unreadContacts} contact messages are still unread.`);
    }
    if (pendingRegistrations > 6) {
      issues.push(language === 'hi'
        ? `${pendingRegistrations} रजिस्ट्रेशन अभी भी पेंडिंग हैं।`
        : `${pendingRegistrations} registrations are pending approval.`);
    }
    if (rejectedRegistrations > 4) {
      issues.push(language === 'hi'
        ? `${rejectedRegistrations} रिजेक्टेड रजिस्ट्रेशन पाए गए हैं, कारण जांचें।`
        : `${rejectedRegistrations} registrations were rejected recently; review reasons.`);
    }
    if (lowCapacityEvents.length > 0) {
      const names = lowCapacityEvents.map(e => e.name).join(', ');
      issues.push(language === 'hi'
        ? `इन इवेंट्स की भागीदारी कम है: ${names}.`
        : `Low participation detected in: ${names}.`);
    }

    const actions = [
      language === 'hi'
        ? 'अनरीड संदेशों को आज ही ट्रायेज करें और स्टेटस अपडेट करें।'
        : 'Triage unread messages and update their status today.',
      language === 'hi'
        ? 'पेंडिंग रजिस्ट्रेशन को बैच में approve/reject करें।'
        : 'Process pending registrations in batch approvals.',
      language === 'hi'
        ? 'कम भागीदारी वाले इवेंट्स के लिए targeted announcement भेजें।'
        : 'Run targeted announcements for low-participation events.',
    ];

    return {
      summary,
      issues: issues.length ? issues : [language === 'hi' ? 'फिलहाल कोई महत्वपूर्ण जोखिम नहीं मिला।' : 'No major operational risk detected right now.'],
      actions,
    };
  }, [contacts, events, registrations, language]);

  const sectionTabs = [
    hasUiPermission('members.read') ? { key: 'members', label: `Members (${memberDirectory.length})` } : null,
    hasUiPermission('events.read') ? { key: 'events', label: `Events (${events.length})` } : null,
    hasUiPermission('contacts.read') ? { key: 'contacts', label: `Contacts (${contacts.length})` } : null,
    hasUiPermission('projects.read') ? { key: 'projects', label: `Projects (${projects.length})` } : null,
    hasUiPermission('users.read') ? { key: 'users', label: `Users (${users.length})` } : null,
    hasUiPermission('registrations.read') || hasUiPermission('events.read') ? { key: 'registrations', label: `Registrations (${registrations.length})` } : null,
    hasUiPermission('reports.read') ? { key: 'audit', label: `Audit (${auditLogs.length})` } : null,
    hasUiPermission('reports.read') ? { key: 'ops', label: 'Ops Center' } : null,
  ].filter(Boolean);
  const activeTabIndex = Math.max(0, sectionTabs.findIndex(tab => tab.key === activeSection));
  const hasSectionTabs = sectionTabs.length > 0;
  const sectionMotionStyle = {
    animation: 'fadeInUp 0.28s ease',
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--bg-color)', padding: '2.5rem 1.2rem' }}>
      {toast.visible && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 999,
          padding: '12px 24px', borderRadius: '99px',
          background: toast.type === 'success' ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)',
          color: 'white', fontWeight: 600, fontSize: '0.9rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)',
        }}>
          {toast.message}
        </div>
      )}

      <div style={{ maxWidth: '1150px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontFamily: 'Outfit, sans-serif', fontWeight: 900, color: 'var(--text-color)', marginBottom: '0.4rem' }}>
            {isHighestAuthority ? 'Welcome ' : ''}Admin <span className="text-gradient">{isHighestAuthority ? 'Super Admin' : 'Control Panel'}</span>
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {isHighestAuthority 
              ? 'Complete authority over events, projects, sub-admins and members.' 
              : 'Manage events, projects, and analytics from your dashboard.'}
          </p>
          <div style={{ marginTop: '0.7rem', display: 'flex', gap: '1.2rem' }}>
            <a href="/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}>Frontend Website</a>
            <a href={API_BASE_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a', fontWeight: 600, textDecoration: 'underline' }}>Backend API</a>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>
        ) : (
          <>
            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', border: '1px solid rgba(16,185,129,0.3)' }}>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-color)', marginBottom: '0.7rem' }}>
                {t('aiAssistant')}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.75rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.35rem' }}>{t('aiSummary')}</p>
                  <p style={{ color: 'var(--text-color)', fontSize: '0.9rem', lineHeight: 1.5 }}>{aiInsights.summary}</p>
                </div>
                <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.75rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.35rem' }}>{t('aiIssues')}</p>
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    {aiInsights.issues.map((issue, idx) => (
                      <p key={idx} style={{ color: 'var(--text-color)', fontSize: '0.86rem', lineHeight: 1.45 }}>
                        {idx + 1}. {issue}
                      </p>
                    ))}
                  </div>
                </div>
                <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.75rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.35rem' }}>{t('aiActions')}</p>
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    {aiInsights.actions.map((action, idx) => (
                      <p key={idx} style={{ color: 'var(--text-color)', fontSize: '0.86rem', lineHeight: 1.45 }}>
                        {idx + 1}. {action}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.3rem', border: '1px solid rgba(59,130,246,0.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.2rem', color: 'var(--text-color)' }}>
                  <BarChart3 size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                  Analytics Overview
                </h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', border: '1px solid var(--card-border)', padding: '5px 10px', borderRadius: '99px' }}>
                  Live Snapshot
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.9rem', marginBottom: '1.1rem' }}>
                {[
                  { label: 'Total Users', value: totals.totalUsers || 0, icon: <Users size={16} />, tone: 'linear-gradient(135deg, rgba(37,99,235,0.23), rgba(59,130,246,0.08))' },
                  { label: 'Events', value: totals.totalEvents || 0, icon: <CalendarDays size={16} />, tone: 'linear-gradient(135deg, rgba(16,185,129,0.23), rgba(16,185,129,0.08))' },
                  { label: 'Projects', value: totals.totalProjects || 0, icon: <FolderKanban size={16} />, tone: 'linear-gradient(135deg, rgba(168,85,247,0.23), rgba(168,85,247,0.08))' },
                  { label: 'Contact Messages', value: totals.totalContactSubmissions || 0, icon: <MessageSquare size={16} />, tone: 'linear-gradient(135deg, rgba(244,114,182,0.23), rgba(244,114,182,0.08))' },
                  { label: 'Unread Messages', value: totals.unreadContactSubmissions || 0, icon: <Mail size={16} />, tone: 'linear-gradient(135deg, rgba(245,158,11,0.23), rgba(245,158,11,0.08))' },
                  { label: 'Confirmed Registrations', value: totals.confirmedRegistrations || 0, icon: <CheckCircle2 size={16} />, tone: 'linear-gradient(135deg, rgba(20,184,166,0.23), rgba(20,184,166,0.08))' },
                  { label: 'Admin Accounts', value: totals.totalAdminAccounts || 0, icon: <Shield size={16} />, tone: 'linear-gradient(135deg, rgba(99,102,241,0.23), rgba(59,130,246,0.08))' },
                  { label: 'Member Directory', value: totals.totalMembers || 0, icon: <Users size={16} />, tone: 'linear-gradient(135deg, rgba(34,197,94,0.23), rgba(20,184,166,0.08))' },
                ].map(card => (
                  <div key={card.label} style={{ padding: '0.95rem', borderRadius: '12px', border: '1px solid var(--card-border)', background: card.tone }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{card.label}</span>
                      <span style={{ color: 'var(--text-color)' }}>{card.icon}</span>
                    </div>
                    <div style={{ color: 'var(--text-color)', fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.35rem' }}>{card.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1rem' }}>
                <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.95rem', background: 'rgba(2,6,23,0.2)' }}>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-color)', fontWeight: 700 }}>Event Categories</h3>
                  {categoryRows.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No category data</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.55rem' }}>
                      {categoryRows.map(([name, count], idx) => {
                        const gradientList = ['#3b82f6,#6366f1', '#14b8a6,#22c55e', '#f59e0b,#ef4444', '#8b5cf6,#ec4899', '#06b6d4,#3b82f6'];
                        const gradient = gradientList[idx % gradientList.length];
                        const percent = Math.max(8, (count / maxCategoryCount) * 100);
                        return (
                          <div key={name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.22rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{name}</span>
                              <span style={{ color: 'var(--text-color)', fontWeight: 700 }}>{count}</span>
                            </div>
                            <div style={{ height: '9px', background: 'rgba(148,163,184,0.2)', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ width: `${percent}%`, height: '100%', background: `linear-gradient(90deg, ${gradient})`, borderRadius: '999px' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.95rem', background: 'rgba(2,6,23,0.2)' }}>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-color)', fontWeight: 700 }}>Registrations Trend (6 months)</h3>
                  {registrationSeries.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No trend data</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.55rem' }}>
                      {registrationSeries.map((row) => (
                        <div key={row.month}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.22rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{row.month}</span>
                            <span style={{ color: 'var(--text-color)', fontWeight: 700 }}>{row.value}</span>
                          </div>
                          <div style={{ height: '9px', background: 'rgba(148,163,184,0.2)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(8, (row.value / maxRegistrationValue) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #14b8a6, #3b82f6)', borderRadius: '999px' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', marginBottom: '1rem', border: '1px solid rgba(59,130,246,0.18)' }}>
              {!hasSectionTabs ? (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>No dashboard sections are available for your role permissions.</p>
              ) : (
              <div style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: `repeat(${sectionTabs.length}, minmax(0, 1fr))`,
                gap: '0.5rem',
                paddingBottom: '0.45rem',
              }}>
                {sectionTabs.map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveSection(tab.key)}
                    className="btn-outline"
                    style={{
                      background: activeSection === tab.key ? 'rgba(59,130,246,0.16)' : 'transparent',
                      borderColor: activeSection === tab.key ? 'rgba(59,130,246,0.45)' : 'var(--card-border)',
                      color: activeSection === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: activeSection === tab.key ? 700 : 600,
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: `calc(${activeTabIndex} * (100% / ${sectionTabs.length}) + 0.35rem)`,
                    bottom: '0px',
                    width: `calc((100% / ${sectionTabs.length}) - 0.7rem)`,
                    height: '3px',
                    borderRadius: '999px',
                    background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                    transition: 'left 0.28s cubic-bezier(0.16, 1, 0.3, 1), width 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>
              )}
            </div>

            <div className="glass-panel" style={{ padding: '0.95rem', marginBottom: '1rem', border: '1px solid rgba(59,130,246,0.18)' }}>
              <div style={{ marginBottom: '0.7rem' }}>
                <input
                  className="form-input"
                  placeholder="Global search (users, members, events, contacts...)"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
                {isHighestAuthority && (
                  <button type="button" className="btn-primary" onClick={() => setActiveSection('members')}>
                    <Users size={14} style={{ marginRight: '6px' }} /> Open Members Panel
                  </button>
                )}
                <button type="button" className="btn-outline" onClick={() => downloadReport('users')}>
                  <Download size={14} style={{ marginRight: '6px' }} /> Users CSV
                </button>
                <button type="button" className="btn-outline" onClick={() => downloadReport('events')}>
                  <Download size={14} style={{ marginRight: '6px' }} /> Events CSV
                </button>
                <button type="button" className="btn-outline" onClick={() => downloadReport('registrations')}>
                  <Download size={14} style={{ marginRight: '6px' }} /> Registrations CSV
                </button>
                <button type="button" className="btn-outline" onClick={() => downloadReport('contacts')}>
                  <Download size={14} style={{ marginRight: '6px' }} /> Contacts CSV
                </button>
                <button type="button" className="btn-outline" onClick={() => downloadReport('audit')}>
                  <Download size={14} style={{ marginRight: '6px' }} /> Audit CSV
                </button>
                <button type="button" className="btn-outline" onClick={createBackup}>
                  <Database size={14} style={{ marginRight: '6px' }} /> Create Backup
                </button>
              </div>

              {notifications.length > 0 && (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {notifications.slice(0, 3).map((item) => (
                    <div key={item.id} style={{ border: '1px solid var(--card-border)', borderRadius: '10px', padding: '0.6rem 0.75rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-color)', fontSize: '0.86rem' }}>{item.title}</p>
                        <p style={{ margin: '0.22rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.message}</p>
                      </div>
                      {!item.read && (
                        <button className="btn-outline" style={{ padding: '6px 9px' }} onClick={() => markNotificationRead(item.id)}>Mark Read</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeSection === 'members' && (
              <div className="glass-panel" style={{ ...sectionMotionStyle, padding: '1.2rem', marginBottom: '1rem' }}>
                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.9rem', color: 'var(--text-color)' }}>
                  <Shield size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Admin Team & Members
                </h2>

                {!isHighestAuthority && (
                  <p style={{ color: '#f59e0b', marginBottom: '0.9rem', fontSize: '0.86rem' }}>
                    Only highest authority admin can add or remove sub-admins and members.
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.9rem', marginBottom: '1rem' }}>
                  <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.9rem' }}>
                    <h3 style={{ margin: '0 0 0.55rem', color: 'var(--text-color)', fontSize: '0.95rem' }}>Add Sub-admin</h3>
                    <form onSubmit={createSubAdmin} style={{ display: 'grid', gap: '0.55rem' }}>
                      <input
                        className="form-input"
                        placeholder="Full name"
                        value={subAdminForm.name}
                        onChange={(e) => setSubAdminForm(prev => ({ ...prev, name: e.target.value }))}
                        required
                        disabled={!isHighestAuthority || savingSubAdmin}
                      />
                      <input
                        className="form-input"
                        placeholder="Email"
                        type="email"
                        value={subAdminForm.email}
                        onChange={(e) => setSubAdminForm(prev => ({ ...prev, email: e.target.value }))}
                        required
                        disabled={!isHighestAuthority || savingSubAdmin}
                      />
                      <input
                        className="form-input"
                        placeholder="Temporary password"
                        type="password"
                        value={subAdminForm.password}
                        onChange={(e) => setSubAdminForm(prev => ({ ...prev, password: e.target.value }))}
                        required
                        disabled={!isHighestAuthority || savingSubAdmin}
                      />
                      <select
                        className="form-input"
                        value={subAdminForm.role}
                        onChange={(e) => setSubAdminForm(prev => ({ ...prev, role: e.target.value }))}
                        disabled={!isHighestAuthority || savingSubAdmin}
                      >
                        <option value="sub_admin">sub_admin</option>
                        <option value="event_manager">event_manager</option>
                        <option value="content_manager">content_manager</option>
                        <option value="support_admin">support_admin</option>
                      </select>
                      <button className="btn-primary" type="submit" disabled={!isHighestAuthority || savingSubAdmin}>
                        {savingSubAdmin ? 'Creating...' : 'Create Sub-admin'}
                      </button>
                    </form>
                  </div>

                  <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.9rem' }}>
                    <h3 style={{ margin: '0 0 0.55rem', color: 'var(--text-color)', fontSize: '0.95rem' }}>Add Member</h3>
                    <form onSubmit={addMember} style={{ display: 'grid', gap: '0.55rem' }}>
                      <input
                        className="form-input"
                        placeholder="Member name"
                        value={memberForm.name}
                        onChange={(e) => setMemberForm(prev => ({ ...prev, name: e.target.value }))}
                        required
                        disabled={!isHighestAuthority || savingMember}
                      />
                      <input
                        className="form-input"
                        placeholder="Member email"
                        type="email"
                        value={memberForm.email}
                        onChange={(e) => setMemberForm(prev => ({ ...prev, email: e.target.value }))}
                        required
                        disabled={!isHighestAuthority || savingMember}
                      />
                      <input
                        className="form-input"
                        placeholder="Designation"
                        value={memberForm.designation}
                        onChange={(e) => setMemberForm(prev => ({ ...prev, designation: e.target.value }))}
                        required
                        disabled={!isHighestAuthority || savingMember}
                      />
                      <input
                        className="form-input"
                        type="password"
                        minLength={8}
                        placeholder="Temporary password"
                        value={memberForm.password}
                        onChange={(e) => setMemberForm(prev => ({ ...prev, password: e.target.value }))}
                        required
                        disabled={!isHighestAuthority || savingMember}
                      />
                      <button className="btn-primary" type="submit" disabled={!isHighestAuthority || savingMember}>
                        {savingMember ? 'Adding...' : 'Add Member'}
                      </button>
                    </form>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.9rem' }}>
                  <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.9rem' }}>
                    <h3 style={{ margin: '0 0 0.55rem', color: 'var(--text-color)', fontSize: '0.95rem' }}>Admin Accounts</h3>
                    {filteredAdminTeam.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No admin accounts found.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.55rem' }}>
                        {filteredAdminTeam.map((admin) => (
                          <div key={admin.id} style={{ border: '1px solid var(--card-border)', borderRadius: '10px', padding: '0.55rem' }}>
                            <p style={{ margin: 0, color: 'var(--text-color)', fontWeight: 700, fontSize: '0.84rem' }}>
                              {admin.name} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({admin.email})</span>
                            </p>
                            <p style={{ margin: '0.2rem 0 0.45rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              Role: {admin.role} • Status: {admin.isActive ? 'active' : 'inactive'} {admin.managedByEnv ? '• Primary Admin' : ''}
                            </p>
                            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                              {!admin.managedByEnv && (
                                <button
                                  className="btn-outline"
                                  style={{ padding: '5px 8px' }}
                                  disabled={!isHighestAuthority}
                                  onClick={() => resetSubAdminPassword(admin.id)}
                                >
                                  Reset Password
                                </button>
                              )}
                              {!admin.managedByEnv && (
                                <button
                                  className="btn-outline"
                                  style={{ padding: '5px 8px' }}
                                  disabled={!isHighestAuthority}
                                  onClick={() => updateAdminAccount(admin.id, { isActive: !admin.isActive })}
                                >
                                  {admin.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                              )}
                              {!admin.managedByEnv && (
                                <button
                                  className="btn-outline"
                                  style={{ padding: '5px 8px', borderColor: '#ef4444', color: '#ef4444' }}
                                  disabled={!isHighestAuthority}
                                  onClick={() => removeAdminAccount(admin.id)}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.9rem' }}>
                    <h3 style={{ margin: '0 0 0.55rem', color: 'var(--text-color)', fontSize: '0.95rem' }}>Member Directory</h3>
                    {filteredMembers.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No members added yet.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.55rem' }}>
                        {filteredMembers.map((member) => (
                          <div key={member.id} style={{ border: '1px solid var(--card-border)', borderRadius: '10px', padding: '0.55rem' }}>
                            <p style={{ margin: 0, color: 'var(--text-color)', fontWeight: 700, fontSize: '0.84rem' }}>{member.name}</p>
                            <p style={{ margin: '0.2rem 0 0.45rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              {member.email} • {member.designation}
                            </p>
                            <button
                              className="btn-outline"
                              style={{ padding: '5px 8px', borderColor: '#ef4444', color: '#ef4444' }}
                              disabled={!isHighestAuthority}
                              onClick={() => removeMember(member.id)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'events' && (
              <div key="events" style={sectionMotionStyle}>

            <div className="glass-panel" style={{ padding: '1.4rem', marginBottom: '1.6rem' }}>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-color)' }}>
                {editingEventId ? 'Edit Event' : 'Create New Event'}
              </h2>

              <form onSubmit={submitEvent} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
                <input className="form-input" name="name" placeholder="Event name" value={eventForm.name} onChange={handleEventChange} required />
                <input className="form-input" name="date" type="date" value={eventForm.date} onChange={handleEventChange} required />
                <input className="form-input" name="registrationDeadline" type="date" value={eventForm.registrationDeadline} onChange={handleEventChange} required />
                <input className="form-input" name="time" placeholder="2:00 PM" value={eventForm.time} onChange={handleEventChange} required />
                <input className="form-input" name="category" placeholder="Workshop / Hackathon" value={eventForm.category} onChange={handleEventChange} required />
                <input className="form-input" name="location" placeholder="Lab-2, AIMT" value={eventForm.location} onChange={handleEventChange} required />
                <input className="form-input" name="capacity" type="number" min="1" placeholder="Capacity" value={eventForm.capacity} onChange={handleEventChange} required />
                <input className="form-input" name="description" placeholder="Short description" value={eventForm.description} onChange={handleEventChange} required style={{ gridColumn: '1 / -1' }} />

                <div style={{ display: 'flex', gap: '0.8rem', gridColumn: '1 / -1' }}>
                  <button type="submit" className="btn-primary" disabled={savingEvent}>
                    <PlusCircle size={16} style={{ marginRight: '6px' }} />
                    {savingEvent ? 'Saving...' : editingEventId ? 'Update Event' : 'Create Event'}
                  </button>
                  {editingEventId && (
                    <button type="button" className="btn-outline" onClick={resetEventForm}>Cancel Edit</button>
                  )}
                </div>
              </form>
            </div>

            <div className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1.6rem' }}>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.9rem', color: 'var(--text-color)' }}>
                Existing Events
              </h2>

              {filteredEvents.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No events yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.8rem' }}>
                  {filteredEvents.map(event => (
                    <div key={event.id} style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.07rem', fontWeight: 800, color: 'var(--text-color)' }}>{event.name}</h3>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.3rem' }}>{event.date} | {event.time} | {event.location}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.15rem' }}>Capacity: {event.confirmedCount}/{event.capacity} · Waitlist: {event.waitlistCount}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.5rem' }}>{event.description}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn-outline" onClick={() => startEventEdit(event)} style={{ padding: '8px 12px' }}>
                            <Pencil size={14} style={{ marginRight: '4px' }} /> Edit
                          </button>
                          <button className="btn-outline" onClick={() => deleteEvent(event.id)} style={{ padding: '8px 12px', borderColor: '#ef4444', color: '#ef4444' }}>
                            <Trash2 size={14} style={{ marginRight: '4px' }} /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

              </div>
            )}

            {activeSection === 'contacts' && (
            <div className="glass-panel" style={{ ...sectionMotionStyle, padding: '1.2rem', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.9rem', color: 'var(--text-color)' }}>
                <Mail size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                Contact Submissions
              </h2>

              {filteredContacts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No contact submissions yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.8rem', marginBottom: '1.2rem' }}>
                  {filteredContacts.map(contact => (
                    <div key={contact.id} style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.9rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                            <strong style={{ color: 'var(--text-color)' }}>{contact.name}</strong>
                            <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '99px', background: contact.status === 'new' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)', color: contact.status === 'new' ? '#f59e0b' : '#10b981' }}>
                              {contact.status || 'new'}
                            </span>
                          </div>
                          <p style={{ color: 'var(--primary)', fontSize: '0.84rem' }}>{contact.email}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>{new Date(contact.createdAt).toLocaleString()}</p>
                          <p style={{ color: 'var(--text-color)', fontSize: '0.88rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{contact.message}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'start' }}>
                          <select
                            className="form-input"
                            value={contact.status || 'new'}
                            onChange={(e) => updateContactStatus(contact.id, e.target.value)}
                            style={{ minWidth: '125px', height: '38px' }}
                          >
                            <option value="new">new</option>
                            <option value="in-progress">in-progress</option>
                            <option value="read">read</option>
                            <option value="resolved">resolved</option>
                          </select>
                          {contact.status === 'new' && (
                            <button className="btn-outline" onClick={() => markContactRead(contact.id)} style={{ padding: '7px 10px' }}>
                              Mark Read
                            </button>
                          )}
                          <button className="btn-outline" onClick={() => deleteContact(contact.id)} style={{ padding: '7px 10px', borderColor: '#ef4444', color: '#ef4444' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
            )}

            {activeSection === 'users' && (
              <div className="glass-panel" style={{ ...sectionMotionStyle, padding: '1.2rem', marginBottom: '1rem' }}>
                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.9rem', color: 'var(--text-color)' }}>
                  <Users size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  User Management
                </h2>

                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
                  <button className="btn-outline" onClick={() => setSelectedUserIds(filteredUsers.map(u => u.id))}>Select All</button>
                  <button className="btn-outline" onClick={() => setSelectedUserIds([])}>Clear</button>
                  <button className="btn-outline" onClick={() => bulkUserAction('activate')}>Bulk Activate</button>
                  <button className="btn-outline" onClick={() => bulkUserAction('suspend')}>Bulk Suspend</button>
                  <button className="btn-outline" onClick={() => bulkUserAction('verify')}>Bulk Verify</button>
                  <button className="btn-outline" onClick={() => bulkUserAction('unverify')}>Bulk Unverify</button>
                </div>

                {filteredUsers.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No users found.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {filteredUsers.map(user => (
                      <div key={user.id} style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(user.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUserIds(prev => [...new Set([...prev, user.id])]);
                                  } else {
                                    setSelectedUserIds(prev => prev.filter(id => id !== user.id));
                                  }
                                }}
                              />
                              Select user
                            </label>
                            <p style={{ margin: 0, color: 'var(--text-color)', fontWeight: 700 }}>{user.name} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({user.email})</span></p>
                            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                              College ID: {user.collegeId} • Status: {user.status || 'active'} • Verified: {user.isVerified ? 'yes' : 'no'} • Registrations: {user.registrations}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                              className="btn-outline"
                              style={{ padding: '7px 10px' }}
                              onClick={() => updateUserStatus(user.id, user.status === 'suspended' ? 'active' : 'suspended')}
                            >
                              {user.status === 'suspended' ? 'Activate' : 'Suspend'}
                            </button>
                            <button
                              className="btn-outline"
                              style={{ padding: '7px 10px' }}
                              onClick={() => updateUserVerification(user.id, !user.isVerified)}
                            >
                              {user.isVerified ? 'Mark Unverified' : 'Verify'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'registrations' && (
              <div className="glass-panel" style={{ ...sectionMotionStyle, padding: '1.2rem', marginBottom: '1rem' }}>
                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.9rem', color: 'var(--text-color)' }}>
                  <CheckCircle2 size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Registration Controls
                </h2>
                {filteredRegistrations.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No registrations yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {filteredRegistrations.map((reg, idx) => (
                      <div key={`${reg.userId}-${reg.eventId}-${idx}`} style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div>
                            <p style={{ margin: 0, color: 'var(--text-color)', fontWeight: 700 }}>{reg.userName} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({reg.userEmail})</span></p>
                            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                              Event: {reg.eventName} • Current: {reg.status} {reg.attendedAt ? `• Attended: ${new Date(reg.attendedAt).toLocaleString()}` : ''}
                            </p>
                          </div>
                          <select
                            className="form-input"
                            value={reg.status}
                            onChange={(e) => updateRegistrationStatus(reg.userId, reg.eventId, e.target.value)}
                            style={{ minWidth: '150px', height: '38px' }}
                          >
                            <option value="confirmed">confirmed</option>
                            <option value="waitlisted">waitlisted</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'audit' && (
              <div className="glass-panel" style={{ ...sectionMotionStyle, padding: '1.2rem', marginBottom: '1rem' }}>
                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.9rem', color: 'var(--text-color)' }}>
                  <Shield size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Audit & Notifications
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.9rem' }}>
                  <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.8rem' }}>
                    <h3 style={{ margin: '0 0 0.55rem', color: 'var(--text-color)', fontSize: '0.95rem' }}>Recent Audit Logs</h3>
                    {filteredAuditLogs.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No logs yet.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {filteredAuditLogs.slice(0, 25).map((log) => (
                          <div key={log.id} style={{ paddingBottom: '0.45rem', borderBottom: '1px dashed var(--card-border)' }}>
                            <p style={{ margin: 0, color: 'var(--text-color)', fontWeight: 700, fontSize: '0.82rem' }}>{log.action}</p>
                            <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{log.adminEmail} • {new Date(log.createdAt).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.8rem' }}>
                    <h3 style={{ margin: '0 0 0.55rem', color: 'var(--text-color)', fontSize: '0.95rem' }}>
                      <Bell size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                      Notification Center
                    </h3>
                    {filteredNotifications.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No notifications yet.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {filteredNotifications.slice(0, 25).map((n) => (
                          <div key={n.id} style={{ border: '1px solid var(--card-border)', borderRadius: '10px', padding: '0.55rem 0.65rem', background: n.read ? 'transparent' : 'rgba(59,130,246,0.08)' }}>
                            <p style={{ margin: 0, color: 'var(--text-color)', fontWeight: 700, fontSize: '0.82rem' }}>{n.title}</p>
                            <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{n.message}</p>
                            <div style={{ marginTop: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{new Date(n.createdAt).toLocaleString()}</span>
                              {!n.read && <button className="btn-outline" style={{ padding: '5px 8px' }} onClick={() => markNotificationRead(n.id)}>Mark Read</button>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'ops' && (
              <div className="glass-panel" style={{ ...sectionMotionStyle, padding: '1.2rem', marginBottom: '1rem' }}>
                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.9rem', color: 'var(--text-color)' }}>
                  <Database size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Operations Center
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.9rem' }}>
                  <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.9rem' }}>
                    <h3 style={{ margin: '0 0 0.6rem', color: 'var(--text-color)', fontSize: '0.95rem' }}>Homepage Content Settings</h3>
                    <div style={{ display: 'grid', gap: '0.55rem' }}>
                      <input
                        className="form-input"
                        placeholder="Hero badge"
                        value={contentSettings.heroBadge}
                        onChange={(e) => setContentSettings(prev => ({ ...prev, heroBadge: e.target.value }))}
                      />
                      <textarea
                        className="form-input"
                        rows={4}
                        placeholder="Announcement"
                        value={contentSettings.announcement}
                        onChange={(e) => setContentSettings(prev => ({ ...prev, announcement: e.target.value }))}
                      />
                      <input
                        className="form-input"
                        placeholder="About title"
                        value={contentSettings.aboutTitle}
                        onChange={(e) => setContentSettings(prev => ({ ...prev, aboutTitle: e.target.value }))}
                      />
                      <textarea
                        className="form-input"
                        rows={4}
                        placeholder="About intro"
                        value={contentSettings.aboutIntro}
                        onChange={(e) => setContentSettings(prev => ({ ...prev, aboutIntro: e.target.value }))}
                      />
                      <textarea
                        className="form-input"
                        rows={5}
                        placeholder="About mission"
                        value={contentSettings.aboutMission}
                        onChange={(e) => setContentSettings(prev => ({ ...prev, aboutMission: e.target.value }))}
                      />
                      <button className="btn-primary" onClick={saveContentSettings} disabled={savingContent}>
                        {savingContent ? 'Saving...' : 'Save Content Settings'}
                      </button>
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.9rem' }}>
                    <h3 style={{ margin: '0 0 0.6rem', color: 'var(--text-color)', fontSize: '0.95rem' }}>Backups</h3>
                    <button className="btn-outline" onClick={createBackup} style={{ marginBottom: '0.6rem' }}>
                      <Database size={14} style={{ marginRight: '6px' }} /> Create New Backup
                    </button>
                    {backups.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No backups available.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.45rem' }}>
                        {backups.slice(0, 12).map((backup) => (
                          <div key={backup.name} style={{ border: '1px solid var(--card-border)', borderRadius: '10px', padding: '0.55rem' }}>
                            <p style={{ margin: 0, color: 'var(--text-color)', fontWeight: 700, fontSize: '0.82rem' }}>{backup.name}</p>
                            <p style={{ margin: '0.2rem 0 0.4rem', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                              {new Date(backup.createdAt).toLocaleString()} • {(Number(backup.sizeBytes || 0) / 1024).toFixed(1)} KB
                            </p>
                            <button className="btn-outline" style={{ padding: '5px 8px' }} onClick={() => restoreBackup(backup.name)}>
                              Restore
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'projects' && (
            <div className="glass-panel" style={{ ...sectionMotionStyle, padding: '1.2rem', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.9rem', color: 'var(--text-color)' }}>
                <FolderKanban size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                Project Showcase Management
              </h2>

              <form onSubmit={submitProject} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem', marginBottom: '1rem' }}>
                <input className="form-input" name="title" placeholder="Project title" value={projectForm.title} onChange={handleProjectChange} required />
                <input className="form-input" name="techStack" placeholder="React, Node.js" value={projectForm.techStack} onChange={handleProjectChange} required />
                <input className="form-input" name="status" placeholder="In Progress" value={projectForm.status} onChange={handleProjectChange} />
                <input className="form-input" name="githubUrl" placeholder="GitHub URL" value={projectForm.githubUrl} onChange={handleProjectChange} />
                <input className="form-input" name="demoUrl" placeholder="Demo URL" value={projectForm.demoUrl} onChange={handleProjectChange} />
                <input className="form-input" name="summary" placeholder="Project summary" value={projectForm.summary} onChange={handleProjectChange} required style={{ gridColumn: '1 / -1' }} />

                <div style={{ display: 'flex', gap: '0.8rem', gridColumn: '1 / -1' }}>
                  <button type="submit" className="btn-primary" disabled={savingProject}>
                    <PlusCircle size={16} style={{ marginRight: '6px' }} />
                    {savingProject ? 'Saving...' : editingProjectId ? 'Update Project' : 'Create Project'}
                  </button>
                  {editingProjectId && (
                    <button type="button" className="btn-outline" onClick={resetProjectForm}>Cancel Edit</button>
                  )}
                </div>
              </form>

              {filteredProjects.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No projects yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.8rem' }}>
                  {filteredProjects.map(project => (
                    <div key={project.id} style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '0.9rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                          <h3 style={{ color: 'var(--text-color)', fontWeight: 800 }}>{project.title}</h3>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>{project.techStack} · {project.status}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.35rem' }}>{project.summary}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn-outline" onClick={() => startProjectEdit(project)} style={{ padding: '7px 10px' }}>
                            <Pencil size={14} />
                          </button>
                          <button className="btn-outline" onClick={() => deleteProject(project.id)} style={{ padding: '7px 10px', borderColor: '#ef4444', color: '#ef4444' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
