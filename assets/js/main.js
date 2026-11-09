/* Night Edition — progressive enhancements; pages work without this file. */
(function () {
    'use strict';

    var CJK = /[㐀-鿿豈-﫿]/g;

    function store(key, value) {
        try {
            if (value === undefined) { return window.localStorage.getItem(key); }
            window.localStorage.setItem(key, value);
        } catch (e) { /* storage unavailable */ }
        return null;
    }

    // Film grain: rendered once to a small tile, then laid over stills by CSS.
    function grain() {
        if (document.body.classList.contains('no-grain')) { return; }
        try {
            var c = document.createElement('canvas');
            c.width = c.height = 160;
            var x = c.getContext('2d');
            var d = x.createImageData(160, 160);
            for (var i = 0; i < d.data.length; i += 4) {
                var v = Math.random() * 255;
                d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
                d.data[i + 3] = 255;
            }
            x.putImageData(d, 0, 0);
            document.documentElement.style.setProperty('--grain', 'url(' + c.toDataURL() + ')');
        } catch (e) { /* no grain */ }
    }

    // Mark Chinese text so it gets the right font, spacing and line breaking.
    function chineseShare(text) {
        var t = (text || '').replace(/\s+/g, '');
        if (!t.length) { return 0; }
        return (t.match(CJK) || []).length / t.length;
    }
    function detectLang(root) {
        root.querySelectorAll('[data-detect-lang]').forEach(function (el) {
            if (el.hasAttribute('lang')) { return; }
            if (chineseShare(el.textContent) > 0.3) { el.setAttribute('lang', el.closest('[lang="zh-Hans"]') ? 'zh-Hans' : 'zh-Hant'); }
        });
    }

    // Ghost's reading time, computed for one language at a time (275 wpm, one CJK character counts as one word).
    function minutes(el) {
        var text = el.textContent || '';
        var cjk = (text.match(CJK) || []).length;
        var words = (text.replace(CJK, ' ').match(/[A-Za-z0-9À-ɏ'’-]+/g) || []).length;
        var images = el.querySelectorAll('img').length;
        var seconds = (cjk + words) / (275 / 60);
        for (var n = 12; n > 12 - images; n--) { seconds += Math.max(n, 3); }
        return Math.max(1, Math.round(seconds / 60));
    }

    function prepContent(content) {
        content.querySelectorAll('table').forEach(function (t) {
            if (t.parentElement.classList.contains('table-wrap')) { return; }
            var w = document.createElement('div');
            w.className = 'table-wrap';
            w.tabIndex = 0;
            w.setAttribute('role', 'region');
            w.setAttribute('aria-label', 'Table');
            t.replaceWith(w);
            w.appendChild(t);
        });
        content.querySelectorAll('pre > code').forEach(function (c) {
            var m = (c.className || '').match(/language-([\w-]+)/);
            if (m) { c.parentElement.setAttribute('data-lang', m[1]); }
        });
        content.querySelectorAll('.kg-image-card').forEach(function (f) {
            var img = f.querySelector('img');
            var w = img && +img.getAttribute('width');
            var h = img && +img.getAttribute('height');
            if (w && h && h > w * 1.15) { f.classList.add('is-tall'); }
        });
    }

    // Headings become numbered scenes.
    function scenes(scope) {
        var n = 0;
        scope.querySelectorAll(':scope > h2, :scope > .lang-block > h2').forEach(function (h) {
            if (h.querySelector('.scene')) { return; }
            n++;
            var s = document.createElement('span');
            s.className = 'scene';
            s.setAttribute('aria-hidden', 'true');
            s.textContent = 'Sc. ' + String(n).padStart(2, '0');
            h.prepend(s);
        });
    }

    // A post tagged #bilingual holds its Chinese text, a divider, then its English text.
    // Split at the first divider and let the reader choose a subtitle track.
    function bilingual(content) {
        var kids = Array.prototype.slice.call(content.children);
        var at = kids.findIndex(function (n) { return n.tagName === 'HR'; });
        if (at < 1 || at === kids.length - 1) { return; }

        var zh = document.createElement('section');
        var en = document.createElement('section');
        zh.className = en.className = 'lang-block';
        var simplified = content.closest('[lang="zh-Hans"]');
        zh.setAttribute('lang', simplified ? 'zh-Hans' : 'zh-Hant');
        en.setAttribute('lang', 'en');
        kids.forEach(function (n, i) {
            if (i < at) {
                var marker = n.tagName === 'P' && /english version follows/i.test(n.textContent) && n.textContent.trim().length < 40;
                if (marker) { n.remove(); } else { zh.appendChild(n); }
            } else if (i > at) {
                en.appendChild(n);
            } else {
                n.remove();
            }
        });
        content.append(zh, en);
        scenes(zh);
        scenes(en);

        var article = content.closest('article') || document;
        var switcher = article.querySelector('.lang-switch');
        var buttons = article.querySelectorAll('[data-setlang]');
        var reading = article.querySelector('[data-reading-time]');
        var mins = {zh: minutes(zh), en: minutes(en)};

        function apply(lang) {
            zh.hidden = lang !== 'zh';
            en.hidden = lang !== 'en';
            buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-setlang') === lang)); });
            if (reading) { reading.textContent = mins[lang] + ' min · ' + (lang === 'zh' ? '中文' : 'English'); }
        }
        buttons.forEach(function (b) {
            b.addEventListener('click', function () {
                var lang = b.getAttribute('data-setlang');
                store('night-edition-lang', lang);
                apply(lang);
            });
        });

        var pref = document.body.getAttribute('data-default-lang');
        var saved = store('night-edition-lang');
        var browser = (navigator.language || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
        var initial = saved === 'zh' || saved === 'en' ? saved : pref === '中文' ? 'zh' : pref === 'English' ? 'en' : browser;
        if (switcher) { switcher.hidden = false; }
        apply(initial);
    }

    // Portrait feature images are pillarboxed.
    function stills() {
        document.querySelectorAll('.feature .still img').forEach(function (img) {
            function check() {
                if (img.naturalWidth && img.naturalHeight > img.naturalWidth * 0.95) {
                    img.closest('.still').classList.add('is-portrait');
                }
            }
            if (img.complete) { check(); } else { img.addEventListener('load', check, {once: true}); }
        });
    }

    // The home title card fills one line of its column, like a film's opening title.
    // Where one line would be too small (phones), it wraps at the CSS size.
    function fitTitle() {
        var h = document.querySelector('.title-card:not(.title-card-sm) h1');
        if (!h) { return; }
        function fit() {
            h.style.fontSize = '';
            h.style.whiteSpace = 'nowrap';
            var box = getComputedStyle(h.parentElement);
            var avail = h.parentElement.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
            var fitted = Math.min(260, parseFloat(getComputedStyle(h).fontSize) * avail / h.scrollWidth);
            if (fitted >= 56) {
                h.style.fontSize = Math.floor(fitted) + 'px';
            } else {
                h.style.whiteSpace = '';
            }
        }
        fit();
        if (document.fonts && document.fonts.ready) { document.fonts.ready.then(fit); }
        var t;
        window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fit, 120); });
    }

    // On phones the nav links live in a full-screen menu.
    function menu() {
        var btn = document.querySelector('[data-menu]');
        var panel = document.querySelector('[data-menu-panel]');
        if (!btn || !panel) { return; }
        var here = location.pathname;
        panel.querySelectorAll('a[href]').forEach(function (a) {
            if (a.pathname === here && a.getAttribute('href').charAt(0) !== '#') { a.setAttribute('aria-current', 'page'); }
        });
        function set(open) {
            panel.hidden = !open;
            btn.setAttribute('aria-expanded', String(open));
            document.documentElement.classList.toggle('menu-open', open);
            if (open) { panel.querySelector('.menu-list a').focus(); } else { btn.focus(); }
        }
        btn.addEventListener('click', function () { set(true); });
        panel.querySelectorAll('[data-menu-close]').forEach(function (b) { b.addEventListener('click', function () { set(false); }); });
        panel.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () {
                panel.hidden = true;
                btn.setAttribute('aria-expanded', 'false');
                document.documentElement.classList.remove('menu-open');
            });
        });
        panel.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.stopPropagation(); set(false); }
        });
    }

    // Search opens full screen; the query is typed like a subtitle and results are small title cards.
    function search() {
        if (!window.themeSearch) { return; }
        var tz = document.body.getAttribute('data-timezone') || undefined;
        var day;
        try { day = new Intl.DateTimeFormat('en-GB', {timeZone: tz, day: '2-digit', month: 'short', year: 'numeric'}); } catch (e) { day = new Intl.DateTimeFormat('en-GB', {day: '2-digit', month: 'short', year: 'numeric'}); }
        window.themeSearch({
            render: function (it, h) {
                var zh = chineseShare(it.title) > 0.3 ? ' lang="zh-Hant"' : '';
                var zhx = chineseShare(h.snippet) > 0.3 ? ' lang="zh-Hant"' : '';
                return '<a href="' + h.esc(it.url) + '">' +
                    '<span class="s-meta">' + day.format(new Date(it.date)) + (it.mins ? ' · ' + it.mins + ' min' : '') + '</span>' +
                    '<span class="s-t"' + zh + '>' + h.mark(it.title, h.terms) + '</span>' +
                    '<span class="s-x"' + zhx + '>' + h.mark(h.snippet, h.terms) + '</span></a>';
            },
            text: {
                loading: 'Loading…',
                recent: '',
                found: function (n) { return n === 1 ? '1 story' : n + ' stories'; },
                none: 'No stories match · 沒有找到',
                error: 'Search is unavailable right now'
            }
        });
    }

    // Video embeds arrive at a fixed size (often 200×113); scale them to the column, keeping their shape.
    function embeds() {
        document.querySelectorAll('.gh-content .kg-embed-card iframe[width][height]').forEach(function (f) {
            var w = parseFloat(f.getAttribute('width'));
            var h = parseFloat(f.getAttribute('height'));
            if (w > 0 && h > 0 && !/%/.test(f.getAttribute('width'))) {
                f.style.aspectRatio = w + ' / ' + h;
                f.classList.add('is-fluid');
            }
        });
    }

    function init() {
        embeds();
        grain();
        stills();
        fitTitle();
        menu();
        search();
        var content = document.querySelector('.post-template .gh-content, .page-template .gh-content');
        if (content) {
            prepContent(content);
            var article = content.closest('article');
            if (article && !article.hasAttribute('lang') && chineseShare(content.textContent) > 0.3) {
                article.setAttribute('lang', 'zh-Hant');
            }
            if (content.hasAttribute('data-bilingual')) {
                bilingual(content);
            } else if (document.body.classList.contains('post-template')) {
                scenes(content);
            }
        }
        detectLang(document);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
