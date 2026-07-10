/* ============================================================
   StockBuddy – Fancy Uploader (Vanilla JS, kein Backend)
   ------------------------------------------------------------
   Auto-Init:  jedes Element mit [data-sb-uploader] wird beim
               DOMContentLoaded verkabelt.
   Manuell:    const up = new SBUploader(el, { ...options });
   API:        up.getFiles()  -> File[]
               up.clear()
               up.on('change', cb) / 'add' / 'reject' / 'submit'
   Events:     el löst 'sb-upload:change' (detail: {files}) aus.

   Konfiguration (Options = JS gewinnt über data-*):
     accept       ".xls,.xlsx,.csv,.pdf,.png,.jpg,.jpeg,.webp"
     maxSizeMB    2
     maxFiles     5           (0 = unbegrenzt)
     multiple     true
     title        "Lade dein Portfolio hoch"
     hint         "XLS, CSV, PDF oder Screenshot · max 2 MB"
     note         Zusatzhinweis unter der Zone (HTML erlaubt)
     paste        true        (Screenshot mit Strg/Cmd+V)
     submitButton CSS-Selector des Absende-Buttons (optional)
   ============================================================ */
(function (global) {
  "use strict";

  var DEFAULTS = {
    accept: ".xls,.xlsx,.csv,.pdf,.png,.jpg,.jpeg,.webp",
    maxSizeMB: 2,
    maxFiles: 5,
    multiple: true,
    title: "Datei hierher ziehen oder <b>durchsuchen</b>",
    hint: "",
    note: "",
    paste: true,
    submitButton: ""
  };

  var TYPE_ICON = {
    pdf:   "bi-file-earmark-pdf",
    excel: "bi-file-earmark-spreadsheet",
    csv:   "bi-filetype-csv",
    image: "bi-file-earmark-image",
    file:  "bi-file-earmark"
  };

  function kindOf(name) {
    var ext = (name.split(".").pop() || "").toLowerCase();
    if (ext === "pdf") return "pdf";
    if (ext === "xls" || ext === "xlsx") return "excel";
    if (ext === "csv") return "csv";
    if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "heic"].indexOf(ext) > -1) return "image";
    return "file";
  }

  function humanSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0) + " MB";
  }

  function bool(v, fallback) {
    if (v === undefined || v === null || v === "") return fallback;
    return v === true || v === "true" || v === "1";
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function SBUploader(el, options) {
    if (!el) throw new Error("SBUploader: kein Element");
    if (el._sbUploader) return el._sbUploader;

    var d = el.dataset;
    this.el = el;
    this.opts = Object.assign({}, DEFAULTS, {
      accept:       d.accept       || DEFAULTS.accept,
      maxSizeMB:    num(d.maxSizeMb, DEFAULTS.maxSizeMB),
      maxFiles:     num(d.maxFiles,  DEFAULTS.maxFiles),
      multiple:     bool(d.multiple, DEFAULTS.multiple),
      title:        d.title        || DEFAULTS.title,
      hint:         d.hint         || DEFAULTS.hint,
      note:         d.note         || DEFAULTS.note,
      paste:        bool(d.paste,   DEFAULTS.paste),
      submitButton: d.submitButton || DEFAULTS.submitButton
    }, options || {});

    this.accepts = this.opts.accept
      .split(",")
      .map(function (s) { return s.trim().toLowerCase(); })
      .filter(Boolean);

    this.files = [];        // { id, file, kind, error }
    this._seq = 0;
    this._handlers = { change: [], add: [], reject: [], submit: [] };

    el._sbUploader = this;
    this._render();
    this._bind();
    this._syncSubmit();
  }

  SBUploader.prototype.on = function (evt, cb) {
    if (this._handlers[evt]) this._handlers[evt].push(cb);
    return this;
  };
  SBUploader.prototype._emit = function (evt, payload) {
    (this._handlers[evt] || []).forEach(function (cb) { cb(payload); });
    if (evt === "change") {
      this.el.dispatchEvent(new CustomEvent("sb-upload:change", {
        bubbles: true, detail: { files: this.getFiles() }
      }));
    }
  };

  SBUploader.prototype.getFiles = function () {
    return this.files.filter(function (f) { return !f.error; })
                     .map(function (f) { return f.file; });
  };

  SBUploader.prototype._render = function () {
    var o = this.opts;
    var hint = o.hint || (
      "Erlaubt: " + this.accepts.join(", ").toUpperCase().replace(/\./g, "") +
      (o.maxSizeMB ? " · max " + o.maxSizeMB + " MB" : "")
    );
    this.el.classList.add("sb-uploader");
    this.el.innerHTML =
      '<div class="sb-uz-drop" tabindex="0" role="button" aria-label="Datei auswählen">' +
        '<div class="sb-uz-icon"><i class="bi bi-cloud-arrow-up-fill"></i></div>' +
        '<div class="sb-uz-title">' + o.title + '</div>' +
        '<div class="sb-uz-hint">' + esc(hint) + '</div>' +
        '<button type="button" class="sb-uz-browse">Datei auswählen</button>' +
        '<input type="file" class="sb-uz-input"' +
          (o.multiple ? " multiple" : "") +
          ' accept="' + esc(o.accept) + '">' +
      '</div>' +
      '<div class="sb-uz-alert"><i class="bi bi-exclamation-triangle-fill"></i><span></span></div>' +
      (o.note ? '<div class="sb-uz-note"><i class="bi bi-info-circle-fill"></i><span>' + o.note + '</span></div>' : '') +
      '<ul class="sb-uz-list"></ul>' +
      '<div class="sb-uz-summary"><span class="sb-uz-count"></span>' +
        '<button type="button" class="sb-uz-clear">Alle entfernen</button></div>';

    this.$drop    = this.el.querySelector(".sb-uz-drop");
    this.$input   = this.el.querySelector(".sb-uz-input");
    this.$list    = this.el.querySelector(".sb-uz-list");
    this.$alert   = this.el.querySelector(".sb-uz-alert");
    this.$summary = this.el.querySelector(".sb-uz-summary");
    this.$count   = this.el.querySelector(".sb-uz-count");
  };

  SBUploader.prototype._bind = function () {
    var self = this;

    this.$drop.addEventListener("click", function () { self.$input.click(); });
    this.$drop.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.$input.click(); }
    });
    this.el.querySelector(".sb-uz-browse").addEventListener("click", function (e) {
      e.stopPropagation(); self.$input.click();
    });

    this.$input.addEventListener("change", function () {
      self.add(this.files);
      this.value = "";               // gleiche Datei erneut wählbar
    });

    ["dragenter", "dragover"].forEach(function (ev) {
      self.$drop.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        self.el.classList.add("is-dragover");
      });
    });
    ["dragleave", "dragend"].forEach(function (ev) {
      self.$drop.addEventListener(ev, function (e) {
        e.preventDefault();
        if (ev === "dragleave" && self.$drop.contains(e.relatedTarget)) return;
        self.el.classList.remove("is-dragover");
      });
    });
    this.$drop.addEventListener("drop", function (e) {
      e.preventDefault(); e.stopPropagation();
      self.el.classList.remove("is-dragover");
      if (e.dataTransfer && e.dataTransfer.files) self.add(e.dataTransfer.files);
    });

    this.$summary.querySelector(".sb-uz-clear").addEventListener("click", function () {
      self.clear();
    });

    if (this.opts.paste) {
      this._pasteHandler = function (e) {
        if (!self._isVisible()) return;
        var items = e.clipboardData && e.clipboardData.files;
        if (items && items.length) { self.add(items); }
      };
      document.addEventListener("paste", this._pasteHandler);
    }
  };

  SBUploader.prototype._isVisible = function () {
    return !!(this.el.offsetWidth || this.el.offsetHeight || this.el.getClientRects().length);
  };

  SBUploader.prototype.add = function (fileList) {
    var self = this, added = 0, rejected = [];
    Array.prototype.slice.call(fileList).forEach(function (file) {
      if (!self.opts.multiple) self._removeAll();

      if (self.opts.maxFiles && self.files.length >= self.opts.maxFiles) {
        rejected.push("Maximal " + self.opts.maxFiles + " Dateien.");
        return;
      }
      // Duplikat
      if (self.files.some(function (f) {
        return f.file.name === file.name && f.file.size === file.size;
      })) { return; }

      var reason = self._validate(file);
      var entry = { id: ++self._seq, file: file, kind: kindOf(file.name), error: reason };
      self.files.push(entry);
      self._renderItem(entry);
      if (reason) { rejected.push(file.name + ": " + reason); self._emit("reject", entry); }
      else { added++; self._emit("add", entry); }
    });

    this._alert(rejected.length ? rejected[0] : "");
    this._syncSummary();
    this._syncSubmit();
    if (added) this._emit("change");
  };

  SBUploader.prototype._validate = function (file) {
    var ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (this.accepts.length && this.accepts.indexOf(ext) === -1) {
      return "Dateityp nicht erlaubt";
    }
    if (this.opts.maxSizeMB && file.size > this.opts.maxSizeMB * 1048576) {
      return "Zu groß (" + humanSize(file.size) + ")";
    }
    return null;
  };

  SBUploader.prototype._renderItem = function (entry) {
    var li = document.createElement("li");
    li.className = "sb-uz-item" + (entry.error ? " is-error" : "");
    li.dataset.id = entry.id;

    var kind = entry.kind;
    var thumbInner = '<i class="bi ' + (TYPE_ICON[kind] || TYPE_ICON.file) + '"></i>';
    li.innerHTML =
      '<div class="sb-uz-thumb" data-kind="' + kind + '">' + thumbInner + '</div>' +
      '<div class="sb-uz-meta">' +
        '<div class="sb-uz-name" title="' + esc(entry.file.name) + '">' + esc(entry.file.name) + '</div>' +
        '<div class="sb-uz-sub">' +
          '<span>' + humanSize(entry.file.size) + '</span>' +
          '<span class="sb-uz-state ' + (entry.error ? "err" : "") + '">' +
            (entry.error ? entry.error : "") + '</span>' +
        '</div>' +
        (entry.error ? '' : '<div class="sb-uz-bar"><span></span></div>') +
      '</div>' +
      '<button type="button" class="sb-uz-remove" aria-label="Entfernen"><i class="bi bi-x-lg"></i></button>';

    var self = this;
    li.querySelector(".sb-uz-remove").addEventListener("click", function () {
      self.remove(entry.id);
    });
    this.$list.appendChild(li);

    if (!entry.error) {
      if (kind === "image") this._thumbnail(entry, li);
      this._progress(entry, li);
    }
  };

  // echtes Einlesen -> Fortschrittsbalken (kein Upload, nur clientseitig)
  SBUploader.prototype._progress = function (entry, li) {
    var bar = li.querySelector(".sb-uz-bar > span");
    var state = li.querySelector(".sb-uz-state");
    var reader = new FileReader();
    reader.onprogress = function (e) {
      if (e.lengthComputable && bar) bar.style.width = (e.loaded / e.total * 100) + "%";
    };
    reader.onloadend = function () {
      if (bar) bar.style.width = "100%";
      setTimeout(function () {
        li.classList.add("is-done");
        if (state) { state.textContent = "Bereit"; state.classList.add("ok"); }
      }, 180);
    };
    try { reader.readAsArrayBuffer(entry.file); }
    catch (err) { if (bar) bar.style.width = "100%"; li.classList.add("is-done"); }
  };

  SBUploader.prototype._thumbnail = function (entry, li) {
    var thumb = li.querySelector(".sb-uz-thumb");
    var url = URL.createObjectURL(entry.file);
    var img = new Image();
    img.onload = function () {
      thumb.innerHTML = "";
      thumb.appendChild(img);
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    entry._objectUrl = url;
    img.src = url;
  };

  SBUploader.prototype.remove = function (id) {
    var idx = this.files.findIndex(function (f) { return f.id === id; });
    if (idx === -1) return;
    var entry = this.files[idx];
    if (entry._objectUrl) URL.revokeObjectURL(entry._objectUrl);
    this.files.splice(idx, 1);
    var li = this.$list.querySelector('[data-id="' + id + '"]');
    if (li) li.remove();
    this._alert("");
    this._syncSummary();
    this._syncSubmit();
    this._emit("change");
  };

  SBUploader.prototype._removeAll = function () {
    this.files.forEach(function (f) { if (f._objectUrl) URL.revokeObjectURL(f._objectUrl); });
    this.files = [];
    this.$list.innerHTML = "";
  };

  SBUploader.prototype.clear = function () {
    this._removeAll();
    this._alert("");
    this._syncSummary();
    this._syncSubmit();
    this._emit("change");
  };

  SBUploader.prototype._alert = function (msg) {
    this.$alert.classList.toggle("is-show", !!msg);
    if (msg) this.$alert.querySelector("span").textContent = msg;
  };

  SBUploader.prototype._syncSummary = function () {
    var valid = this.getFiles().length;
    var total = this.files.length;
    this.$summary.classList.toggle("is-show", total > 0);
    if (total > 0) {
      this.$count.textContent = valid + " Datei" + (valid === 1 ? "" : "en") + " bereit" +
        (total > valid ? " · " + (total - valid) + " abgelehnt" : "");
    }
  };

  SBUploader.prototype._syncSubmit = function () {
    var sel = this.opts.submitButton;
    if (!sel) return;
    var root = this.el.closest(".modal-content") || document;
    var btn = root.querySelector(sel) || document.querySelector(sel);
    if (!btn) return;
    var self = this;
    var has = this.getFiles().length > 0;
    btn.disabled = !has;
    btn.classList.toggle("is-disabled", !has);
    if (!btn._sbBound) {
      btn._sbBound = true;
      btn.addEventListener("click", function () {
        if (!self.getFiles().length) return;
        self._emit("submit", { files: self.getFiles() });
      });
    }
  };

  // ---------- Auto-Init ----------
  function initAll(ctx) {
    (ctx || document).querySelectorAll("[data-sb-uploader]").forEach(function (el) {
      if (!el._sbUploader) new SBUploader(el);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { initAll(); });
  } else {
    initAll();
  }

  global.SBUploader = SBUploader;
  global.SBUploader.initAll = initAll;
})(window);
