/* Kinetic analytics - product funnel capture (PostHog, US Cloud).
 * Public ingest key (phc_) by design; identified_only, no PII captured here.
 * Canonical taxonomy v1: product=api, surface=marketing.
 * Exposes window.kxTrack(event, props) - safe no-op if load is blocked. */
(function () {
  'use strict';
  var INGEST_KEY = 'phc_DiLaRwy5AYnpcK4uxXum6qDbmTAwtD9ijk5wrt6X94Wc';
  var API_HOST = 'https://us.i.posthog.com';
  var host = (location.hostname || '').toLowerCase();
  var ENVIRONMENT = (host === 'kineticanvil.com' || host === 'www.kineticanvil.com') ? 'prod' : 'staging';

  // Queue any pre-init calls so funnel events never get dropped.
  var _q = [];
  window.kxTrack = function (event, props) {
    try {
      if (window.posthog && window.posthog.__loaded) {
        window.posthog.capture(event, props || {});
      } else {
        _q.push([event, props || {}]);
      }
    } catch (e) { /* never break the page for analytics */ }
  };

  // Official PostHog snippet (loads array.js from US assets host).
  !function (t, e) { var o, n, p, r; e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } (p = t.createElement("script")).type = "text/javascript", p.crossOrigin = "anonymous", p.async = !0, p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js", (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r); var u = e; for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e }, u.people.toString = function () { return u.toString(1) + ".people (stub)" }, o = "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "), n = 0; n < o.length; n++)g(u, o[n]); e._i.push([i, s, a]) }, e.__SV = 1) }(document, window.posthog || []);

  window.posthog.init(INGEST_KEY, {
    api_host: API_HOST,
    person_profiles: 'identified_only',
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    loaded: function (ph) {
      ph.register({ product: 'api', surface: 'marketing', environment: ENVIRONMENT });
      // flush anything queued before load
      for (var i = 0; i < _q.length; i++) { try { ph.capture(_q[i][0], _q[i][1]); } catch (e) {} }
      _q.length = 0;
    }
  });

  // Delegated CTA capture: any sandbox on-ramp link/button -> cta_clicked.
  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('a,button') : null;
    if (!el) return;
    var href = (el.getAttribute && el.getAttribute('href')) || '';
    var isSandbox = href.indexOf('/sandbox') === 0;
    var explicit = el.getAttribute && el.getAttribute('data-cta');
    if (!isSandbox && !explicit) return;
    var label = (el.textContent || '').trim().slice(0, 60);
    window.kxTrack('cta_clicked', {
      cta_id: explicit || ('sandbox_onramp:' + (label || href)),
      surface: 'marketing',
      destination: href || null
    });
  }, true);
})();
