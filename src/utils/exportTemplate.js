// src/utils/exportTemplate.js
// Generates a self-contained, beautifully styled HTML data export.
// Called by adminController.exportMyData — returns an HTML string.

function generateExportHTML(data) {
  const { profile, verification, subscription, preferences, photos, socialLinks, consent, accountStatus } = data;

  const field = (label, value) => {
    if (!value && value !== false && value !== 0) return '';
    return `
      <div class="field">
        <span class="field-label">${label}</span>
        <span class="field-value">${value}</span>
      </div>`;
  };

  const badge = (text, active, colorVar) =>
    `<span class="badge" style="--bc:var(${colorVar});opacity:${active ? 1 : 0.35}">${text}</span>`;

  const photoGrid = (photos) => {
    if (!photos || photos.length === 0) return '<p class="empty">No photos uploaded</p>';
    return `<div class="photo-grid">${photos.map(p =>
      `<div class="photo-item"><img src="${p.url}" alt="photo" loading="lazy"/></div>`
    ).join('')}</div>`;
  };

  const socialIcons = { facebook:'f', instagram:'◈', x:'✕', whatsapp:'◉', linkedin:'in', tiktok:'♪', snapchat:'◎', youtube:'▶' };

  const socialList = (links) => {
    if (!links || links.length === 0) return '<p class="empty">No social links added</p>';
    return `<div class="social-list">${links.map(l =>
      `<div class="social-item">
        <span class="social-icon">${socialIcons[l.platform] || '◆'}</span>
        <span class="social-platform">${l.platform}</span>
        <a href="${l.platform === 'whatsapp' ? '#' : l.url}" class="social-url">${l.url}</a>
        <span class="social-vis">${l.isPublic ? 'Public' : 'Private'}</span>
      </div>`
    ).join('')}</div>`;
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : '—';
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-US', { dateStyle:'long', timeStyle:'short' }) : '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>My Data Export — ${profile.name || profile.email}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
<style>
  :root {
    --bg:      #0b0c10;
    --surface: #13151c;
    --border:  #1f2231;
    --gold:    #c9a84c;
    --gold2:   #e8c96e;
    --text:    #e8e6df;
    --muted:   #6b6e7e;
    --green:   #4caf7d;
    --red:     #e05c5c;
    --blue:    #5c9be0;
    --purple:  #9b6fe0;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    padding: 0;
  }

  /* ── Header ─────────────────────────────────────────────── */
  .hero {
    background: linear-gradient(135deg, #0d0f18 0%, #151824 50%, #0b0e17 100%);
    border-bottom: 1px solid var(--border);
    padding: 60px 48px 48px;
    position: relative;
    overflow: hidden;
  }
  .hero::before {
    content: '';
    position: absolute;
    top: -80px; right: -80px;
    width: 320px; height: 320px;
    background: radial-gradient(circle, rgba(201,168,76,.12) 0%, transparent 70%);
    pointer-events: none;
  }
  .hero::after {
    content: '';
    position: absolute;
    bottom: -40px; left: 10%;
    width: 200px; height: 200px;
    background: radial-gradient(circle, rgba(92,155,224,.07) 0%, transparent 70%);
    pointer-events: none;
  }
  .hero-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 16px;
  }
  .hero-name {
    font-family: 'Playfair Display', serif;
    font-size: clamp(36px, 5vw, 58px);
    font-weight: 900;
    line-height: 1.05;
    color: var(--text);
    margin-bottom: 8px;
  }
  .hero-email {
    font-size: 15px;
    color: var(--muted);
    margin-bottom: 28px;
  }
  .hero-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }
  .hero-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    font-size: 12px;
    color: var(--muted);
    background: rgba(255,255,255,.03);
  }
  .hero-chip .dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--gold);
  }
  .export-date {
    margin-top: 32px;
    font-size: 11px;
    color: var(--muted);
    letter-spacing: 1px;
  }

  /* ── Layout ──────────────────────────────────────────────── */
  .wrapper {
    max-width: 900px;
    margin: 0 auto;
    padding: 48px 24px 80px;
  }

  /* ── Section ─────────────────────────────────────────────── */
  .section {
    margin-bottom: 40px;
    animation: fadeUp .5s ease both;
  }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(16px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .section:nth-child(1)  { animation-delay: .05s }
  .section:nth-child(2)  { animation-delay: .10s }
  .section:nth-child(3)  { animation-delay: .15s }
  .section:nth-child(4)  { animation-delay: .20s }
  .section:nth-child(5)  { animation-delay: .25s }
  .section:nth-child(6)  { animation-delay: .30s }
  .section:nth-child(7)  { animation-delay: .35s }

  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }
  .section-icon {
    width: 36px; height: 36px;
    border-radius: 10px;
    background: rgba(201,168,76,.1);
    border: 1px solid rgba(201,168,76,.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
  }
  .section-title {
    font-family: 'Playfair Display', serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
  }
  .section-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(to right, var(--border), transparent);
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px 28px;
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(to right, transparent, rgba(201,168,76,.3), transparent);
  }

  /* ── Fields ──────────────────────────────────────────────── */
  .fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .field-label {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--muted);
  }
  .field-value {
    font-size: 14px;
    color: var(--text);
    font-weight: 400;
  }

  /* ── Badges ──────────────────────────────────────────────── */
  .badges-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 4px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid var(--bc);
    color: var(--bc);
    background: transparent;
  }
  .badge::before {
    content: '';
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--bc);
  }

  /* ── Subscription card ───────────────────────────────────── */
  .sub-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 20px;
  }
  .sub-plan {
    font-family: 'Playfair Display', serif;
    font-size: 32px;
    font-weight: 900;
    color: ${subscription?.plan === 'premium' ? 'var(--gold)' : 'var(--muted)'};
    text-transform: capitalize;
    letter-spacing: -0.5px;
  }
  .sub-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: right;
  }
  .sub-detail-row {
    font-size: 13px;
    color: var(--muted);
  }
  .sub-detail-row strong {
    color: var(--text);
    font-weight: 500;
  }

  /* ── Photos ──────────────────────────────────────────────── */
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }
  .photo-item {
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--border);
  }
  .photo-item img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
    transition: transform .3s ease;
  }
  .photo-item img:hover { transform: scale(1.04); }

  /* ── Social links ────────────────────────────────────────── */
  .social-list { display: flex; flex-direction: column; gap: 10px; }
  .social-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(255,255,255,.02);
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .social-icon {
    width: 32px; height: 32px;
    border-radius: 8px;
    background: rgba(201,168,76,.1);
    border: 1px solid rgba(201,168,76,.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; color: var(--gold); font-weight: 700;
  }
  .social-platform {
    font-size: 13px; font-weight: 500; color: var(--text);
    text-transform: capitalize; min-width: 80px;
  }
  .social-url { font-size: 12px; color: var(--muted); flex: 1; word-break: break-all; text-decoration: none; }
  .social-url:hover { color: var(--gold); }
  .social-vis {
    font-size: 10px; letter-spacing: 1px; text-transform: uppercase;
    color: var(--muted); border: 1px solid var(--border); padding: 2px 8px; border-radius: 999px;
  }

  /* ── Consent / status ────────────────────────────────────── */
  .consent-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  @media (max-width: 500px) { .consent-grid { grid-template-columns: 1fr; } }
  .consent-item {
    padding: 18px 20px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,.02);
  }
  .consent-label {
    font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
    color: var(--muted); margin-bottom: 8px;
  }
  .consent-value {
    font-size: 14px; font-weight: 500;
  }
  .consent-date {
    font-size: 11px; color: var(--muted); margin-top: 4px;
  }
  .status-ok    { color: var(--green); }
  .status-warn  { color: var(--gold); }
  .status-alert { color: var(--red); }

  /* ── Pref table ──────────────────────────────────────────── */
  .pref-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .pref-row:last-child { border-bottom: none; }
  .pref-key   { font-size: 13px; color: var(--muted); }
  .pref-val   { font-size: 13px; color: var(--text); font-weight: 500; }

  /* ── Empty state ─────────────────────────────────────────── */
  .empty {
    font-size: 13px; color: var(--muted);
    font-style: italic; padding: 8px 0;
  }

  /* ── Footer ──────────────────────────────────────────────── */
  .footer {
    text-align: center;
    padding: 32px 24px 48px;
    font-size: 11px;
    color: var(--muted);
    letter-spacing: .5px;
    border-top: 1px solid var(--border);
  }
  .footer strong { color: var(--gold); }
</style>
</head>
<body>

<!-- ── Hero ─────────────────────────────────────────────────────── -->
<div class="hero">
  <p class="hero-label">Personal Data Export</p>
  <h1 class="hero-name">${profile.firstName || ''} ${profile.lastName || profile.name || ''}</h1>
  <p class="hero-email">${profile.email}</p>
  <div class="hero-meta">
    <span class="hero-chip"><span class="dot"></span>Export v${data.exportVersion}</span>
    ${subscription?.plan === 'premium'
      ? '<span class="hero-chip" style="border-color:rgba(201,168,76,.4);color:var(--gold)"><span class="dot"></span>Premium Member</span>'
      : '<span class="hero-chip">Free Plan</span>'}
    ${accountStatus?.isScheduledForDeletion
      ? '<span class="hero-chip" style="border-color:rgba(224,92,92,.4);color:var(--red)"><span class="dot" style="background:var(--red)"></span>Deletion Scheduled</span>'
      : ''}
  </div>
  <p class="export-date">Generated on ${formatDateTime(data.exportDate)}</p>
</div>

<!-- ── Main ─────────────────────────────────────────────────────── -->
<div class="wrapper">

  <!-- Profile -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon">👤</div>
      <h2 class="section-title">Profile</h2>
      <div class="section-line"></div>
    </div>
    <div class="card">
      <div class="fields-grid">
        ${field('First name',     profile.firstName)}
        ${field('Last name',      profile.lastName)}
        ${field('Username',       profile.name)}
        ${field('Email',          profile.email)}
        ${field('Phone',          profile.phone)}
        ${field('Gender',         profile.gender === 'M' ? 'Male' : profile.gender === 'F' ? 'Female' : profile.gender)}
        ${field('Date of birth',  formatDate(profile.dateOfBirth))}
        ${field('Age',            profile.age)}
        ${field('Country',        profile.country)}
        ${field('City',           profile.city)}
        ${field('Bio',            profile.bio)}
        ${field('Registered via', profile.registrationMethod)}
        ${field('Member since',   formatDate(profile.createdAt))}
        ${field('Last active',    formatDate(profile.lastActive))}
      </div>
    </div>
  </div>

  <!-- Verification -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon">✓</div>
      <h2 class="section-title">Verification Status</h2>
      <div class="section-line"></div>
    </div>
    <div class="card">
      <div class="badges-row">
        ${badge('Email verified',    verification.emailVerified,    '--green')}
        ${badge('Phone verified',    verification.phoneVerified,    '--blue')}
        ${badge('Profile completed', verification.profileCompleted, '--purple')}
      </div>
    </div>
  </div>

  <!-- Subscription -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon">◈</div>
      <h2 class="section-title">Subscription</h2>
      <div class="section-line"></div>
    </div>
    <div class="card">
      <div class="sub-card">
        <div class="sub-plan">${subscription.plan || 'Free'}</div>
        <div class="sub-details">
          ${subscription.active ? '<div class="sub-detail-row"><strong style="color:var(--green)">● Active</strong></div>' : '<div class="sub-detail-row" style="color:var(--muted)">○ Inactive</div>'}
          ${subscription.duration ? `<div class="sub-detail-row">Duration: <strong>${subscription.duration}</strong></div>` : ''}
          ${subscription.expiresAt ? `<div class="sub-detail-row">Expires: <strong>${formatDate(subscription.expiresAt)}</strong></div>` : ''}
          ${subscription.paymentMethod ? `<div class="sub-detail-row">Payment: <strong style="text-transform:capitalize">${subscription.paymentMethod}</strong></div>` : ''}
        </div>
      </div>
    </div>
  </div>

  <!-- Preferences -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon">⚙</div>
      <h2 class="section-title">Preferences</h2>
      <div class="section-line"></div>
    </div>
    <div class="card">
      ${preferences ? `
        <div class="pref-row"><span class="pref-key">Gender preference</span><span class="pref-val">${preferences.genderPreference || '—'}</span></div>
        <div class="pref-row"><span class="pref-key">Age range</span><span class="pref-val">${preferences.minAge ?? '—'} – ${preferences.maxAge ?? '—'}</span></div>
        <div class="pref-row"><span class="pref-key">Max distance</span><span class="pref-val">${preferences.distanceMaxKm ? preferences.distanceMaxKm + ' km' : '—'}</span></div>
      ` : '<p class="empty">No preferences set</p>'}
    </div>
  </div>

  <!-- Photos -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon">◎</div>
      <h2 class="section-title">Photos <span style="font-size:14px;color:var(--muted);font-family:'DM Sans'">(${photos?.length || 0})</span></h2>
      <div class="section-line"></div>
    </div>
    <div class="card">
      ${photoGrid(photos)}
    </div>
  </div>

  <!-- Social links -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon">⬡</div>
      <h2 class="section-title">Social Links</h2>
      <div class="section-line"></div>
    </div>
    <div class="card">
      ${socialList(socialLinks)}
    </div>
  </div>

  <!-- Consent & Account status -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon">⚑</div>
      <h2 class="section-title">Consent &amp; Account Status</h2>
      <div class="section-line"></div>
    </div>
    <div class="card">
      <div class="consent-grid">
        <div class="consent-item">
          <div class="consent-label">Consent accepted</div>
          <div class="consent-value ${consent.acceptedAt ? 'status-ok' : 'status-warn'}">
            ${consent.acceptedAt ? '✓ Accepted' : '— Not recorded'}
          </div>
          ${consent.acceptedAt ? `<div class="consent-date">${formatDateTime(consent.acceptedAt)}</div>` : ''}
          ${consent.version    ? `<div class="consent-date">Version ${consent.version}</div>` : ''}
        </div>
        <div class="consent-item">
          <div class="consent-label">Consent withdrawn</div>
          <div class="consent-value ${consent.withdrawn ? 'status-alert' : 'status-ok'}">
            ${consent.withdrawn ? '✕ Withdrawn' : '✓ Active'}
          </div>
          ${consent.withdrawnAt ? `<div class="consent-date">${formatDateTime(consent.withdrawnAt)}</div>` : ''}
        </div>
        <div class="consent-item">
          <div class="consent-label">Account deletion</div>
          <div class="consent-value ${accountStatus.isScheduledForDeletion ? 'status-alert' : 'status-ok'}">
            ${accountStatus.isScheduledForDeletion ? '⚠ Scheduled' : '✓ Active'}
          </div>
          ${accountStatus.scheduledDeletionDate
            ? `<div class="consent-date">Requested on ${formatDateTime(accountStatus.scheduledDeletionDate)}</div>`
            : ''}
        </div>
        <div class="consent-item">
          <div class="consent-label">Data scope</div>
          <div class="consent-value status-ok">GDPR compliant</div>
          <div class="consent-date">Sensitive fields excluded</div>
        </div>
      </div>
    </div>
  </div>

</div><!-- /wrapper -->

<div class="footer">
  This document was automatically generated and contains your personal data as stored by <strong>Syni</strong>.<br/>
  Export date: ${formatDateTime(data.exportDate)} · Do not share this file with third parties.
</div>

</body>
</html>`;
}

module.exports = generateExportHTML;