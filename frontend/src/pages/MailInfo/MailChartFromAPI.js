import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import { fetchUsers } from '../../services/api';
import { ROLES } from '../../config/api';
import './MailChartFromAPI.css';

const sampleUsers = [
  { id_n: 1, role: 'IT_ADMIN', emails: [{ is_verified: true, is_primary: true }, { is_verified: false, is_primary: false }] },
  { id_n: 2, role: 'IT_ADMIN', emails: [{ is_verified: true, is_primary: true }] },
  { id_n: 3, role: 'DIRECTION', emails: [{ is_verified: true, is_primary: true }, { is_verified: true, is_primary: false }] },
  { id_n: 4, role: 'DIRECTION', emails: [{ is_verified: false, is_primary: true }] },
  { id_n: 5, role: 'USER', emails: [{ is_verified: true, is_primary: true }] },
  { id_n: 6, role: 'USER', emails: [{ is_verified: false, is_primary: true }, { is_verified: false, is_primary: false }] },
  { id_n: 7, role: 'USER', emails: [{ is_verified: true, is_primary: true }] },
  { id_n: 8, role: 'USER', emails: [{ is_verified: false, is_primary: true }] },
  { id_n: 9, role: 'USER', emails: [] },
  { id_n: 10, role: 'DIRECTION', emails: [{ is_verified: true, is_primary: true }, { is_verified: true, is_primary: false }] },
];

const MailChartFromAPI = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers();
      if (data && data.length > 0) {
        setUsers(data);
      } else {
        setUsers(sampleUsers);
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const emailStats = useMemo(() => {
    let verified = 0;
    let unverified = 0;
    let primaryCount = 0;
    let secondaryCount = 0;
    const emailCountByUser = {};
    const roleCounts = {};

    users.forEach((user) => {
      const emails = user.emails || [];
      const role = user.role || 'USER';

      if (!roleCounts[role]) {
        roleCounts[role] = { verified: 0, unverified: 0 };
      }

      emails.forEach((email) => {
        if (email.is_verified) {
          verified++;
          roleCounts[role].verified++;
        } else {
          unverified++;
          roleCounts[role].unverified++;
        }

        if (email.is_primary) {
          primaryCount++;
        } else {
          secondaryCount++;
        }
      });

      const count = emails.length;
      emailCountByUser[count] = (emailCountByUser[count] || 0) + 1;
    });

    const knownRoles = Object.keys(ROLES);
    const otherRoles = Object.keys(roleCounts).filter((role) => !knownRoles.includes(role));
    const roleBreakdown = [...knownRoles, ...otherRoles]
      .filter((role) => roleCounts[role])
      .map((role) => ({
        role,
        label: ROLES[role]?.label || role,
        verified: roleCounts[role].verified,
        unverified: roleCounts[role].unverified,
      }));

    return {
      verified,
      unverified,
      primaryCount,
      secondaryCount,
      emailCountByUser,
      roleBreakdown,
      totalEmails: verified + unverified,
      totalUsers: users.length,
      usersWithoutEmail: emailCountByUser[0] || 0,
      usersWithMultipleEmails: Object.entries(emailCountByUser)
        .filter(([count]) => parseInt(count) > 1)
        .reduce((sum, [, nb]) => sum + nb, 0),
    };
  }, [users]);

  const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);

  const donutVerificationOptions = useMemo(
    () => ({
      chart: {
        type: 'donut',
        fontFamily: 'Inter, system-ui, sans-serif',
        animations: { enabled: true, easing: 'easeinout', speed: 800 },
      },
      colors: ['#4caf50', '#f44336', '#9e9e9e'],
      labels: ['Vérifiés', 'Non vérifiés', 'Sans email'],
      dataLabels: {
        enabled: true,
        formatter: (val) => `${Number.isFinite(val) ? val.toFixed(1) : '0'}%`,
        style: { fontSize: '11px', colors: ['#ffffff'] },
      },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: {
              show: true,
              name: { show: true, color: '#64748b', fontSize: '12px' },
              value: {
                show: true,
                color: '#1e293b',
                fontSize: '14px',
                fontWeight: 700,
                formatter: (val) => `${val}`,
              },
              total: {
                show: true,
                label: 'Total',
                color: '#64748b',
                formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0),
              },
            },
          },
        },
      },
      tooltip: { theme: 'dark', y: { formatter: (val) => `${val} emails` } },
      legend: { show: true, position: 'bottom', fontSize: '12px', markers: { width: 10, height: 10, radius: 2 } },
      stroke: { width: 2, colors: ['#ffffff'] },
    }),
    []
  );

  const donutPrimaryOptions = useMemo(
    () => ({
      chart: {
        type: 'donut',
        fontFamily: 'Inter, system-ui, sans-serif',
        animations: { enabled: true, easing: 'easeinout', speed: 800 },
      },
      colors: ['#667eea', '#764ba2', '#cbd5e1'],
      labels: ['Email principal', 'Email secondaire', 'Aucun email'],
      dataLabels: {
        enabled: true,
        formatter: (val) => `${Number.isFinite(val) ? val.toFixed(1) : '0'}%`,
        style: { fontSize: '11px', colors: ['#ffffff'] },
      },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: {
              show: true,
              name: { show: true, color: '#64748b', fontSize: '12px' },
              value: {
                show: true,
                color: '#1e293b',
                fontSize: '14px',
                fontWeight: 700,
                formatter: (val) => `${val}`,
              },
              total: {
                show: true,
                label: 'Total',
                color: '#64748b',
                formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0),
              },
            },
          },
        },
      },
      tooltip: { theme: 'dark', y: { formatter: (val) => `${val} emails` } },
      legend: { show: true, position: 'bottom', fontSize: '12px', markers: { width: 10, height: 10, radius: 2 } },
      stroke: { width: 2, colors: ['#ffffff'] },
    }),
    []
  );

  const donutVerificationSeries = useMemo(
    () => [emailStats.verified, emailStats.unverified, emailStats.usersWithoutEmail],
    [emailStats]
  );

  const donutPrimarySeries = useMemo(
    () => [emailStats.primaryCount, emailStats.secondaryCount, emailStats.usersWithoutEmail],
    [emailStats]
  );

  const barRoleOptions = useMemo(
    () => ({
      chart: {
        type: 'bar',
        fontFamily: 'Inter, system-ui, sans-serif',
        animations: { enabled: true, easing: 'easeinout', speed: 800 },
        toolbar: { show: false },
        stacked: true,
      },
      colors: ['#4caf50', '#f44336'],
      plotOptions: {
        bar: {
          borderRadius: 6,
          horizontal: false,
          columnWidth: '45%',
        },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: emailStats.roleBreakdown.map((r) => r.label),
        labels: { style: { fontSize: '11px', colors: '#64748b', fontWeight: 500 } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: { style: { fontSize: '11px', colors: '#64748b' } },
        title: { text: "Nombre d'emails", style: { fontSize: '11px', color: '#94a3b8' } },
      },
      tooltip: { theme: 'dark', y: { formatter: (val) => `${val} emails` } },
      legend: { show: true, position: 'top', fontSize: '11px', markers: { width: 10, height: 10, radius: 2 } },
      grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
    }),
    [emailStats.roleBreakdown]
  );

  const barRoleSeries = useMemo(
    () => [
      { name: 'Vérifiés', data: emailStats.roleBreakdown.map((r) => r.verified) },
      { name: 'Non vérifiés', data: emailStats.roleBreakdown.map((r) => r.unverified) },
    ],
    [emailStats.roleBreakdown]
  );

  const metricCards = useMemo(
    () => [
      {
        label: 'Total Emails',
        value: emailStats.totalEmails,
        icon: '📧',
        colorClass: 'purple',
      },
      {
        label: 'Vérifiés',
        value: emailStats.verified,
        percent: pct(emailStats.verified, emailStats.totalEmails),
        icon: '✅',
        colorClass: 'green',
      },
      {
        label: 'Non Vérifiés',
        value: emailStats.unverified,
        percent: pct(emailStats.unverified, emailStats.totalEmails),
        icon: '⚠️',
        colorClass: 'amber',
      },
      {
        label: 'Sans Email',
        value: emailStats.usersWithoutEmail,
        percent: pct(emailStats.usersWithoutEmail, emailStats.totalUsers),
        icon: '🚫',
        colorClass: 'red',
      },
      {
        label: 'Utilisateurs Multi-emails',
        value: emailStats.usersWithMultipleEmails,
        percent: pct(emailStats.usersWithMultipleEmails, emailStats.totalUsers),
        icon: '👥',
        colorClass: 'violet',
      },
    ],
    [emailStats]
  );

  if (loading) {
    return (
      <div className="mailchart-container">
        <div className="mailchart-header">
          <div className="mailchart-header-left">
            <div className="mailchart-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 7l-10 7L2 7" />
              </svg>
            </div>
            <div>
              <h3 className="mailchart-title">Statistiques Emails</h3>
              <p className="mailchart-subtitle">Chargement des données...</p>
            </div>
          </div>
        </div>
        <div className="mailchart-loading-container">
          <div className="mailchart-spinner" />
          <p className="mailchart-loading-text">Chargement des statistiques emails...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mailchart-container">
        <div className="mailchart-header">
          <div className="mailchart-header-left">
            <div className="mailchart-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h3 className="mailchart-title">Statistiques Emails</h3>
              <p className="mailchart-subtitle">Erreur de chargement</p>
            </div>
          </div>
        </div>
        <div className="mailchart-error-container">
          <p className="mailchart-error-message">{error}</p>
          <button className="mailchart-retry-button" onClick={loadData}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mailchart-container">
      <div className="mailchart-header">
        <div className="mailchart-header-left">
          <div className="mailchart-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M22 7l-10 7L2 7" />
            </svg>
          </div>
          <div>
            <h3 className="mailchart-title">Statistiques Emails</h3>
            <p className="mailchart-subtitle">{emailStats.totalUsers} utilisateurs · {emailStats.totalEmails} emails</p>
          </div>
        </div>
        <div className="mailchart-footer-right">
          {lastUpdated && (
            <span className="mailchart-timestamp">
              Maj {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className="mailchart-icon-button" onClick={loadData} title="Actualiser">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mailchart-badge-wrapper">
        {metricCards.map((card, index) => (
          <div key={index} className={`mailchart-metric-card mailchart-metric-card--${card.colorClass}`}>
            <div className="mailchart-metric-header">
              <span className="mailchart-metric-icon">{card.icon}</span>
              <span className="mailchart-metric-label">{card.label}</span>
            </div>
            <div className="mailchart-metric-value">{card.value}</div>
            {card.percent !== undefined && (
              <span className="mailchart-metric-pct">{card.percent}%</span>
            )}
          </div>
        ))}
      </div>

      <div className="mailchart-donut-grid">
        <div className="mailchart-donut-item">
          <h4 className="mailchart-section-title">Statut de vérification</h4>
          <div className="mailchart-chart-container">
            <Chart
              options={donutVerificationOptions}
              series={donutVerificationSeries}
              type="donut"
              height={320}
            />
          </div>
        </div>
        <div className="mailchart-donut-item">
          <h4 className="mailchart-section-title">Email principal vs secondaire</h4>
          <div className="mailchart-chart-container">
            <Chart
              options={donutPrimaryOptions}
              series={donutPrimarySeries}
              type="donut"
              height={320}
            />
          </div>
        </div>
      </div>

      {emailStats.roleBreakdown.length > 0 && (
        <div className="mailchart-bar-section">
          <h4 className="mailchart-section-title">Vérification par rôle</h4>
          <div className="mailchart-chart-container">
            <Chart
              options={barRoleOptions}
              series={barRoleSeries}
              type="bar"
              height={260}
            />
          </div>
        </div>
      )}

      <div className="mailchart-total-footer">
        <div className="mailchart-total-left">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Total Utilisateurs</span>
        </div>
        <div className="mailchart-total-value">{emailStats.totalUsers}</div>
      </div>
    </div>
  );
};

export default MailChartFromAPI;