import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Tag, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const categoryColors = {
  Orientation: { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
  Technical:   { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
  Hackathon:   { bg: 'rgba(239,68,68,0.15)',  text: '#ef4444' },
  Workshop:    { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6' },
};

const API_BASE_URL = (window.__DG_API_BASE_URL__ || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://the-developers-guild-backend.onrender.com').replace(/\/$/, '');

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });
  const [registrationByEvent, setRegistrationByEvent] = useState({});
  const [teamByEvent, setTeamByEvent] = useState({});
  const [inviteByEvent, setInviteByEvent] = useState({});
  const [qrByEvent, setQrByEvent] = useState({});
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-asc');

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  })();

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: '' }), 3500);
  };

  const getRemaining = (expiresAt) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/events`);
        const data = await r.json();
        setEvents(data);
      } catch {
        showToast('Could not load events. Is the server running?', 'error');
      } finally {
        setLoading(false);
      }
    };

    const loadRegistrations = async () => {
      if (!user) return;
      try {
        const r = await fetch(`${API_BASE_URL}/api/user/${user.id}/registrations`);
        const evts = await r.json();
        const map = {};
        const teamMap = {};
        const invitesMap = {};
        for (const event of evts) {
          map[event.id] = event.registrationStatus || 'confirmed';
          teamMap[event.id] = {
            teamLeader: event.teamLeader || null,
            teamMembers: Array.isArray(event.teamMembers) ? event.teamMembers : [],
          };
          try {
            const invRes = await fetch(`${API_BASE_URL}/api/events/${event.id}/team-invites?userId=${encodeURIComponent(user.id)}`);
            const invData = await invRes.json();
            invitesMap[event.id] = Array.isArray(invData?.invites) ? invData.invites : [];
          } catch {
            invitesMap[event.id] = [];
          }
        }
        setRegistrationByEvent(map);
        setTeamByEvent(teamMap);
        setInviteByEvent(invitesMap);
      } catch {
        // no-op
      }
    };

    loadEvents();
    loadRegistrations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshData = async () => {
    const eventsRes = await fetch(`${API_BASE_URL}/api/events`);
    const eventsData = await eventsRes.json();
    setEvents(eventsData);

    if (user) {
      const regsRes = await fetch(`${API_BASE_URL}/api/user/${user.id}/registrations`);
      const evts = await regsRes.json();
      const map = {};
      const teamMap = {};
      const invitesMap = {};
      for (const event of evts) {
        map[event.id] = event.registrationStatus || 'confirmed';
        teamMap[event.id] = {
          teamLeader: event.teamLeader || null,
          teamMembers: Array.isArray(event.teamMembers) ? event.teamMembers : [],
        };
        try {
          const invRes = await fetch(`${API_BASE_URL}/api/events/${event.id}/team-invites?userId=${encodeURIComponent(user.id)}`);
          const invData = await invRes.json();
          invitesMap[event.id] = Array.isArray(invData?.invites) ? invData.invites : [];
        } catch {
          invitesMap[event.id] = [];
        }
      }
      setRegistrationByEvent(map);
      setTeamByEvent(teamMap);
      setInviteByEvent(invitesMap);
    }
  };

  const handleRegister = async (eventId) => {
    if (!user) {
      showToast('Please log in to register for events.', 'error');
      return;
    }

    if (registrationByEvent[eventId]) {
      showToast('You are already registered for this event.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/events/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRegistrationByEvent(prev => ({ ...prev, [eventId]: data.status || 'confirmed' }));
      setEvents(prev => prev.map(event => {
        if (event.id !== eventId) return event;
        const confirmedInc = data.status === 'confirmed' ? 1 : 0;
        const waitlistInc = data.status === 'waitlisted' ? 1 : 0;
        const nextConfirmed = (event.confirmedCount || 0) + confirmedInc;
        const nextWaitlist = (event.waitlistCount || 0) + waitlistInc;
        const capacity = event.capacity || 0;
        return {
          ...event,
          confirmedCount: nextConfirmed,
          waitlistCount: nextWaitlist,
          availableSeats: Math.max(0, capacity - nextConfirmed),
          isFull: nextConfirmed >= capacity,
        };
      }));
      showToast(data.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const downloadQrDataUrl = (dataUrl, eventId) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `event-${eventId}-qr.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownloadCalendar = (eventId) => {
    window.open(`${API_BASE_URL}/api/events/${eventId}/calendar.ics`, '_blank');
  };

  const handleDownloadCertificate = (eventId) => {
    if (!user) {
      showToast('Please log in first.', 'error');
      return;
    }
    window.open(`${API_BASE_URL}/api/events/${eventId}/certificate?userId=${encodeURIComponent(user.id)}`, '_blank');
  };

  const handleCancelRegistration = async (eventId) => {
    if (!user) {
      showToast('Please log in first.', 'error');
      return;
    }

    try {
      const reqRes = await fetch(`${API_BASE_URL}/api/events/cancel-registration/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, eventId }),
      });
      const reqData = await reqRes.json();
      if (!reqRes.ok) throw new Error(reqData.message || 'Could not send cancellation OTP.');

      showToast(reqData.message || 'OTP sent to your email.', 'success');

      const otp = window.prompt('Enter OTP sent to your email to confirm cancellation:');
      if (!otp) return;

      const res = await fetch(`${API_BASE_URL}/api/events/cancel-registration/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, eventId, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not cancel registration.');

      setQrByEvent(prev => {
        const copy = { ...prev };
        delete copy[eventId];
        return copy;
      });
      await refreshData();
      showToast(data.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const persistTeamMembers = async (eventId, teamMembers) => {
    if (!user) return;
    const res = await fetch(`${API_BASE_URL}/api/events/${eventId}/team-members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, teamMembers }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Unable to update team members.');

    setTeamByEvent(prev => ({
      ...prev,
      [eventId]: {
        teamLeader: data.teamLeader,
        teamMembers: data.teamMembers,
      },
    }));
  };

  const handleAddTeamMember = async (eventId) => {
    const existing = teamByEvent[eventId]?.teamMembers || [];
    if (existing.length >= 4) {
      showToast('Maximum 4 team members allowed.', 'error');
      return;
    }

    const name = window.prompt('Enter team member name:');
    if (!name) return;
    const email = window.prompt('Enter team member email:');
    if (!email) return;

    try {
      await persistTeamMembers(eventId, [...existing, { name: name.trim(), email: email.trim().toLowerCase() }]);
      showToast('Team member added successfully.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSendInvite = async (eventId) => {
    if (!user) {
      showToast('Please log in first.', 'error');
      return;
    }

    const inviteeEmail = window.prompt('Enter teammate email for invite:');
    if (!inviteeEmail) return;
    const inviteeName = window.prompt('Enter teammate name (optional):') || '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/events/${eventId}/team-invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, inviteeEmail, inviteeName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not send invite.');
      setInviteByEvent((prev) => ({ ...prev, [eventId]: [data.invite, ...(prev[eventId] || [])] }));
      showToast(data.message || 'Invite sent successfully.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRevokeInvite = async (eventId, inviteId) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/${eventId}/team-invites/${inviteId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to revoke invite.');
      await refreshData();
      showToast(data.message || 'Invite revoked.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleResendInvite = async (eventId, inviteId) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/${eventId}/team-invites/${inviteId}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to resend invite.');
      await refreshData();
      showToast(data.message || 'Invite resent.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveTeamMember = async (eventId, index) => {
    const existing = teamByEvent[eventId]?.teamMembers || [];
    const next = existing.filter((_, idx) => idx !== index);

    try {
      await persistTeamMembers(eventId, next);
      showToast('Team member removed.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleGetCheckinQr = async (eventId) => {
    if (!user) {
      showToast('Please log in first.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/events/${eventId}/checkin-qr?userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not generate check-in QR.');

      setQrByEvent(prev => ({ ...prev, [eventId]: data.qrDataUrl }));
      downloadQrDataUrl(data.qrDataUrl, eventId);
      showToast('QR downloaded successfully.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filteredEvents = [...events]
    .filter(event => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [event.name, event.description, event.location, event.category]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    })
    .filter(event => (categoryFilter === 'all' ? true : event.category === categoryFilter))
    .filter(event => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'open') return event.isOpen;
      if (statusFilter === 'closed') return !event.isOpen;
      if (statusFilter === 'full') return event.isFull;
      if (statusFilter === 'available') return !event.isFull;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'name-asc') return String(a.name).localeCompare(String(b.name));
      if (sortBy === 'name-desc') return String(b.name).localeCompare(String(a.name));
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

  const categoryOptions = Array.from(new Set(events.map(event => event.category).filter(Boolean)));

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--bg-color)', padding: '3rem 1.5rem' }}>
      {/* Toast */}
      {toast.visible && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 999, padding: '12px 24px', borderRadius: '99px',
          background: toast.type === 'success' ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)',
          color: 'white', fontWeight: 600, fontSize: '0.9rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)',
          animation: 'fadeInUp 0.3s ease',
        }}>
          {toast.message}
        </div>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontFamily: 'Outfit, sans-serif', fontWeight: 900, color: 'var(--text-color)', marginBottom: '0.75rem' }}>
            Upcoming <span className="text-gradient">Events</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '540px', margin: '0 auto' }}>
            Workshops, hackathons, and seminars organized by The Developers' Guild at AIMT.
          </p>
          {!user && (
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Log in</Link> to register for events.
            </p>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.8rem' }}>
            <input
              className="form-input"
              placeholder="Search events, location, category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="form-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {categoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="available">Seats Available</option>
              <option value="full">Full</option>
            </select>
            <select className="form-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date-asc">Date: Earliest</option>
              <option value="date-desc">Date: Latest</option>
              <option value="name-asc">Name: A-Z</option>
              <option value="name-desc">Name: Z-A</option>
            </select>
          </div>
          <p style={{ marginTop: '0.6rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Showing {filteredEvents.length} of {events.length} events
          </p>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <div className="animate-spin" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '4px solid var(--primary)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          filteredEvents.length === 0 ? (
            <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No events match your filters. Try changing search/filter options.
            </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {filteredEvents.map(event => {
              const registrationStatus = registrationByEvent[event.id];
              const cat = categoryColors[event.category] || { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' };
              return (
                <div key={event.id} className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  {/* Category badge */}
                  <div style={{ marginBottom: '1rem' }}>
                    <span style={{ background: cat.bg, color: cat.text, padding: '4px 12px', borderRadius: '99px', fontSize: '0.78rem', fontWeight: 700 }}>
                      <Tag size={11} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                      {event.category}
                    </span>
                  </div>

                  <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-color)', marginBottom: '0.6rem', lineHeight: 1.3 }}>
                    {event.name}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: '1.25rem', flexGrow: 1 }}>
                    {event.description}
                  </p>

                  {/* Meta */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span><Clock size={13} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                      {new Date(event.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })} · {event.time}
                    </span>
                    <span><MapPin size={13} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                      {event.location}
                    </span>
                    <span>
                      Seats: {event.confirmedCount}/{event.capacity} · Available: {event.availableSeats}
                    </span>
                    {event.waitlistCount > 0 && <span>Waitlist: {event.waitlistCount}</span>}
                    <span>{event.isOpen ? 'Registration Open' : 'Registration Closed'}</span>
                  </div>

                  <button onClick={() => handleDownloadCalendar(event.id)} className="btn-outline" style={{ width: '100%', marginBottom: '0.6rem' }}>
                    Add to Calendar (.ics)
                  </button>

                  {/* Action */}
                  {registrationStatus === 'confirmed' ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.7rem' }}>
                        <CheckCircle size={18} /> Registered
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {qrByEvent[event.id] ? (
                          <button onClick={() => downloadQrDataUrl(qrByEvent[event.id], event.id)} className="btn-outline" style={{ flex: 1 }}>
                            Download QR
                          </button>
                        ) : (
                          <button onClick={() => handleGetCheckinQr(event.id)} className="btn-outline" style={{ flex: 1 }}>
                            Generate & Download QR
                          </button>
                        )}
                        <button onClick={() => handleCancelRegistration(event.id)} className="btn-outline" style={{ flex: 1, borderColor: '#ef4444', color: '#ef4444' }}>
                          Cancel (OTP)
                        </button>
                      </div>
                      <button onClick={() => handleDownloadCertificate(event.id)} className="btn-outline" style={{ width: '100%', marginTop: '0.5rem' }}>
                        Download Participation Certificate
                      </button>
                      {qrByEvent[event.id] && (
                        <div style={{ marginTop: '0.8rem', textAlign: 'center' }}>
                          <img src={qrByEvent[event.id]} alt="Check-in QR" style={{ width: '140px', height: '140px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'white', padding: '8px' }} />
                        </div>
                      )}

                      <div style={{ marginTop: '0.9rem', borderTop: '1px dashed var(--card-border)', paddingTop: '0.75rem' }}>
                        <p style={{ color: 'var(--text-color)', fontSize: '0.85rem', fontWeight: 700 }}>
                          Team Leader: {teamByEvent[event.id]?.teamLeader?.name || user?.name || 'You'}
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                          Team Members: {(teamByEvent[event.id]?.teamMembers || []).length}/4
                        </p>
                        {(teamByEvent[event.id]?.teamMembers || []).length > 0 && (
                          <div style={{ marginTop: '0.45rem', display: 'grid', gap: '0.35rem' }}>
                            {(teamByEvent[event.id]?.teamMembers || []).map((member, idx) => (
                              <div key={`${member.email}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{member.name} ({member.email})</span>
                                <button className="btn-outline" style={{ padding: '4px 8px', borderColor: '#ef4444', color: '#ef4444' }} onClick={() => handleRemoveTeamMember(event.id, idx)}>
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button className="btn-outline" style={{ marginTop: '0.55rem', width: '100%' }} onClick={() => handleAddTeamMember(event.id)}>
                          Add Team Member
                        </button>
                        <button className="btn-outline" style={{ marginTop: '0.45rem', width: '100%' }} onClick={() => handleSendInvite(event.id)}>
                          Invite by Email
                        </button>
                        {(inviteByEvent[event.id] || []).filter((inv) => inv.status === 'pending').length > 0 && (
                          <div style={{ marginTop: '0.55rem', display: 'grid', gap: '0.35rem' }}>
                            {(inviteByEvent[event.id] || []).filter((inv) => inv.status === 'pending').map((inv) => (
                              <div key={inv.id} style={{ border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.45rem' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                                  Invite: {inv.email} | Expires in {getRemaining(inv.expiresAt)}
                                </p>
                                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                                  <button className="btn-outline" style={{ padding: '4px 8px' }} onClick={() => handleResendInvite(event.id, inv.id)}>Resend</button>
                                  <button className="btn-outline" style={{ padding: '4px 8px', borderColor: '#ef4444', color: '#ef4444' }} onClick={() => handleRevokeInvite(event.id, inv.id)}>Revoke</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : registrationStatus === 'waitlisted' ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.7rem' }}>
                        <CheckCircle size={18} /> Waitlisted
                      </div>
                      <button onClick={() => handleCancelRegistration(event.id)} className="btn-outline" style={{ width: '100%', borderColor: '#ef4444', color: '#ef4444' }}>
                        Cancel Waitlist (OTP)
                      </button>

                      <div style={{ marginTop: '0.9rem', borderTop: '1px dashed var(--card-border)', paddingTop: '0.75rem' }}>
                        <p style={{ color: 'var(--text-color)', fontSize: '0.85rem', fontWeight: 700 }}>
                          Team Leader: {teamByEvent[event.id]?.teamLeader?.name || user?.name || 'You'}
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                          Team Members: {(teamByEvent[event.id]?.teamMembers || []).length}/4
                        </p>
                        {(teamByEvent[event.id]?.teamMembers || []).length > 0 && (
                          <div style={{ marginTop: '0.45rem', display: 'grid', gap: '0.35rem' }}>
                            {(teamByEvent[event.id]?.teamMembers || []).map((member, idx) => (
                              <div key={`${member.email}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{member.name} ({member.email})</span>
                                <button className="btn-outline" style={{ padding: '4px 8px', borderColor: '#ef4444', color: '#ef4444' }} onClick={() => handleRemoveTeamMember(event.id, idx)}>
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button className="btn-outline" style={{ marginTop: '0.55rem', width: '100%' }} onClick={() => handleAddTeamMember(event.id)}>
                          Add Team Member
                        </button>
                        <button className="btn-outline" style={{ marginTop: '0.45rem', width: '100%' }} onClick={() => handleSendInvite(event.id)}>
                          Invite by Email
                        </button>
                        {(inviteByEvent[event.id] || []).filter((inv) => inv.status === 'pending').length > 0 && (
                          <div style={{ marginTop: '0.55rem', display: 'grid', gap: '0.35rem' }}>
                            {(inviteByEvent[event.id] || []).filter((inv) => inv.status === 'pending').map((inv) => (
                              <div key={inv.id} style={{ border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.45rem' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                                  Invite: {inv.email} | Expires in {getRemaining(inv.expiresAt)}
                                </p>
                                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                                  <button className="btn-outline" style={{ padding: '4px 8px' }} onClick={() => handleResendInvite(event.id, inv.id)}>Resend</button>
                                  <button className="btn-outline" style={{ padding: '4px 8px', borderColor: '#ef4444', color: '#ef4444' }} onClick={() => handleRevokeInvite(event.id, inv.id)}>Revoke</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : !event.isOpen ? (
                    <button className="btn-outline" style={{ width: '100%', opacity: 0.7 }} disabled>
                      Registration Closed
                    </button>
                  ) : (
                    <button onClick={() => handleRegister(event.id)} className="btn-primary" style={{ width: '100%' }}>
                      {event.isFull ? 'Join Waitlist' : 'Register Now'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          )
        )}
      </div>
    </div>
  );
};

export default Events;

