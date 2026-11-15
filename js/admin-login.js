// js/admin-login.js — Admin login logic for Food For Good
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Guard: already logged in as Admin?
  if (typeof FFGStore !== 'undefined') {
    const session = FFGStore.getSession();
    if (session && session.role === 'admin') {
      window.location.href = 'admin-dashboard.html';
      return;
    }
  }

  const form = document.getElementById('admin-login-form');
  const errorBox = document.getElementById('login-error');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorBox) errorBox.style.display = 'none';

      const email = document.getElementById('email').value.trim().toLowerCase();
      const password = document.getElementById('password').value;
      const remember = document.getElementById('remember') ? document.getElementById('remember').checked : false;

      const hash = await FFGStore.hashPassword(password);
      const user = FFGStore.findBy('ffg_users', 'email', email);

      if (!user || user.password_hash !== hash || user.role !== 'admin') {
        showError('Invalid admin email or password.');
        return;
      }

      if (user.status === 'blocked') {
        showError('This admin account has been suspended.');
        return;
      }

      FFGStore.setSession(user, remember);
      window.location.href = 'admin-dashboard.html';
    });
  }

  function showError(msg) {
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    }
  }
});

