'use strict';

/**
 * Browser-side DOM scan for Connect login detection.
 *
 * MUST stay plain CommonJS JavaScript.
 * Playwright serializes this function into Chromium via Function.prototype.toString().
 * If this file is compiled by tsx/esbuild, injected `__name` helpers break in the browser
 * with: ReferenceError: __name is not defined.
 *
 * @param {{
 *   avatarSelectors: string[],
 *   editSelectors: string[],
 *   logoutSelectors: string[],
 *   nameSelectors: string[],
 * }} args
 */
function scanFrameDomInBrowser(args) {
  var avatarSelectors = args.avatarSelectors || [];
  var editSelectors = args.editSelectors || [];
  var logoutSelectors = args.logoutSelectors || [];
  var nameSelectors = args.nameSelectors || [];

  var attemptedSelectors = [];
  var i;
  for (i = 0; i < avatarSelectors.length; i++) attemptedSelectors.push('avatar:' + avatarSelectors[i]);
  for (i = 0; i < editSelectors.length; i++) attemptedSelectors.push('edit:' + editSelectors[i]);
  for (i = 0; i < logoutSelectors.length; i++) attemptedSelectors.push('logout:' + logoutSelectors[i]);
  for (i = 0; i < nameSelectors.length; i++) attemptedSelectors.push('name:' + nameSelectors[i]);
  attemptedSelectors.push(
    'text:edit profile',
    'text:logout',
    'heuristic:img-profile',
    'heuristic:account-name-lines',
    'shadow:walk',
    'iframe:count',
  );

  var candidates = {
    avatars: [],
    names: [],
    editProfile: [],
    links: [],
  };
  var matchedSelectors = [];

  function hasSel(root, sel) {
    try {
      return Boolean(root.querySelector(sel));
    } catch (e) {
      return false;
    }
  }

  var roots = [document];
  var shadowHostCount = 0;

  function walkShadows(node) {
    var els;
    try {
      els = Array.prototype.slice.call(node.querySelectorAll('*'));
    } catch (e) {
      return;
    }
    for (var ei = 0; ei < els.length; ei++) {
      var el = els[ei];
      var sr = el.shadowRoot;
      if (sr) {
        shadowHostCount += 1;
        roots.push(sr);
        walkShadows(sr);
      }
    }
  }
  walkShadows(document);

  var iframeCount = document.querySelectorAll('iframe').length;

  function collectText(root) {
    try {
      if (root === document) return (document.body && document.body.innerText ? document.body.innerText : '').toLowerCase();
      return (root.textContent || '').toLowerCase();
    } catch (e) {
      return '';
    }
  }

  var text = '';
  for (i = 0; i < roots.length; i++) text += '\n' + collectText(roots[i]);
  text = text.toLowerCase();

  var hasAvatar = false;
  for (i = 0; i < avatarSelectors.length; i++) {
    for (var ri = 0; ri < roots.length; ri++) {
      if (hasSel(roots[ri], avatarSelectors[i])) {
        hasAvatar = true;
        matchedSelectors.push('avatar:' + avatarSelectors[i]);
        break;
      }
    }
    if (hasAvatar) break;
  }

  for (ri = 0; ri < roots.length; ri++) {
    var imgs = Array.prototype.slice.call(roots[ri].querySelectorAll('img'), 0, 25);
    for (var ii = 0; ii < imgs.length; ii++) {
      var img = imgs[ii];
      var alt = img.getAttribute('alt') || '';
      var cls = img.getAttribute('class') || '';
      var src = (img.getAttribute('src') || '').slice(0, 120);
      var w = img.width || 0;
      var h = img.height || 0;
      candidates.avatars.push(
        'alt="' + alt + '" class="' + cls.slice(0, 80) + '" src="' + src + '" ' + w + 'x' + h,
      );
      if (!hasAvatar) {
        var blob = (alt + ' ' + cls + ' ' + src).toLowerCase();
        if (
          /avatar|profile|user|photo|picture/.test(blob) ||
          (w > 0 &&
            w <= 128 &&
            h > 0 &&
            h <= 128 &&
            /user-profile|profile|account/.test(location.pathname))
        ) {
          hasAvatar = true;
          matchedSelectors.push('heuristic:img-profile');
        }
      }
    }
  }
  candidates.avatars = candidates.avatars.slice(0, 12);

  var hasEditProfile = /edit\s*profile|update\s*profile|manage\s*profile/.test(text);
  if (hasEditProfile) matchedSelectors.push('text:edit profile');
  for (i = 0; i < editSelectors.length; i++) {
    for (ri = 0; ri < roots.length; ri++) {
      if (hasSel(roots[ri], editSelectors[i])) {
        hasEditProfile = true;
        matchedSelectors.push('edit:' + editSelectors[i]);
      }
    }
  }
  for (ri = 0; ri < roots.length; ri++) {
    var nodes = Array.prototype.slice.call(
      roots[ri].querySelectorAll('a,button,[role="button"]'),
      0,
      80,
    );
    for (var ni = 0; ni < nodes.length; ni++) {
      var elN = nodes[ni];
      var label = (elN.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      var href = elN.getAttribute ? elN.getAttribute('href') || '' : '';
      if (/edit|profile/i.test(label + ' ' + href)) {
        candidates.editProfile.push('"' + label + '" href=' + href.slice(0, 100));
      }
    }
  }
  candidates.editProfile = candidates.editProfile.slice(0, 12);

  var hasLogout = /log\s*out|sign\s*out|signout/.test(text);
  if (hasLogout) matchedSelectors.push('text:logout');
  for (i = 0; i < logoutSelectors.length; i++) {
    for (ri = 0; ri < roots.length; ri++) {
      if (hasSel(roots[ri], logoutSelectors[i])) {
        hasLogout = true;
        matchedSelectors.push('logout:' + logoutSelectors[i]);
      }
    }
  }

  var hasProfileLink = /my\s*profile|user\s*profile|view\s*profile|account\s*settings/.test(text);
  for (ri = 0; ri < roots.length; ri++) {
    if (hasSel(roots[ri], 'a[href*="user-profile"]') || hasSel(roots[ri], 'a[href*="/my-profile"]')) {
      hasProfileLink = true;
      matchedSelectors.push('profile-link');
    }
    var links = Array.prototype.slice.call(roots[ri].querySelectorAll('a[href]'), 0, 40);
    for (var li = 0; li < links.length; li++) {
      var a = links[li];
      var ahref = a.getAttribute('href') || '';
      var alabel = (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (/profile|account|logout|login/i.test(ahref + ' ' + alabel)) {
        candidates.links.push('"' + alabel + '" href=' + ahref.slice(0, 100));
      }
    }
  }
  candidates.links = candidates.links.slice(0, 12);

  function looksLikeLoginCta(t) {
    return /sign\s*in|log\s*in|enter\s*otp|phone\s*number|get\s*otp|verify|continue|housing\.com|things you can do|magicbricks account|with magicbricks/i.test(
      t,
    );
  }

  var hasAccountName = false;
  for (i = 0; i < nameSelectors.length; i++) {
    for (ri = 0; ri < roots.length; ri++) {
      var nameNodes = Array.prototype.slice.call(roots[ri].querySelectorAll(nameSelectors[i]), 0, 10);
      for (var nj = 0; nj < nameNodes.length; nj++) {
        var nt = (nameNodes[nj].textContent || '').trim().replace(/\s+/g, ' ');
        if (nt.length >= 2 && nt.length <= 80) {
          candidates.names.push('[' + nameSelectors[i] + '] ' + nt);
          if (!looksLikeLoginCta(nt)) {
            hasAccountName = true;
            matchedSelectors.push('name:' + nameSelectors[i]);
          }
        }
      }
    }
  }
  if (!hasAccountName && /user-profile|my-profile|\/profile/.test(location.pathname)) {
    var shortLines = text
      .split('\n')
      .map(function (l) {
        return l.trim();
      })
      .filter(function (l) {
        return l.length >= 2 && l.length <= 48;
      });
    for (i = 0; i < Math.min(30, shortLines.length); i++) {
      candidates.names.push('[line] ' + shortLines[i]);
    }
    hasAccountName = shortLines.some(function (l) {
      return (
        !looksLikeLoginCta(l) &&
        !/edit\s*profile|log\s*out|settings|notifications|wishlist|saved|help|support/.test(l) &&
        /^[a-z][a-z\s.'.-]{1,46}$/i.test(l)
      );
    });
    if (hasAccountName) matchedSelectors.push('heuristic:account-name-lines');
  }
  candidates.names = candidates.names.slice(0, 12);

  var hasLoginForm =
    Boolean(document.querySelector('input[type="password"]')) ||
    Boolean(
      document.querySelector(
        'input[name*="otp"], input[placeholder*="otp"], input[autocomplete="one-time-code"]',
      ),
    ) ||
    (/enter\s*otp|enter\s*password|get\s*otp|request\s*otp|verify\s*otp/.test(text) &&
      Boolean(document.querySelector('input')));

  var html = (document.documentElement && document.documentElement.outerHTML
    ? document.documentElement.outerHTML
    : ''
  ).slice(0, 6000);

  return {
    frameUrl: location.href,
    readyState: document.readyState || 'unknown',
    iframeCount: iframeCount,
    shadowHostCount: shadowHostCount,
    hasAvatar: hasAvatar,
    hasAccountName: hasAccountName,
    hasEditProfile: hasEditProfile,
    hasLogout: hasLogout,
    hasProfileLink: hasProfileLink,
    hasLoginForm: hasLoginForm,
    matchedSelectors: matchedSelectors,
    attemptedSelectors: attemptedSelectors,
    candidates: candidates,
    textSample: text.slice(0, 2500),
    htmlSample: html,
  };
}

module.exports = {
  scanFrameDomInBrowser: scanFrameDomInBrowser,
};
