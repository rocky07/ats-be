/**
 * Bourntec ATS — embeddable open-jobs widget.
 *
 * Usage: paste this on any page (e.g. bourntec.com/about/join-us) —
 *
 *   <div id="bourntec-jobs-widget"></div>
 *   <script src="https://YOUR-ATS-BACKEND/public-widget/bourntec-jobs-widget.js"
 *           data-api="https://YOUR-ATS-BACKEND/api/public/jobs"
 *           data-apply-base="https://YOUR-ATS-FRONTEND/apply"></script>
 *
 * Each listing links to `${data-apply-base}/{jobId}` — the ATS's public
 * apply page, where candidates upload their resume directly into the pipeline.
 * A region filter (US / Middle East / India / All) is shown above the list,
 * driven by each requirement's `regions` field.
 */
(function () {
  var REGIONS = [
    { value: 'all', label: 'All Regions' },
    { value: 'us', label: 'US' },
    { value: 'middleeast', label: 'Middle East' },
    { value: 'india', label: 'India' },
  ];

  var scriptTag = document.currentScript;
  var apiUrl = scriptTag.getAttribute('data-api');
  var applyBase = scriptTag.getAttribute('data-apply-base');
  var mountId = scriptTag.getAttribute('data-mount') || 'bourntec-jobs-widget';

  if (!apiUrl || !applyBase) {
    console.error('[bourntec-jobs-widget] Missing required data-api / data-apply-base attributes.');
    return;
  }

  var mount = document.getElementById(mountId);
  if (!mount) {
    console.error('[bourntec-jobs-widget] No element with id="' + mountId + '" found on the page.');
    return;
  }

  var style = document.createElement('style');
  style.textContent =
    '.btw-wrap{font-family:inherit;max-width:900px;margin:0 auto;}' +
    '.btw-filters{display:flex;justify-content:center;gap:8px;margin-bottom:16px;flex-wrap:wrap;}' +
    '.btw-filter-btn{background:#fff;border:1px solid transparent;color:#0b2545;font-size:13px;' +
      'font-weight:600;padding:8px 16px;border-radius:999px;cursor:pointer;transition:all .15s;}' +
    '.btw-filter-btn:hover{background:#eef4ff;}' +
    '.btw-filter-btn.active{background:#1450c9;color:#fff;}' +
    '.btw-list{display:flex;flex-direction:column;gap:12px;}' +
    '.btw-card{display:flex;justify-content:space-between;align-items:center;gap:16px;' +
      'background:#fff;border-radius:10px;padding:16px 20px;box-shadow:0 2px 10px rgba(0,0,0,0.08);}' +
    '.btw-title{font-size:16px;font-weight:700;color:#0b2545;margin:0 0 4px;}' +
    '.btw-meta{font-size:13px;color:#5c6b7a;}' +
    '.btw-tag{display:inline-block;background:#eef4ff;color:#1450c9;border-radius:999px;' +
      'padding:2px 10px;font-size:11px;font-weight:600;margin-right:6px;text-transform:uppercase;}' +
    '.btw-apply{flex-shrink:0;background:#1450c9;color:#fff;text-decoration:none;font-weight:600;' +
      'font-size:14px;padding:10px 20px;border-radius:8px;transition:background .15s;}' +
    '.btw-apply:hover{background:#0e3a9c;}' +
    '.btw-empty,.btw-error{color:#fff;text-align:center;padding:24px;font-size:14px;}';
  document.head.appendChild(style);

  mount.innerHTML = '<div class="btw-wrap"><div class="btw-empty">Loading open positions…</div></div>';

  var allJobs = [];
  var activeRegion = 'all';

  fetch(apiUrl)
    .then(function (res) {
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      return res.json();
    })
    .then(function (jobs) {
      allJobs = jobs || [];
      render();
    })
    .catch(function (err) {
      console.error('[bourntec-jobs-widget] Failed to load jobs:', err);
      mount.innerHTML = '<div class="btw-wrap"><div class="btw-error">Couldn\'t load open positions. Please try again later.</div></div>';
    });

  function regionLabel(value) {
    var r = REGIONS.filter(function (r) { return r.value === value; })[0];
    return r ? r.label : value;
  }

  function render() {
    var wrap = document.createElement('div');
    wrap.className = 'btw-wrap';

    // Only show the filter bar if at least one job actually has regions set.
    var hasRegionData = allJobs.some(function (j) { return (j.regions || []).length > 0; });
    if (hasRegionData) {
      var filters = document.createElement('div');
      filters.className = 'btw-filters';
      REGIONS.forEach(function (r) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btw-filter-btn' + (activeRegion === r.value ? ' active' : '');
        btn.textContent = r.label;
        btn.addEventListener('click', function () {
          activeRegion = r.value;
          render();
        });
        filters.appendChild(btn);
      });
      wrap.appendChild(filters);
    }

    var filtered = activeRegion === 'all'
      ? allJobs
      : allJobs.filter(function (j) { return (j.regions || []).indexOf(activeRegion) !== -1; });

    if (filtered.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'btw-empty';
      empty.textContent = allJobs.length === 0
        ? 'No open positions right now — check back soon.'
        : 'No open positions in ' + regionLabel(activeRegion) + ' right now.';
      wrap.appendChild(empty);
      mount.innerHTML = '';
      mount.appendChild(wrap);
      return;
    }

    var list = document.createElement('div');
    list.className = 'btw-list';

    filtered.forEach(function (job) {
      var card = document.createElement('div');
      card.className = 'btw-card';

      var meta = [job.department, job.location, job.workMode].filter(Boolean).join(' · ');
      var regionTags = (job.regions || [])
        .map(function (r) { return '<span class="btw-tag">' + escapeHtml(regionLabel(r)) + '</span>'; })
        .join('');

      card.innerHTML =
        '<div>' +
          '<p class="btw-title">' + escapeHtml(job.title) + '</p>' +
          '<div class="btw-meta">' + escapeHtml(meta) + '</div>' +
          (regionTags ? '<div style="margin-top:6px">' + regionTags + '</div>' : '') +
        '</div>' +
        '<a class="btw-apply" href="' + applyBase + '/' + encodeURIComponent(job.id) + '" target="_blank" rel="noopener">Apply Now</a>';

      list.appendChild(card);
    });

    wrap.appendChild(list);
    mount.innerHTML = '';
    mount.appendChild(wrap);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
})();
