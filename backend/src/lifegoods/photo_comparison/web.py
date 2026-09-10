"""The intentionally separate browser surface for local photo trials."""

# The HTML/CSS/JS payload is intentionally authored as a readable browser file;
# Python's line-length rule does not apply to its embedded client code.
# ruff: noqa: E501

from __future__ import annotations

PAGE = r"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Life Goods · Photo comparison lab</title>
  <style>
    :root { color-scheme: light; --amber:#995613; --amber-dark:#7b440d; --amber-soft:#f3e8dd; --slate:#131519; --body:#404c5b; --muted:#526073; --canvas:#f3f5f6; --sheet:#fff; --line:#c6cfdd; --blue:#315072; --blue-soft:#e3e8ee; --error:#b03232; --error-soft:#f7f2f2; --green:#3d5e31; --green-soft:#e6ede3; }
    * { box-sizing:border-box; }
    html { min-width:320px; background:var(--canvas); }
    body { margin:0; min-width:320px; color:var(--slate); background:var(--canvas); font:15px/1.55 "Plus Jakarta Sans", "Noto Sans Khmer", system-ui, sans-serif; }
    button, input, select { font:inherit; }
    button { min-height:44px; cursor:pointer; }
    button:focus-visible, input:focus-visible, select:focus-visible { outline:3px solid #b86a1a; outline-offset:3px; }
    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
    .topbar { min-height:70px; padding:16px clamp(20px,5vw,64px); background:rgba(255,255,255,.94); border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; gap:20px; }
    .brand { display:flex; align-items:center; gap:12px; font-weight:800; letter-spacing:-.03em; }
    .mark { width:34px; height:34px; border-radius:10px; display:grid; place-items:center; background:var(--slate); color:#e19447; font-weight:800; font-family:ui-monospace, monospace; }
    .topbar a { color:var(--blue); font-size:12px; font-weight:700; text-decoration:underline; text-underline-offset:4px; }
    main { max-width:1500px; margin:0 auto; padding:52px clamp(20px,5vw,64px) 80px; }
    .intro { max-width:780px; margin-bottom:34px; }
    h1, h2, h3, p { margin:0; }
    h1 { max-width:720px; font-size:clamp(2.1rem,4.6vw,4.2rem); line-height:1.04; letter-spacing:-.055em; }
    .lede { max-width:680px; margin-top:18px; color:var(--muted); font-size:17px; }
    .notice { margin-top:22px; max-width:780px; padding:14px 16px; background:var(--blue-soft); color:#253b53; border:1px solid #c4d1df; border-radius:14px; }
    .notice strong { display:block; margin-bottom:3px; }
    .toolbar { display:flex; justify-content:space-between; align-items:center; gap:16px; margin:28px 0 14px; }
    .toolbar h2 { font-size:20px; letter-spacing:-.025em; }
    .toolbar p { color:var(--muted); font-size:13px; }
    .button { border:1px solid transparent; border-radius:12px; padding:9px 15px; font-weight:750; transition:background .15s ease, transform .15s ease; }
    .button:active { transform:scale(.98); }
    .button.primary { color:#fff; background:var(--amber); box-shadow:0 8px 20px -14px rgba(90,50,11,.8); }
    .button.primary:hover { background:var(--amber-dark); }
    .button.outline { color:var(--slate); background:#fff; border-color:var(--line); }
    .button.outline:hover { background:#f3f5f6; border-color:#9fb1cb; }
    .button.ghost { color:var(--muted); background:transparent; padding-inline:10px; }
    .button.ghost:hover { color:var(--slate); background:#e3e7ed; }
    .button:disabled { opacity:.45; cursor:not-allowed; transform:none; }
    .panels { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; align-items:start; }
    .panel { background:var(--sheet); border:1px solid var(--line); border-radius:16px; box-shadow:0 14px 38px -28px rgba(19,21,25,.55); overflow:hidden; }
    .panel-head { padding:22px 22px 18px; display:flex; justify-content:space-between; gap:16px; border-bottom:1px solid var(--line); }
    .panel-title { display:flex; gap:14px; align-items:flex-start; }
    .panel-number { width:34px; height:34px; flex:0 0 auto; border-radius:10px; display:grid; place-items:center; color:#5a320b; background:var(--amber-soft); font:700 13px ui-monospace, monospace; }
    .panel h3 { font-size:19px; letter-spacing:-.025em; }
    .panel-subtitle { color:var(--muted); font-size:12px; margin-top:3px; }
    .product-name { width:160px; min-width:0; padding:8px 10px; color:var(--slate); border:1px solid var(--line); border-radius:10px; background:#fff; }
    .panel-body { padding:20px 22px 24px; }
    .dropzone { position:relative; padding:18px; border:1px dashed #9fb1cb; border-radius:14px; background:#f8fafb; }
    .dropzone strong { display:block; }
    .dropzone span { display:block; margin-top:2px; color:var(--muted); font-size:12px; }
    .file-input { position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; }
    .previews { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; margin-top:15px; }
    .preview { position:relative; aspect-ratio:1/1; overflow:hidden; border-radius:12px; background:#303843; }
    .preview img { width:100%; height:100%; object-fit:cover; display:block; }
    .preview-label { position:absolute; left:7px; bottom:7px; padding:2px 7px; color:#fff; border-radius:999px; background:rgba(19,21,25,.78); font:11px ui-monospace, monospace; }
    .preview-controls { position:absolute; right:6px; top:6px; display:flex; gap:3px; }
    .icon-button { width:31px; height:31px; min-height:31px; padding:0; border:0; border-radius:9px; color:#fff; background:rgba(19,21,25,.78); font-weight:800; }
    .icon-button:hover { background:var(--amber-dark); }
    .preview:focus-within, .preview.highlight { outline:3px solid #e19447; outline-offset:2px; }
    .panel-actions { display:flex; flex-wrap:wrap; align-items:center; gap:9px; margin-top:17px; }
    .status { min-height:22px; margin-top:13px; color:var(--muted); font-size:13px; }
    .status.loading { color:var(--amber-dark); }
    .status.error { padding:10px 12px; color:#681d1d; background:var(--error-soft); border:1px solid #e5bdbd; border-radius:10px; }
    .status.ok { color:var(--green); }
    .results { margin-top:20px; border-top:1px solid var(--line); }
    .result-section { padding-top:18px; }
    .result-heading { display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin-bottom:10px; }
    .result-heading h4 { font-size:14px; letter-spacing:.02em; }
    .result-heading span { color:var(--muted); font:11px ui-monospace, monospace; }
    .facts { display:grid; grid-template-columns:120px minmax(0,1fr); gap:7px 13px; font-size:13px; }
    .facts dt { color:var(--muted); }
    .facts dd { min-width:0; margin:0; overflow-wrap:anywhere; }
    .columns { display:grid; gap:13px; }
    .column { padding:14px; border:1px solid var(--line); border-radius:13px; background:#fff; }
    .column.selected { border-color:#e19447; box-shadow:0 0 0 2px #f3e8dd; }
    .column-top { display:flex; justify-content:space-between; gap:12px; align-items:start; }
    .column-title { font-weight:800; }
    .column-meta { color:var(--muted); font-size:12px; margin-top:3px; }
    .select-wrap { min-width:154px; }
    select { width:100%; min-height:40px; padding:7px 9px; border:1px solid var(--line); border-radius:9px; background:#fff; color:var(--slate); }
    .observation-list { margin-top:13px; border-top:1px solid #e3e7ed; }
    .observation { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:12px; padding:10px 0; border-bottom:1px solid #e3e7ed; }
    .observation:last-child { border-bottom:0; padding-bottom:0; }
    .obs-label { font-weight:700; overflow-wrap:anywhere; }
    .obs-script { margin-top:2px; color:var(--body); overflow-wrap:anywhere; font-family:"Noto Sans Khmer", "Noto Sans Thai", sans-serif; }
    .obs-state { color:var(--muted); font-size:11px; }
    .obs-value { text-align:right; font:13px/1.4 ui-monospace, monospace; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .evidence { display:flex; flex-wrap:wrap; gap:4px; margin-top:5px; }
    .evidence-button { min-height:25px; padding:2px 7px; color:var(--blue); border:1px solid #c4d1df; border-radius:999px; background:var(--blue-soft); font-size:11px; }
    .evidence-button:hover { border-color:var(--blue); }
    .retakes { margin-top:12px; padding:11px 13px; color:#694400; background:#f6ecda; border:1px solid #f4dcae; border-radius:11px; }
    .retakes strong { display:block; margin-bottom:3px; }
    .retakes ul { margin:4px 0 0 18px; padding:0; }
    .comparison { margin-top:30px; padding:24px; background:var(--slate); color:#fff; border-radius:16px; box-shadow:0 16px 40px -24px rgba(19,21,25,.8); }
    .comparison-head { display:flex; align-items:end; justify-content:space-between; gap:16px; }
    .comparison h2 { font-size:24px; letter-spacing:-.035em; }
    .comparison-intro { max-width:650px; margin-top:5px; color:#c6cfdd; font-size:13px; }
    .comparison .button.outline { color:#fff; border-color:#6e7784; background:#303843; }
    .comparison .button.outline:hover { background:#404c5b; }
    .comparison-status { margin-top:13px; color:#e7b583; font-size:13px; }
    .comparison-status.error { color:#f0a8a8; }
    .table-wrap { overflow-x:auto; margin-top:22px; border:1px solid #48535f; border-radius:12px; }
    table { width:100%; min-width:780px; border-collapse:collapse; font-size:13px; }
    th, td { padding:13px 14px; text-align:left; vertical-align:top; border-bottom:1px solid #48535f; }
    th { color:#c6cfdd; font:700 11px ui-monospace, monospace; letter-spacing:.06em; text-transform:uppercase; }
    tr:last-child td { border-bottom:0; }
    .nutrient-name { font-weight:800; color:#fff; overflow-wrap:anywhere; }
    .reported { color:#f4f6f3; font-family:ui-monospace, monospace; font-variant-numeric:tabular-nums; }
    .basis { margin-top:4px; color:#c6cfdd; font-size:11px; overflow-wrap:anywhere; }
    .calculated { color:#e7b583; font:700 13px ui-monospace, monospace; font-variant-numeric:tabular-nums; }
    .conditional { color:#f5c875; }
    .unavailable { color:#f0a8a8; }
    .row-reason { margin-top:5px; color:#c6cfdd; font-size:11px; overflow-wrap:anywhere; }
    .footer-note { margin-top:20px; color:var(--muted); font-size:12px; }
    @media (max-width: 900px) { .panels { grid-template-columns:1fr; } main { padding-top:34px; } }
    @media (max-width: 560px) { .topbar { align-items:flex-start; } .topbar a { display:none; } main { padding-inline:14px; } .panel-head { flex-direction:column; } .product-name { width:100%; } .comparison { padding:18px 14px; margin-inline:-1px; } .comparison-head { align-items:start; flex-direction:column; } .facts { grid-template-columns:100px minmax(0,1fr); } }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand"><span class="mark">LG</span><span>Life Goods · local lab</span></div>
    <a href="/scalar" target="_blank" rel="noreferrer">Open API reference ↗</a>
  </header>
  <main>
    <section class="intro">
      <h1>Read two labels side by side.</h1>
      <p class="lede">Upload the complete current photo set for each Product. Gemini reads visible label evidence; this page keeps the printed wording, image links, and uncertainty in view while Python does only explicit unit arithmetic.</p>
      <div class="notice"><strong>Local, temporary evidence</strong> Photos and results stay in this browser session. Nothing is saved, and this experiment does not produce a health score, winner, or purchase advice.</div>
    </section>
    <div class="toolbar"><div><h2>Choose two Products</h2><p>JPEG or PNG · 1–6 photos each · add a package-weight photo when needed</p></div><button id="reset-button" class="button outline" type="button">Reset session</button></div>
    <section id="panels" class="panels" aria-label="Product photo panels"></section>
    <section class="comparison" aria-labelledby="comparison-title">
      <div class="comparison-head"><div><h2 id="comparison-title">Comparison</h2><p class="comparison-intro">Rows below are calculated from submitted photo evidence. A conditional row is visible but does not receive a numeric difference.</p></div><button id="compare-button" class="button outline" type="button" disabled>Compare Products</button></div>
      <div id="comparison-status" class="comparison-status">Extract both Products to enable comparison.</div>
      <div id="comparison-output"></div>
    </section>
    <p class="footer-note">Photo-derived evidence is separate from Open Food Facts Source Records and the ordinary Life Goods Shopper experience. Provider retention is governed by the configured Gemini service; this process keeps no application-side photo store.</p>
  </main>
  <script>
    const state = { products: [makeProduct("left", "Product A", "1"), makeProduct("right", "Product B", "2")], comparison: null };
    function makeProduct(id, title, number) { return { id, title, number, photos: [], extraction: null, selectedColumnId: null, loading: false, error: "", retry: false, revision: 0 }; }
    const $ = (id) => document.getElementById(id);
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
    const display = (value, unit = "") => value === null || value === undefined || value === "" ? "Source Data Unavailable" : escapeHtml(value) + (unit ? " " + escapeHtml(unit) : "");
    const stateLabel = (value) => String(value || "unknown").replaceAll("_", " ");
    const productById = (id) => state.products.find((product) => product.id === id);
    function invalidateComparison() { state.comparison = null; $("comparison-output").innerHTML = ""; $("comparison-status").textContent = "Extract both Products to enable comparison."; $("comparison-status").className = "comparison-status"; }
    function invalidateProduct(product) { product.revision += 1; product.extraction = null; product.selectedColumnId = null; product.error = ""; product.retry = false; product.loading = false; invalidateComparison(); }
    function render() { renderPanels(); renderCompareButton(); }
    function renderPanels() {
      $("panels").innerHTML = state.products.map((product) => `
        <article class="panel" aria-labelledby="${product.id}-title">
          <header class="panel-head"><div class="panel-title"><span class="panel-number">${product.number}</span><div><h3 id="${product.id}-title">${escapeHtml(product.title)}</h3><p class="panel-subtitle">${product.photos.length} of 6 photos selected</p></div></div><input class="product-name" data-product-name="${product.id}" value="${escapeHtml(product.title)}" aria-label="${escapeHtml(product.title)} display name"></header>
          <div class="panel-body">
            <div class="dropzone"><strong>Add label photos</strong><span>Choose one or more JPEG/PNG files. The full set is sent on Extract.</span><input class="file-input" data-add="${product.id}" type="file" accept="image/jpeg,image/png" multiple></div>
            <div class="previews" data-previews="${product.id}">${product.photos.map((photo, index) => `<figure class="preview" data-preview="${escapeHtml(photo.localId)}"><img src="${photo.url}" alt="${escapeHtml(product.title)} photo ${index + 1}"><span class="preview-label">Photo ${index + 1}</span><span class="preview-controls"><button class="icon-button" data-replace="${product.id}:${index}" type="button" title="Replace photo ${index + 1}" aria-label="Replace photo ${index + 1}">↻</button><button class="icon-button" data-remove="${product.id}:${index}" type="button" title="Remove photo ${index + 1}" aria-label="Remove photo ${index + 1}">×</button></span><input hidden data-replace-input="${product.id}:${index}" type="file" accept="image/jpeg,image/png"></figure>`).join("")}</div>
            <div class="panel-actions"><button class="button primary" data-extract="${product.id}" type="button" ${product.photos.length === 0 || product.loading ? "disabled" : ""}>${product.loading ? "Reading photos…" : product.extraction ? "Re-extract complete set" : product.error ? "Retry extraction" : "Extract visible facts"}</button><button class="button ghost" data-clear="${product.id}" type="button" ${product.photos.length === 0 ? "disabled" : ""}>Clear photos</button></div>
            <div class="status ${product.error ? "error" : product.loading ? "loading" : product.extraction ? "ok" : ""}" role="${product.error ? "alert" : "status"}">${product.error ? escapeHtml(product.error) : product.loading ? "Sending this Product’s complete current photo set to Gemini 3.8 Flash…" : product.extraction ? `Extraction ${escapeHtml(product.extraction.outcome)} · model ${escapeHtml(product.extraction.model || "Source Data Unavailable")}` : "Add photos to begin."}</div>
            ${product.extraction ? renderExtraction(product) : ""}
          </div>
        </article>`).join("");
      document.querySelectorAll("[data-product-name]").forEach((input) => input.addEventListener("change", (event) => { const product = productById(event.target.dataset.productName); product.title = event.target.value || `Product ${product.number === "1" ? "A" : "B"}`; renderPanels(); }));
      document.querySelectorAll("[data-add]").forEach((input) => input.addEventListener("change", (event) => addFiles(productById(event.target.dataset.add), [...event.target.files])));
      document.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => { const [id, index] = button.dataset.remove.split(":"); removePhoto(productById(id), Number(index)); }));
      document.querySelectorAll("[data-replace]").forEach((button) => button.addEventListener("click", () => document.querySelector(`[data-replace-input="${button.dataset.replace}"]`).click()));
      document.querySelectorAll("[data-replace-input]").forEach((input) => input.addEventListener("change", (event) => { const [id, index] = event.target.dataset.replaceInput.split(":"); replacePhoto(productById(id), Number(index), event.target.files[0]); }));
      document.querySelectorAll("[data-extract]").forEach((button) => button.addEventListener("click", () => extractProduct(productById(button.dataset.extract))));
      document.querySelectorAll("[data-clear]").forEach((button) => button.addEventListener("click", () => clearPhotos(productById(button.dataset.clear))));
      document.querySelectorAll("[data-column-select]").forEach((select) => select.addEventListener("change", (event) => { const product = productById(event.target.dataset.columnSelect); product.selectedColumnId = event.target.value || null; invalidateComparison(); renderCompareButton(); }));
      document.querySelectorAll("[data-evidence]").forEach((button) => button.addEventListener("click", () => focusEvidence(button.dataset.evidence)));
    }
    function addFiles(product, files) { if (!product) return; const available = 6 - product.photos.length; files.slice(0, available).forEach((file) => { if (!["image/jpeg", "image/png"].includes(file.type)) return; product.photos.push({ file, url: URL.createObjectURL(file), localId: crypto.randomUUID() }); }); invalidateProduct(product); render(); }
    function removePhoto(product, index) { const removed = product.photos.splice(index, 1)[0]; if (removed) URL.revokeObjectURL(removed.url); invalidateProduct(product); render(); }
    function replacePhoto(product, index, file) { if (!file || !["image/jpeg", "image/png"].includes(file.type)) return; const old = product.photos[index]; if (old) URL.revokeObjectURL(old.url); product.photos[index] = { file, url: URL.createObjectURL(file), localId: crypto.randomUUID() }; invalidateProduct(product); render(); }
    function clearPhotos(product) { product.photos.forEach((photo) => URL.revokeObjectURL(photo.url)); product.photos = []; invalidateProduct(product); render(); }
    function renderExtraction(product) {
      const extraction = product.extraction;
      const selected = product.selectedColumnId || (extraction.nutrition_columns.length === 1 ? extraction.nutrition_columns[0].column_id : null);
      const quantity = extraction.package_quantity;
      return `<div class="results"><section class="result-section"><div class="result-heading"><h4>What the photos show</h4><span>${escapeHtml(extraction.provider || "Source Data Unavailable")} · ${escapeHtml(extraction.configuration_version || "Source Data Unavailable")}</span></div><dl class="facts"><dt>Package weight</dt><dd>${quantity ? display(quantity.value_text, quantity.unit_text) : "Source Data Unavailable"}${quantity?.evidence?.length ? renderEvidence(quantity.evidence) : ""}</dd><dt>Preparation</dt><dd>${extraction.nutrition_columns.length ? escapeHtml(extraction.nutrition_columns.map((column) => stateLabel(column.preparation_state)).join(" · ")) : "Source Data Unavailable"}</dd><dt>Evidence images</dt><dd>${extraction.images.map((image, index) => `<button class="evidence-button" data-evidence="${escapeHtml(image.image_id)}">Photo ${index + 1}</button>`).join(" ")}</dd></dl></section>${extraction.nutrition_columns.length ? `<section class="result-section"><div class="result-heading"><h4>Nutrition columns</h4><span>${extraction.nutrition_columns.length > 1 ? "Select one for comparison" : "Sole column selected"}</span></div><div class="columns">${extraction.nutrition_columns.map((column) => renderColumn(product, column, selected)).join("")}</div></section>` : ""}${extraction.retake_reasons?.length ? `<div class="retakes"><strong>Useful next photo</strong><ul>${extraction.retake_reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul></div>` : ""}</div>`;
    }
    function renderColumn(product, column, selected) { return `<article class="column ${selected === column.column_id ? "selected" : ""}"><div class="column-top"><div><div class="column-title">${escapeHtml(column.label || "Nutrition column")}</div><div class="column-meta">${escapeHtml(stateLabel(column.basis))} · ${escapeHtml(stateLabel(column.preparation_state))}</div></div>${product.extraction.nutrition_columns.length > 1 ? `<div class="select-wrap"><label class="sr-only" for="${product.id}-${column.column_id}">Column for ${escapeHtml(product.title)}</label><select id="${product.id}-${column.column_id}" data-column-select="${product.id}" aria-label="Nutrition column for ${escapeHtml(product.title)}"><option value="">Not selected</option>${product.extraction.nutrition_columns.map((item) => `<option value="${escapeHtml(item.column_id)}" ${selected === item.column_id ? "selected" : ""}>${escapeHtml(item.label || item.column_id)}</option>`).join("")}</select></div>` : ""}</div><div class="observation-list">${column.fields.length ? column.fields.map(renderObservation).join("") : `<div class="obs-state">Source Data Unavailable</div>`}</div></article>`; }
    function renderObservation(field) { const unit = field.unit_text || ""; return `<div class="observation"><div><div class="obs-label">${escapeHtml(field.label || field.nutrient || "Unidentified row")}</div><div class="obs-script" lang="${escapeHtml(field.language || "und")}">${escapeHtml(field.original_script || "Source Data Unavailable")}</div><div class="obs-state">${escapeHtml(stateLabel(field.state))} · ${escapeHtml(stateLabel(field.row_kind))} · ${escapeHtml(stateLabel(field.qualifier))}</div>${renderEvidence(field.evidence)}</div><div class="obs-value">${display(field.value_text, unit)}</div></div>`; }
    function renderEvidence(evidence) { return `<div class="evidence">${(evidence || []).map((pointer) => `<button class="evidence-button" data-evidence="${escapeHtml(pointer.image_id)}">↗ ${escapeHtml(pointer.image_id.slice(0, 8))}</button>`).join("")}</div>`; }
    function renderCompareButton() { const ready = state.products.every((product) => product.extraction && ["complete", "partial"].includes(product.extraction.outcome) && (product.extraction.nutrition_columns.length <= 1 || product.selectedColumnId)); $("compare-button").disabled = !ready; $("comparison-status").textContent = ready ? "Both extractions are ready, including partial evidence." : "Extract both Products to enable comparison."; }
    async function extractProduct(product) { if (!product || !product.photos.length) return; const revision = product.revision; product.loading = true; product.error = ""; invalidateComparison(); render(); const form = new FormData(); form.append("product_id", product.id); product.photos.forEach((photo) => form.append("photos", photo.file, photo.file.name)); try { const response = await fetch("/api/experimental/photo-comparison/extractions", { method:"POST", body:form }); const body = await response.json(); if (!response.ok) throw new Error(body?.error?.message || "The extraction request failed."); if (product.revision !== revision) return; product.extraction = body; product.selectedColumnId = body.nutrition_columns?.length === 1 ? body.nutrition_columns[0].column_id : null; product.retry = false; } catch (error) { if (product.revision !== revision) return; product.error = error.message || "The extraction request failed. Check the provider and retry."; product.retry = true; } finally { if (product.revision === revision) product.loading = false; render(); } }
    async function compareProducts() { const [left, right] = state.products; const payload = { left: left.extraction, right: right.extraction }; if (left.selectedColumnId) payload.left_column_id = left.selectedColumnId; if (right.selectedColumnId) payload.right_column_id = right.selectedColumnId; $("compare-button").disabled = true; $("comparison-status").textContent = "Calculating explicit compatible values…"; try { const response = await fetch("/api/experimental/photo-comparison/comparisons", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) }); const body = await response.json(); if (!response.ok) throw new Error(body?.error?.message || "The comparison request failed."); state.comparison = body; renderComparison(body); } catch (error) { $("comparison-status").textContent = error.message || "The comparison request failed. Retry when both extractions are ready."; $("comparison-status").className = "comparison-status error"; } finally { renderCompareButton(); } }
    function renderComparison(comparison) { $("comparison-status").textContent = "Comparison is based on submitted photo evidence. Review every basis and condition."; $("comparison-status").className = "comparison-status"; $("comparison-output").innerHTML = `<div class="table-wrap"><table><thead><tr><th>Nutrient</th><th>${escapeHtml(state.products[0].title)} · reported</th><th>${escapeHtml(state.products[1].title)} · reported</th><th>Calculated view</th></tr></thead><tbody>${comparison.rows.map((row) => { const left = row.left?.observation; const right = row.right?.observation; const reported = (observation) => observation ? `<div class="reported">${display(observation.value_text, observation.unit_text)}</div>${renderEvidence(observation.evidence)}` : `<div class="reported">Source Data Unavailable</div>`; const calculated = row.derived_difference ? `<div class="calculated">Difference ${display(row.derived_difference.value, row.derived_difference.unit)}</div><div class="basis">${escapeHtml(row.calculation_basis || "Source Data Unavailable")}</div>` : row.normalized_left || row.normalized_right ? `<div class="${row.state === "conditional" ? "conditional" : "calculated"}">Values shown; no difference</div><div class="basis">${escapeHtml(row.calculation_basis || "Source Data Unavailable")}</div>` : `<div class="${row.state === "not_comparable" ? "unavailable" : "conditional"}">${escapeHtml(stateLabel(row.state))}</div>`; return `<tr><td><div class="nutrient-name">${escapeHtml(row.nutrient)}</div><div class="row-reason">${escapeHtml(row.reason || "")}</div>${row.assumptions?.length ? `<div class="basis">${row.assumptions.map(escapeHtml).join(" ")}</div>` : ""}</td><td>${reported(left)}</td><td>${reported(right)}</td><td>${calculated}</td></tr>`; }).join("")}</tbody></table></div>`; }
    function focusEvidence(imageId) { for (const product of state.products) { const index = product.extraction?.images?.findIndex((image) => image.image_id === imageId); if (index !== undefined && index >= 0) { const preview = document.querySelector(`[data-preview="${product.photos[index]?.localId}"]`); preview?.scrollIntoView({behavior:"smooth", block:"center"}); preview?.classList.add("highlight"); setTimeout(() => preview?.classList.remove("highlight"), 1600); return; } } }
    $("compare-button").addEventListener("click", compareProducts); $("reset-button").addEventListener("click", () => { state.products.forEach((product) => { product.revision += 1; product.photos.forEach((photo) => URL.revokeObjectURL(photo.url)); product.photos = []; product.extraction = null; product.selectedColumnId = null; product.error = ""; product.loading = false; }); state.comparison = null; render(); }); render();
  </script>
</body>
</html>"""


def photo_comparison_page() -> str:
    return PAGE
