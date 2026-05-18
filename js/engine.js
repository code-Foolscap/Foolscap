// Template engine: pure string -> HTML substitution. No DOM, no storage.
// Placeholders are {{key}}. Unfilled placeholders render as a visible blank
// so the user always sees what is missing.

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A signature value is "draw:<pngDataURL>" (drawn) or "type:<name>" (typed).
// Renders to an image or a signature-face span. Pure.
function sigMarkup(v) {
  const s = String(v);
  if (s.startsWith("draw:")) {
    return `<img class="sigimg" alt="Signature" src="${s.slice(5).replace(/["'<>]/g, "")}">`;
  }
  if (s.startsWith("type:")) {
    return `<span class="sigtype">${escapeHtml(s.slice(5))}</span>`;
  }
  return `<span class="sigtype">${escapeHtml(s)}</span>`;
}

// Render a document body into HTML. Pure: string in, string out.
// fields: the schema array, values: { key: string }.
// opts.editable: emit inline field controls bound by data-key, so the contract
// itself is the form (the canvas). Default false = static (signer / seal view).
// opts.editableKeys: array of keys — ONLY those render as editable controls,
// everything else renders static. Used so the receiver can fill only their own
// signature block while the rest of the contract stays read-only.
export function renderTemplate(body, fields, values, opts = {}) {
  const byKey = {};
  for (const f of fields) byKey[f.key] = f;
  const onlyKeys = opts.editableKeys ? new Set(opts.editableKeys) : null;
  const allEditable = !!opts.editable;

  // Also capture any sentence punctuation right after a placeholder so it can
  // travel WITH the field (a long select must not orphan a lone "." on its
  // own line).
  const filled = body.replace(/\{\{\s*([\w.]+)\s*\}\}([.,;:!?]?)/g, (_, key, punct) => {
    const f = byKey[key] || { key, label: key };
    const label = f.label || key;
    const raw = values[key];
    const hasVal = raw != null && String(raw).trim() !== "";
    const p = escapeHtml(punct || "");
    const editable = onlyKeys ? onlyKeys.has(key) : allEditable;

    if (editable) {
      if (f.type === "select") {
        const options = f.options || [];
        const effective = hasVal ? String(raw) : options[0] != null ? String(options[0]) : "";
        const opts2 = options
          .map(
            (o) =>
              `<option value="${escapeHtml(o)}"${String(o) === effective ? " selected" : ""}>${escapeHtml(o)}</option>`
          )
          .join("");
        // Real <select> for editing + a plain-text twin for print/locked
        // (a native select prints as a boxed control with a dropdown arrow).
        // `.sel` is nowrap and the punctuation lives inside it, so the dot is
        // glued to the field instead of dangling on its own line.
        return `<span class="sel"><select class="fld fld-select" data-key="${escapeHtml(key)}">${opts2}</select><span class="sel-val" data-punct="${p}">${escapeHtml(effective)}${p}</span><span class="sel-punct">${p}</span></span>`;
      }
      if (f.type === "signature") {
        // Clickable target; app.js opens the draw/type pad. Holds the rendered
        // mark when signed (button chrome is stripped when locked/printed).
        return `<button type="button" class="sigfield${hasVal ? "" : " empty"}" data-key="${escapeHtml(key)}" data-label="${escapeHtml(label)}">${hasVal ? sigMarkup(raw) : ""}</button>${p}`;
      }
      return `<span class="fld${hasVal ? "" : " empty"}" data-key="${escapeHtml(key)}" data-label="${escapeHtml(label)}" contenteditable="true" role="textbox" spellcheck="false">${hasVal ? escapeHtml(raw) : ""}</span>${p}`;
    }

    if (f.type === "signature") {
      return (
        (hasVal
          ? `<span class="sigwrap">${sigMarkup(raw)}</span>`
          : `<span class="sigblank">______________________</span>`) + p
      );
    }
    if (hasVal) return `<span class="v">${escapeHtml(raw)}</span>${p}`;
    return `<span class="blank" title="Unfilled: ${escapeHtml(label)}">[${escapeHtml(label)}]</span>${p}`;
  });

  // Paragraphs split on blank lines; single newlines become <br>.
  return filled
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const t = block.trim();
      if (/^#\s+/.test(t)) return `<h1>${t.replace(/^#\s+/, "")}</h1>`;
      if (/^##\s+/.test(t)) return `<h2>${t.replace(/^##\s+/, "")}</h2>`;
      // "! " block = emphasized callout (a conclusion that must stand out, e.g.
      // the certificate's Result / Identity verdict). No legal template body
      // starts a line with "! ", so contracts are unaffected.
      if (/^!\s+/.test(t))
        return `<p class="callout">${t
          .replace(/^!\s+/, "")
          .replace(/\n/g, "<br>")}</p>`;
      // "> " block = de-emphasized fine print (notice/attribution).
      if (/^>\s/.test(t)) {
        const fp = t
          .split(/\n/)
          .map((l) => l.replace(/^>\s?/, ""))
          .join(" ")
          .trim();
        return `<p class="fineprint">${fp}</p>`;
      }
      return `<p>${t.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

// Completion ratio for the progress hint (0..1).
export function completion(fields, values) {
  const required = fields.filter((f) => f.required !== false);
  if (!required.length) return 1;
  const done = required.filter(
    (f) => values[f.key] != null && String(values[f.key]).trim() !== ""
  ).length;
  return done / required.length;
}
