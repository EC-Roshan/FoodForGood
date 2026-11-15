// js/ngo-signup.js — NGO sign-up logic for Food For Good
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const form = document.getElementById('ngo-signup-form');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm-password');
  const strengthBar = document.getElementById('pw-strength-bar');
  const strengthLabel = document.getElementById('pw-strength-label');
  const matchError = document.getElementById('pw-match-error');
  const msgBox = document.getElementById('signup-message');

  const fileInput = document.getElementById('reg-cert');
  const uploadArea = document.querySelector('.file-upload-area');
  const uploadText = document.querySelector('.file-upload-text');
  const uploadHint = document.querySelector('.file-upload-hint');

  let uploadedFileName = '';

  // 1. Certificate upload validation (type: pdf/jpg/png, size <= 5 MB)
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) {
        uploadedFileName = '';
        return;
      }

      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      const ext = file.name.split('.').pop().toLowerCase();
      const validExts = ['pdf', 'jpg', 'jpeg', 'png'];

      if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
        showMessage('Invalid file type. Please upload a PDF, JPG, or PNG document.', 'error');
        fileInput.value = '';
        uploadedFileName = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showMessage('File size exceeds 5 MB. Please choose a smaller file.', 'error');
        fileInput.value = '';
        uploadedFileName = '';
        return;
      }

      uploadedFileName = file.name;
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      if (uploadText) {
        uploadText.textContent = `✓ ${file.name}`;
      }
      if (uploadHint) {
        uploadHint.textContent = `${sizeMb} MB · Click to change file`;
      }
      if (uploadArea) {
        uploadArea.style.borderColor = '#174c42';
        uploadArea.style.background = '#eaf4e8';
      }
    });
  }

  // 2. Password strength meter
  if (passwordInput && strengthBar && strengthLabel) {
    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      let score = 0;
      if (val.length >= 8) score++;
      if (/[a-zA-Z]/.test(val) && /[0-9]/.test(val)) score++;
      if (val.length >= 12 && /[^a-zA-Z0-9]/.test(val)) score++;

      const labels = ['', 'Weak', 'Medium', 'Strong'];
      const colors = ['', '#c0392b', '#e67e22', '#174c42'];
      const widths = ['0%', '33%', '66%', '100%'];

      strengthBar.style.width = widths[score] || '0%';
      strengthBar.style.background = colors[score] || 'transparent';
      strengthLabel.textContent = labels[score] || '';
      strengthLabel.style.color = colors[score] || '';
    });
  }

  // 3. Show/hide password toggles
  document.querySelectorAll('.pw-toggle').forEach(btn => {
    if (btn.dataset.pwBound) return;
    btn.dataset.pwBound = 'true';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-target');
      const inp = document.getElementById(targetId);
      if (inp) {
        const isPassword = inp.type === 'password';
        inp.type = isPassword ? 'text' : 'password';
        btn.textContent = isPassword ? '🙈' : '👁';
        btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      }
    });
  });

  // 4. Form submit handler
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (msgBox) msgBox.style.display = 'none';
      if (matchError) matchError.style.display = 'none';

      // a) Built-in HTML5 validation
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      // b) Pickup capability radio check
      const pickupSelected = form.querySelector('input[name="pickup_capability"]:checked');
      if (!pickupSelected) {
        showMessage('Please select your organization\'s pickup capability.', 'error');
        return;
      }

      const password = passwordInput.value;
      const confirmPassword = confirmInput.value;
      const email = document.getElementById('email').value.trim().toLowerCase();
      const regNumber = document.getElementById('reg-number').value.trim();

      // c) Password requires at least 1 letter and 1 number
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        showMessage('Password must contain at least one letter and one number.', 'error');
        return;
      }

      // d) Passwords must match
      if (password !== confirmPassword) {
        if (matchError) matchError.style.display = 'block';
        confirmInput.focus();
        return;
      }

      // e) Unique email check across ffg_users
      const existingUser = FFGStore.findBy('ffg_users', 'email', email);
      if (existingUser) {
        showMessage('An account with this email already exists.', 'error');
        return;
      }

      // f) Unique registration number check across ffg_ngos
      const existingNgo = FFGStore.findBy('ffg_ngos', 'reg_number', regNumber);
      if (existingNgo) {
        showMessage('An NGO with this registration number is already registered.', 'error');
        return;
      }

      // g) Hash password & insert into FFGStore
      const hash = await FFGStore.hashPassword(password);

      const user = FFGStore.insert('ffg_users', {
        full_name: document.getElementById('contact-name').value.trim(),
        email: email,
        phone: document.getElementById('phone').value.trim(),
        password_hash: hash,
        role: 'ngo',
        status: 'pending' // Pending admin verification
      });

      FFGStore.insert('ffg_ngos', {
        user_id: user.user_id,
        ngo_name: document.getElementById('org-name').value.trim(),
        reg_number: regNumber,
        contact_name: document.getElementById('contact-name').value.trim(),
        designation: document.getElementById('designation').value.trim(),
        address: document.getElementById('address').value.trim(),
        city: document.getElementById('city').value.trim(),
        pincode: document.getElementById('pincode').value.trim(),
        people_served: parseInt(document.getElementById('people-served').value, 10) || 0,
        pickup_capability: pickupSelected.value,
        certificate_file: uploadedFileName || null,
        verification_status: 'pending'
      });

      // h) Success message and redirect after 2s
      showMessage('Registration submitted! An admin will verify your organisation.', 'success');
      setTimeout(() => {
        window.location.href = 'ngo-login.html';
      }, 2000);
    });
  }

  function showMessage(text, type) {
    if (msgBox) {
      msgBox.textContent = text;
      msgBox.className = 'form-message ' + (type === 'success' ? 'form-message--success' : 'form-message--error');
      msgBox.style.display = 'block';
      msgBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
});

