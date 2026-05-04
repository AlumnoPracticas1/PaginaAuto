/* ================================================================
 * cliente-escucha — captura de errores para cualquier web
 * Endpoint orquestador: http://<host>:8000  (main.py)
 *   /report → guarda preview
 *   /hello  → registra el cliente para "Clientes conectados"
 *
 * USO MÍNIMO (en el <head>):
 *   <script>window.APP_NAME = 'mi-web';</script>
 *   <script src="mensajes.js"></script>          (opcional, traducciones)
 *   <script src="error_capture.js"
 *           data-endpoint="http://127.0.0.1:8000"></script>
 *
 * Configuración disponible (todo opcional):
 *   window.APP_NAME              → nombre del cliente (default: hostname)
 *   window.APP_RELEASE           → versión (default: null)
 *   window.AVANTSERVICE_ENDPOINT → base del orquestador (default: http://<host>:8000)
 *   window.MENSAJES_PERSONALIZADOS → array de { match, replace } para reescribir mensajes
 * ================================================================ */
(function () {
  'use strict';

  function resolveBase() {
    try {
      if (typeof window !== 'undefined' && window.AVANTSERVICE_ENDPOINT) {
        return String(window.AVANTSERVICE_ENDPOINT).replace(/\/$/, '');
      }
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        var ds = scripts[i].getAttribute && scripts[i].getAttribute('data-endpoint');
        if (ds) return String(ds).replace(/\/$/, '');
      }
    } catch (e) {}
    var proto = (location.protocol === 'https:') ? 'https:' : 'http:';
    var host = location.hostname || '127.0.0.1';
    return proto + '//' + host + ':8000';
  }

  var BASE           = resolveBase();
  var ENDPOINT       = BASE + '/report';
  var HELLO_ENDPOINT = BASE + '/hello';
  var APP_NAME       = (typeof window !== 'undefined' && window.APP_NAME) || (location.hostname || 'cliente');
  var APP_RELEASE    = (typeof window !== 'undefined' && window.APP_RELEASE) || null;
  var SOURCE         = 'js';

  var sent = new Set();
  var origFetch = (typeof window !== 'undefined' && typeof window.fetch === 'function') ? window.fetch.bind(window) : null;

  // --- Personalización de mensajes ---------------------------------
  // window.MENSAJES_PERSONALIZADOS = [
  //   { match: /Cannot read properties of undefined/i, replace: 'Algo del DOM no estaba listo' },
  //   { match: 'NetworkError', replace: 'Sin conexión con el servidor' }
  // ];
  function personalizar(msg) {
    if (!msg) return msg;
    try {
      var rules = (typeof window !== 'undefined' && window.MENSAJES_PERSONALIZADOS) || [];
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        if (!r || !r.match || typeof r.replace !== 'string') continue;
        if (r.match instanceof RegExp) {
          if (r.match.test(msg)) return msg.replace(r.match, r.replace);
        } else if (typeof r.match === 'string') {
          if (msg.indexOf(r.match) !== -1) return msg.split(r.match).join(r.replace);
        }
      }
    } catch (e) {}
    return msg;
  }

  function relPath(url) {
    if (!url) return null;
    try {
      var u = new URL(url, location.href);
      return u.pathname.replace(/^\//, '');
    } catch (e) { return String(url); }
  }

  function post(url, payload) {
    // sendBeacon con application/json dispara preflight (no soportado) y se pierde
    // silenciosamente en cross-origin. Usamos fetch keepalive directamente.
    try {
      var body = JSON.stringify(payload);
      var f = origFetch || (typeof fetch === 'function' ? fetch : null);
      if (!f) return;
      f(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit'
      }).catch(function () {});
    } catch (e) {}
  }

  function send(payload) {
    payload.message = personalizar(payload.message);
    var key = (payload.message || '') + '|' + (payload.file || '') + ':' + (payload.line || 0);
    if (sent.has(key)) return;
    sent.add(key);
    payload.extra = Object.assign({ app: APP_NAME }, payload.extra || {});
    if (APP_RELEASE) payload.extra.release = APP_RELEASE;
    post(ENDPOINT, payload);
  }

  // --- Helper publico para que otros scripts reporten sin tirar errores
  // a la consola del cliente. Si esta funcion existe, palabras-prohibidas
  // y extensiones-cliente la usan en lugar de `setTimeout(throw)`.
  window.AVISOS_REPORTAR = function (msg, extra) {
    try {
      send({
        source: SOURCE,
        message: String(msg == null ? '' : msg),
        file: relPath(location.href),
        line: 0,
        stack: null,
        extra: Object.assign({ kind: 'manual' }, extra || {})
      });
    } catch (e) {}
  };

  // --- Registro como cliente ---------------------------------------
  post(HELLO_ENDPOINT, {
    app: APP_NAME,
    release: APP_RELEASE,
    url: location.href,
    user_agent: navigator.userAgent
  });

  // --- Errores JS y de recursos ------------------------------------
  window.addEventListener('error', function (ev) {
    if (ev.target && ev.target !== window && (ev.target.src || ev.target.href)) {
      send({
        source: SOURCE,
        message: 'Recurso no cargado: ' + (ev.target.src || ev.target.href),
        file: relPath(location.href),
        line: 0,
        stack: null,
        extra: { kind: 'resource', tag: ev.target.tagName }
      });
      return;
    }
    send({
      source: SOURCE,
      message: ev.message || 'Error JS',
      file: relPath(ev.filename) || relPath(location.href),
      line: ev.lineno || 0,
      stack: ev.error && ev.error.stack ? String(ev.error.stack) : null,
      extra: { col: ev.colno, page: location.href }
    });
  }, true);

  // --- Promesas rechazadas -----------------------------------------
  window.addEventListener('unhandledrejection', function (ev) {
    var reason = ev.reason;
    var msg = (reason && reason.message) || String(reason);
    send({
      source: SOURCE,
      message: 'Promise rechazada: ' + msg,
      file: relPath(location.href),
      line: 0,
      stack: reason && reason.stack ? String(reason.stack) : null,
      extra: { kind: 'unhandledrejection' }
    });
  });

  // --- Wrapper de fetch (4xx/5xx + fallos de red) ------------------
  if (origFetch) {
    var wrapped = function () {
      var args = arguments;
      var url = (args[0] && args[0].url) || args[0];
      return origFetch.apply(this, args).then(function (resp) {
        if (!resp.ok && resp.status >= 400) {
          send({
            source: SOURCE,
            message: 'fetch ' + resp.status + ' ' + url,
            file: relPath(location.href),
            line: 0,
            stack: null,
            extra: { kind: 'fetch', status: resp.status, url: String(url) }
          });
        }
        return resp;
      }).catch(function (err) {
        send({
          source: SOURCE,
          message: 'fetch fallo: ' + (err && err.message || err) + ' -> ' + url,
          file: relPath(location.href),
          line: 0,
          stack: err && err.stack ? String(err.stack) : null,
          extra: { kind: 'fetch_error', url: String(url) }
        });
        throw err;
      });
    };
    window.fetch = wrapped;
  }

  // --- Auditor de CSS (propiedades invalidas en hojas same-origin) -
  function auditCssText(text, fileLabel) {
    if (!text || typeof CSS === 'undefined' || !CSS.supports) return;
    var clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
    var blockRe = /([^{}]+)\{([^{}]*)\}/g, m;
    while ((m = blockRe.exec(clean)) !== null) {
      var selector = m[1].trim().slice(0, 120);
      var body = m[2];
      body.split(';').forEach(function (decl) {
        decl = decl.trim();
        if (!decl) return;
        var idx = decl.indexOf(':');
        if (idx < 0) return;
        var prop = decl.slice(0, idx).trim();
        var val  = decl.slice(idx + 1).trim();
        if (!prop || prop.charAt(0) === '-' || prop.charAt(0) === '@') return;
        try {
          if (!CSS.supports(prop, val)) {
            send({
              source: SOURCE,
              message: 'CSS invalido: "' + prop + ': ' + val.slice(0, 80) + '" en ' + selector,
              file: fileLabel,
              line: 0,
              stack: null,
              extra: { kind: 'css_invalid', prop: prop, value: val, selector: selector }
            });
          }
        } catch (e) {}
      });
    }
  }
  function auditCss() {
    document.querySelectorAll('style').forEach(function (s, i) {
      auditCssText(s.textContent, relPath(location.href) + '#style[' + i + ']');
    });
    Array.prototype.slice.call(document.styleSheets).forEach(function (sheet) {
      var href = sheet.href;
      if (!href) return;
      var sameOrigin = false;
      try { sameOrigin = new URL(href).origin === location.origin; } catch (e) {}
      if (!sameOrigin) return;
      fetch(href).then(function (r) { return r.text(); }).then(function (t) {
        auditCssText(t, relPath(href));
      }).catch(function () {});
    });
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(auditCss, 300);
  } else {
    window.addEventListener('DOMContentLoaded', function () { setTimeout(auditCss, 300); });
  }
})();
