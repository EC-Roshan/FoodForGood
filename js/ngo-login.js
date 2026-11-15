// js/ngo-login.js — NGO login logic for Food For Good
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Guard: already logged in as NGO?
  if (typeof FFGStore !== 'undefined') {
    const session = FFGStore.getSession();
    if (session && session.role === 'ngo') {
      window.location.href = 'ngo-dashboard.html';
      return;
    }
  }

  const form = document.getElementById('ngo-login-form');
  const errorBox = document.getElementById('login-error');
  const forgotLink = document.getElementById('forgot-link');
  const forgotPanel = document.getElementById('forgot-panel');
  const fpCancel = document.getElementById('fp-cancel');
  const fpSubmit = document.getElementById('fp-submit');

  // Toggle forgot password panel
  if (forgotLink && forgotPanel) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      forgotPanel.style.display = forgotPanel.style.display === 'none' ? 'block' : 'none';
    });
  }
  if (fpCancel && forgotPanel) {
    fpCancel.addEventListener('click', (e) => {
      e.preventDefault();
      forgotPanel.style.display = 'none';
    });
  }

  // Login form submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorBox) errorBox.style.display = 'none';

      const email = document.getElementById('email').value.trim().toLowerCase();
      const password = document.getElementById('password').value;
      const remember = document.getElementById('remember') ? document.getElementById('remember').checked : false;

      const hash = await FFGStore.hashPassword(password);
      const user = FFGStore.findBy('ffg_users', 'email', email);

      if (!user || user.password_hash !== hash || user.role !== 'ngo') {
        showError('Invalid email or password.');
        return;
      }

      if (user.status === 'blocked') {
        showError('Your account has been blocked. Please contact support.');
        return;
      }

      FFGStore.setSession(user, remember);
      window.location.href = 'ngo-dashboard.html';
    });
  }

  // Forgot Password submit (prototype)
  if (fpSubmit) {
    fpSubmit.addEventListener('click', async () => {
      const fpErrorEl = document.getElementById('fp-error');
      const fpSuccessEl = document.getElementById('fp-success');
      if (fpErrorEl) fpErrorEl.style.display = 'none';
      if (fpSuccessEl) fpSuccessEl.style.display = 'none';

      const email = document.getElementById('fp-email').value.trim().toLowerCase();
      const phone = document.getElementById('fp-phone').value.trim();
      const newPw = document.getElementById('fp-new-pw').value;
      const confirmPw = document.getElementById('fp-confirm-pw').value;

      const user = FFGStore.findBy('ffg_users', 'email', email);
      if (!user || user.phone !== phone || user.role !== 'ngo') {
        if (fpErrorEl) {
          fpErrorEl.textContent = 'No NGO account found with that email and phone combination.';
          fpErrorEl.style.display = 'block';
        }
        return;
      }

      if (newPw.length < 8 || !/[a-zA-Z]/.test(newPw) || !/[0-9]/.test(newPw)) {
        if (fpErrorEl) {
          fpErrorEl.textContent = 'Password must be at least 8 characters with a letter and a number.';
          fpErrorEl.style.display = 'block';
        }
        return;
      }

      if (newPw !== confirmPw) {
        if (fpErrorEl) {
          fpErrorEl.textContent = 'Passwords do not match.';
          fpErrorEl.style.display = 'block';
        }
        return;
      }

      const hash = await FFGStore.hashPassword(newPw);
      FFGStore.update('ffg_users', user.user_id, { password_hash: hash });
      if (fpSuccessEl) {
        fpSuccessEl.textContent = 'Password reset successfully! You can now log in.';
        fpSuccessEl.style.display = 'block';
      }
      document.getElementById('fp-new-pw').value = '';
      document.getElementById('fp-confirm-pw').value = '';
    });
  }

  function showError(msg) {
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    }
  }
});

