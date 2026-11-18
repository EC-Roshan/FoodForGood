// js/common.js — Shared utilities for Food For Good
(function () {
  'use strict';

  /**
   * Helper to show messages (inline or toast).
   * @param {HTMLElement|string|null} container - Target container element or selector, or null for toast
   * @param {string} text - Message text
   * @param {'success'|'error'|'info'} [type='info'] - Message style type
   * @param {number} [duration=4000] - Duration in ms before auto-dismiss (for toasts)
   */
  function showMessage(container, text, type = 'info', duration = 4000) {
    let el = typeof container === 'string' ? document.querySelector(container) : container;

    if (el) {
      el.textContent = text;
      el.className = 'form-message form-message--' + type;
      el.style.display = 'block';
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return el;
    }

    // Floating toast if no container provided
    let toast = document.getElementById('ffg-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ffg-toast';
      toast.className = 'ffg-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.className = 'ffg-toast ffg-toast--' + type + ' ffg-toast--show';

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('ffg-toast--show');
    }, duration);
    return toast;
  }

  window.showMessage = showMessage;

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Automatic Password Show/Hide Toggle
    // Supports:
    // a) button.pw-toggle[data-target="id"]
    // b) input[type="password"][data-toggle]
    document.querySelectorAll('.pw-toggle').forEach(btn => {
      if (btn.dataset.pwBound) return;
      btn.dataset.pwBound = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const inp = targetId ? document.getElementById(targetId) : btn.previousElementSibling;
        if (inp && (inp.tagName === 'INPUT')) {
          const isPassword = inp.type === 'password';
          inp.type = isPassword ? 'text' : 'password';
          btn.textContent = isPassword ? '🙈' : '👁';
          btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        }
      });
    });

    document.querySelectorAll('input[type="password"][data-toggle]').forEach(inp => {
      // If no toggle button already exists next to it, wrap and attach
      if (!inp.parentElement.querySelector('.pw-toggle')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pw-toggle';
        btn.setAttribute('aria-label', 'Show password');
        btn.textContent = '👁';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const isPassword = inp.type === 'password';
          inp.type = isPassword ? 'text' : 'password';
          btn.textContent = isPassword ? '🙈' : '👁';
          btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        });
        if (inp.parentElement && !inp.parentElement.classList.contains('pw-wrap')) {
          const wrap = document.createElement('div');
          wrap.className = 'pw-wrap';
          inp.parentNode.insertBefore(wrap, inp);
          wrap.appendChild(inp);
          wrap.appendChild(btn);
        } else if (inp.parentElement) {
          inp.parentElement.appendChild(btn);
        }
      }
    });

    // 2. Automatically update footer year
    const year = new Date().getFullYear();
    document.querySelectorAll('.footer').forEach(footer => {
      let yearEl = footer.querySelector('.current-year');
      if (yearEl) {
        yearEl.textContent = year;
      } else {
        const p = footer.querySelector('p');
        if (p && !p.textContent.includes(String(year))) {
          p.innerHTML += ` &middot; &copy; <span class="current-year">${year}</span>`;
        }
      }
    });

    // 3. Navbar Login button update if session exists
    if (typeof FFGStore !== 'undefined' && typeof FFGStore.getSession === 'function') {
      const session = FFGStore.getSession();
      if (session && session.role) {
        const navLogin = document.querySelector('.nav-login');
        if (navLogin) {
          let dashboardUrl = 'login.html';
          if (session.role === 'donor') dashboardUrl = 'donor-dashboard.html';
          else if (session.role === 'ngo') dashboardUrl = 'ngo-dashboard.html';
          else if (session.role === 'admin') dashboardUrl = 'admin-dashboard.html';

          navLogin.textContent = 'Dashboard →';
          navLogin.href = dashboardUrl;

          // Add desktop logout button if not already present
          const navbar = navLogin.closest('.navbar');
          if (navbar && !navbar.querySelector('.nav-logout')) {
            const logoutLink = document.createElement('a');
            logoutLink.href = '#';
            logoutLink.className = 'nav-logout';
            logoutLink.textContent = 'Logout';
            logoutLink.style.marginLeft = '12px';
            logoutLink.style.fontSize = '13px';
            logoutLink.style.fontWeight = '600';
            logoutLink.style.color = '#64736d';
            logoutLink.style.textDecoration = 'none';
            logoutLink.addEventListener('click', (e) => {
              e.preventDefault();
              FFGStore.logout();
            });
            navLogin.parentNode.insertBefore(logoutLink, navLogin.nextSibling);
          }

          // Move logout inside hamburger dropdown menu on screens < 900px
          const navLinks = navbar ? navbar.querySelector('.nav-links') : null;
          if (navLinks && !navLinks.querySelector('.nav-logout-mobile')) {
            const mobileLogout = document.createElement('a');
            mobileLogout.href = '#';
            mobileLogout.className = 'nav-logout-mobile';
            mobileLogout.textContent = 'Logout';
            mobileLogout.addEventListener('click', (e) => {
              e.preventDefault();
              FFGStore.logout();
            });
            navLinks.appendChild(mobileLogout);
          }
        }
      }
    }
  });
})();

