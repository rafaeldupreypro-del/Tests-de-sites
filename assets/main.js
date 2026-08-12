/* =========================================================================
   ATELIER MÉRIDIEN — interactions
   ========================================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------------------------
     Année courante dans le footer
     ------------------------------------------------------------------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* -------------------------------------------------------------------
     Lien de navigation actif selon la page courante
     ------------------------------------------------------------------- */
  var current = (location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav-links a, .mobile-panel a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href === current || (current === '' && href === 'index.html')) {
      a.setAttribute('aria-current', 'page');
    }
  });

  /* -------------------------------------------------------------------
     Menu mobile
     ------------------------------------------------------------------- */
  var toggle = document.querySelector('.nav-toggle');
  var panel = document.querySelector('.mobile-panel');
  if (toggle && panel) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      panel.classList.toggle('is-open', !open);
      document.body.style.overflow = !open ? 'hidden' : '';
    });
    panel.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        toggle.setAttribute('aria-expanded', 'false');
        panel.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) {
        toggle.setAttribute('aria-expanded', 'false');
        panel.classList.remove('is-open');
        document.body.style.overflow = '';
        toggle.focus();
      }
    });
  }

  /* -------------------------------------------------------------------
     Barre de progression de lecture ("méridien")
     ------------------------------------------------------------------- */
  var progress = document.querySelector('.progress-rule');
  if (progress) {
    var ticking = false;
    function updateProgress() {
      var h = document.documentElement;
      var scrolled = h.scrollTop;
      var height = h.scrollHeight - h.clientHeight;
      var pct = height > 0 ? (scrolled / height) * 100 : 0;
      progress.style.width = pct + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(updateProgress); ticking = true; }
    }, { passive: true });
    updateProgress();
  }

  /* -------------------------------------------------------------------
     Bouton retour en haut
     ------------------------------------------------------------------- */
  var toTop = document.querySelector('.to-top');
  if (toTop) {
    window.addEventListener('scroll', function () {
      toTop.classList.toggle('is-visible', window.scrollY > 700);
    }, { passive: true });
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* -------------------------------------------------------------------
     Révélation au défilement
     ------------------------------------------------------------------- */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length) {
    if ('IntersectionObserver' in window && !reduceMotion) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    }
  }

  /* -------------------------------------------------------------------
     Filtre de la grille projets
     ------------------------------------------------------------------- */
  var filterBar = document.querySelector('.filter-bar');
  if (filterBar) {
    var items = document.querySelectorAll('.project-grid-item');
    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-btn');
      if (!btn) return;
      filterBar.querySelectorAll('.filter-btn').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      var cat = btn.dataset.filter;
      items.forEach(function (item) {
        var match = cat === 'all' || item.dataset.category === cat;
        item.classList.toggle('is-hidden', !match);
      });
    });
  }

  /* -------------------------------------------------------------------
     Configuration de l'API backend
     Déployé sur Vercel, le site statique et les fonctions /api sont
     servis sous le même domaine : un chemin relatif suffit, en local
     comme en production. Pour tester en local, utiliser `vercel dev`
     (un simple `python -m http.server` ne fait pas tourner les
     fonctions /api).
     ------------------------------------------------------------------- */
  var API_BASE = '';

  /* -------------------------------------------------------------------
     Formulaire de contact — validation + envoi au backend
     ------------------------------------------------------------------- */
  var form = document.querySelector('#contact-form');
  if (form) {
    var success = document.querySelector('.form-success');
    var submitBtn = form.querySelector('button[type="submit"]');
    var submitLabel = submitBtn ? submitBtn.innerHTML : '';
    var formErrorEl = form.querySelector('.form-global-error');

    function setError(field, message) {
      var wrap = field.closest('.field');
      var errorEl = wrap.querySelector('.field-error');
      if (message) {
        wrap.classList.add('has-error');
        if (errorEl) errorEl.textContent = message;
      } else {
        wrap.classList.remove('has-error');
      }
    }

    function setGlobalError(message) {
      if (!formErrorEl) return;
      if (message) {
        formErrorEl.textContent = message;
        formErrorEl.style.display = 'block';
      } else {
        formErrorEl.style.display = 'none';
      }
    }

    function validate() {
      var valid = true;
      var name = form.querySelector('#name');
      var email = form.querySelector('#email');
      var subject = form.querySelector('#subject');
      var message = form.querySelector('#message');

      if (!name.value.trim()) { setError(name, 'Merci d\'indiquer votre nom.'); valid = false; }
      else setError(name, '');

      var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email.value.trim())) { setError(email, 'Adresse e-mail invalide.'); valid = false; }
      else setError(email, '');

      if (!subject.value) { setError(subject, 'Merci de choisir un sujet.'); valid = false; }
      else setError(subject, '');

      if (message.value.trim().length < 20) { setError(message, 'Un message un peu plus détaillé nous aide à mieux répondre (20 caractères min.).'); valid = false; }
      else setError(message, '');

      return valid;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setGlobalError('');

      if (!validate()) {
        var firstError = form.querySelector('.has-error input, .has-error select, .has-error textarea');
        if (firstError) firstError.focus();
        return;
      }

      var payload = {
        name: form.querySelector('#name').value.trim(),
        email: form.querySelector('#email').value.trim(),
        phone: form.querySelector('#phone').value.trim(),
        subject: form.querySelector('#subject').value,
        budget: form.querySelector('#budget').value,
        message: form.querySelector('#message').value.trim(),
        company: form.querySelector('#company') ? form.querySelector('#company').value : '' // honeypot
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Envoi en cours…';
      }

      fetch(API_BASE + '/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
        .then(function (result) {
          if (result.data && result.data.ok) {
            form.style.display = 'none';
            if (success) success.classList.add('is-visible');
          } else if (result.data && result.data.errors) {
            Object.keys(result.data.errors).forEach(function (key) {
              var field = form.querySelector('#' + key);
              if (field) setError(field, result.data.errors[key]);
            });
          } else {
            setGlobalError((result.data && result.data.error) || 'Une erreur est survenue. Merci de réessayer, ou appelez-nous directement au 02 35 12 00 34.');
          }
        })
        .catch(function () {
          setGlobalError('Impossible de contacter le serveur. Vérifiez votre connexion, ou appelez-nous directement au 02 35 12 00 34.');
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = submitLabel;
          }
        });
    });

    form.querySelectorAll('input, textarea, select').forEach(function (field) {
      field.addEventListener('blur', validate);
    });
  }

  /* -------------------------------------------------------------------
     Newsletter (pied de page) — inscription via le backend
     ------------------------------------------------------------------- */
  var newsletterForms = document.querySelectorAll('.newsletter-form');
  newsletterForms.forEach(function (nlForm) {
    var input = nlForm.querySelector('input[type="email"]');
    var btn = nlForm.querySelector('button');
    var msg = nlForm.querySelector('.newsletter-msg');
    var btnLabel = btn ? btn.innerHTML : '';

    function setMsg(text, isError) {
      if (!msg) return;
      msg.textContent = text;
      msg.classList.toggle('is-error', !!isError);
      msg.classList.toggle('is-visible', !!text);
    }

    nlForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      var value = input.value.trim();
      var honeypot = nlForm.querySelector('input[name="company"]');

      if (honeypot && honeypot.value) return; // bot

      if (!emailPattern.test(value)) {
        setMsg('Adresse e-mail invalide.', true);
        input.focus();
        return;
      }

      if (btn) { btn.disabled = true; btn.innerHTML = '…'; }
      setMsg('');

      fetch(API_BASE + '/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value, company: honeypot ? honeypot.value : '' })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.ok) {
            setMsg(data.alreadySubscribed ? 'Cette adresse est déjà inscrite.' : 'Merci, votre inscription est confirmée.', false);
            nlForm.reset();
          } else {
            setMsg((data && data.error) || 'Une erreur est survenue.', true);
          }
        })
        .catch(function () {
          setMsg('Impossible de contacter le serveur pour le moment.', true);
        })
        .finally(function () {
          if (btn) { btn.disabled = false; btn.innerHTML = btnLabel; }
        });
    });
  });

})();
