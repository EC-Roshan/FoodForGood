// js/login-page.js — Session-aware role selection page for Food For Good
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // 1. Session check & dynamic dashboard button + "You are logged in as..." bar
  if (typeof FFGStore !== 'undefined') {
    const session = FFGStore.getSession();
    if (session && session.role) {
      const user = FFGStore.getById('ffg_users', session.user_id);
      let displayName = user ? user.full_name : 'User';
      let dashboardUrl = 'index.html';
      let targetCardSelector = '';
      let roleDisplay = '';

      if (session.role === 'donor') {
        const donor = FFGStore.findBy('ffg_donors', 'user_id', session.user_id);
        if (donor && donor.org_name) displayName = donor.org_name;
        dashboardUrl = 'donor-dashboard.html';
        targetCardSelector = '.donor-card';
        roleDisplay = 'Donor';
      } else if (session.role === 'ngo') {
        const ngo = FFGStore.findBy('ffg_ngos', 'user_id', session.user_id);
        if (ngo && ngo.ngo_name) displayName = ngo.ngo_name;
        dashboardUrl = 'ngo-dashboard.html';
        targetCardSelector = '.ngo-card';
        roleDisplay = 'NGO';
      } else if (session.role === 'admin') {
        dashboardUrl = 'admin-dashboard.html';
        targetCardSelector = '.admin-card';
        roleDisplay = 'Administrator';
      }

      // Update matching role card button
      if (targetCardSelector) {
        const targetCard = document.querySelector(targetCardSelector);
        if (targetCard) {
          const btn = targetCard.querySelector('.login-btn');
          if (btn) {
            btn.innerHTML = 'Go to Dashboard <span>&rarr;</span>';
            btn.href = dashboardUrl;
          }
        }
      }

      // Add "You are logged in as <name>" bar
      const roleContainer = document.querySelector('.role-container');
      if (roleContainer && !document.getElementById('session-bar')) {
        const bar = document.createElement('div');
        bar.id = 'session-bar';
        bar.className = 'session-bar';
        bar.innerHTML = `
          <span>&#128075; You are logged in as <strong>${escapeHtml(displayName)}</strong> (${roleDisplay})</span>
          <a href="#" id="session-logout" class="session-logout-btn">Logout</a>
        `;
        roleContainer.parentNode.insertBefore(bar, roleContainer);

        const logoutBtn = document.getElementById('session-logout');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            FFGStore.logout();
          });
        }
      }
    }
  }

  // 2. Keyboard accessibility: cards are focusable and Enter triggers the link
  document.querySelectorAll('.role-card').forEach(card => {
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'group');
    const heading = card.querySelector('h2');
    if (heading) {
      card.setAttribute('aria-label', heading.textContent.trim() + ' Role Option');
    }

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const btn = card.querySelector('.login-btn');
        if (btn) {
          btn.click();
        }
      }
    });
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});
