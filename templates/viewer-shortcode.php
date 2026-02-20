<?php
/**
 * Viewer Shortcode Template
 *
 * Renders the 3D viewer, upload controls, slicer panel, and results.
 * All IDs/classes use slicepress- prefix.
 */
defined('ABSPATH') || exit;
?>
<div class="slicepress-wrapper">
    <!-- Left Column: Viewer -->
    <div class="slicepress-viewer-col">
        <div class="slicepress-viewer" id="slicepress-viewer"></div>
        <div class="slicepress-hint" id="slicepress-hint">Drag to rotate &middot; Scroll to zoom &middot; Right-drag to pan</div>
        <div class="slicepress-drop-overlay" id="slicepress-drop-overlay">Drop file here</div>
        <div class="slicepress-loading-overlay" id="slicepress-loading-overlay">
            <div class="slicepress-spinner"></div>
            <div class="slicepress-loading-text">Loading model&hellip;</div>
        </div>
        <div class="slicepress-error" id="slicepress-error"></div>
    </div>

    <!-- Right Column: Controls -->
    <div class="slicepress-controls-col">

        <!-- Upload Card -->
        <div class="slicepress-card" id="slicepress-upload-card">
            <h3 class="slicepress-card-title">
                <span class="slicepress-step">1</span>
                Upload 3D Model
            </h3>
            <label class="slicepress-upload-label" for="slicepress-file-input">
                Drop STL / 3MF or click to upload
            </label>
            <input type="file" id="slicepress-file-input" class="slicepress-file-input" accept=".stl,.3mf">

            <div class="slicepress-view-buttons">
                <button type="button" class="slicepress-btn slicepress-btn-sm" onclick="slicepressViewer.viewIsometric()">Iso</button>
                <button type="button" class="slicepress-btn slicepress-btn-sm" onclick="slicepressViewer.viewFromTop()">Top</button>
                <button type="button" class="slicepress-btn slicepress-btn-sm" onclick="slicepressViewer.viewFromFront()">Front</button>
                <button type="button" class="slicepress-btn slicepress-btn-sm" onclick="slicepressViewer.viewFromSide()">Side</button>
            </div>

            <button type="button" class="slicepress-btn slicepress-btn-block" onclick="slicepressViewer.resetView()">Reset View</button>

            <div class="slicepress-toggle-row">
                <label class="slicepress-toggle">
                    <input type="checkbox" id="slicepress-wireframe" onchange="slicepressViewer.setWireframe(this.checked)">
                    <span class="slicepress-toggle-track"></span>
                    <span class="slicepress-toggle-text">Wireframe</span>
                </label>
                <label class="slicepress-toggle">
                    <input type="checkbox" id="slicepress-autorotate" onchange="slicepressViewer.setAutoRotate(this.checked)">
                    <span class="slicepress-toggle-track"></span>
                    <span class="slicepress-toggle-text">Auto-rotate</span>
                </label>
            </div>

            <button type="button" class="slicepress-btn slicepress-btn-block slicepress-btn-accent" id="slicepress-orient-btn" onclick="slicepressViewer.autoOrient()" disabled>Smart Orient</button>
        </div>

        <!-- Model Info Card -->
        <div class="slicepress-card slicepress-stats-card" id="slicepress-stats-card">
            <h3 class="slicepress-card-title">Model Info</h3>
            <div class="slicepress-stat"><span class="slicepress-stat-label">Size X</span><span class="slicepress-stat-value" id="slicepress-stat-x">-</span></div>
            <div class="slicepress-stat"><span class="slicepress-stat-label">Size Y</span><span class="slicepress-stat-value" id="slicepress-stat-y">-</span></div>
            <div class="slicepress-stat"><span class="slicepress-stat-label">Size Z</span><span class="slicepress-stat-value" id="slicepress-stat-z">-</span></div>
            <div class="slicepress-stat"><span class="slicepress-stat-label">Triangles</span><span class="slicepress-stat-value" id="slicepress-stat-tris">-</span></div>
        </div>

        <!-- Slice & Quote Card -->
        <div class="slicepress-card" id="slicepress-slice-card">
            <h3 class="slicepress-card-title">
                <span class="slicepress-step">2</span>
                Get Instant Quote
            </h3>

            <div class="slicepress-form-group">
                <label for="slicepress-material">Material</label>
                <select id="slicepress-material"></select>
            </div>

            <div class="slicepress-form-group">
                <label for="slicepress-quality">Print Quality</label>
                <select id="slicepress-quality">
                    <option value="0.08mm Extra Fine">0.08mm Extra Fine</option>
                    <option value="0.12mm High Quality">0.12mm High Quality</option>
                    <option value="0.12mm Fine">0.12mm Fine</option>
                    <option value="0.20mm Standard" selected>0.20mm Standard</option>
                    <option value="0.20mm Strength">0.20mm Strength</option>
                    <option value="0.28mm Extra Draft">0.28mm Draft</option>
                </select>
            </div>

            <button type="button" class="slicepress-btn slicepress-btn-block slicepress-btn-primary" id="slicepress-slice-btn" disabled>Get Instant Quote</button>
        </div>

        <!-- Results Card (hidden until quote) -->
        <div class="slicepress-card slicepress-results-card" id="slicepress-results-card" style="display:none;">
            <h3 class="slicepress-card-title">
                <span class="slicepress-step">3</span>
                Your Quote
            </h3>

            <div class="slicepress-result-row">
                <span>Material Cost</span>
                <span id="slicepress-res-material">-</span>
            </div>
            <div class="slicepress-result-row">
                <span>Electricity</span>
                <span id="slicepress-res-electricity">-</span>
            </div>
            <div class="slicepress-result-row">
                <span>Printer Time</span>
                <span id="slicepress-res-printer">-</span>
            </div>
            <div class="slicepress-result-row">
                <span>Base Fee</span>
                <span id="slicepress-res-minimum">-</span>
            </div>
            <div class="slicepress-result-row slicepress-result-total">
                <span>Total</span>
                <span id="slicepress-res-total">-</span>
            </div>

            <div class="slicepress-result-meta">
                <small>Print time: <span id="slicepress-res-time">-</span></small>
                <small>Filament: <span id="slicepress-res-filament">-</span> g</small>
            </div>

            <div class="slicepress-form-group">
                <label for="slicepress-color">Color</label>
                <select id="slicepress-color"></select>
            </div>

            <button type="button" class="slicepress-btn slicepress-btn-block slicepress-btn-primary" id="slicepress-add-cart-btn">Add to Cart</button>
        </div>
    </div>
</div>
