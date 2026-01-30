/**
 * Cover Gate Card
 * A modern, sleek card for controlling gates/garage doors with advanced animations.
 * 
 * Features:
 * - Multiple types: Sliding Gate, Swing Gate, Garage Door
 * - Simulated position based on time
 * - Custom styling (opacity, colors)
 * - Interactive animations
 */

const CARD_VERSION = '1.0.0';

console.info(
    `%c COVER-GATE-CARD %c ${CARD_VERSION} `,
    'color: white; background: #2980b9; font-weight: 700;',
    'color: #2980b9; background: white; font-weight: 700;'
);

class CoverGateCard extends HTMLElement {
    static get properties() {
        return { hass: {}, config: {} };
    }

    constructor() {
        super();
        this._rendered = false;
        this._simulatedPosition = 0;
        this._state = 'stopped'; // stopped, opening, closing
        this._lastUpdate = 0;
        this._animationFrame = null;
    }

    setConfig(config) {
        if (!config.entity) throw new Error('Please define an entity');

        this.config = {
            name: config.name || '',
            entity: config.entity,
            gate_type: config.gate_type || 'sliding', // sliding, swing, garage
            show_buttons: config.show_buttons !== false,
            show_stop_button: config.show_stop_button !== false,
            background_opacity: config.background_opacity ?? 100,

            // Time based simulation
            opening_time: config.opening_time || 0,
            closing_time: config.closing_time || 0,
            assume_position_from_time: config.assume_position_from_time || false,

            ...config
        };

        // Normalize types
        if (!['sliding', 'swing', 'garage'].includes(this.config.gate_type)) {
            this.config.gate_type = 'sliding';
        }

        this._rendered = false;
    }

    set hass(hass) {
        const oldHass = this._hass;
        this._hass = hass;

        // Check for state changes to trigger simulation
        if (this.config.opening_time > 0 || this.config.closing_time > 0) {
            this._checkStateChange(oldHass, hass);
        }

        if (!this._rendered) {
            this._render();
            this._rendered = true;
        } else {
            this._update();
        }
    }

    get hass() {
        return this._hass;
    }

    _getEntityState() {
        if (!this._hass || !this.config) return null;
        return this._hass.states[this.config.entity];
    }

    _checkStateChange(oldHass, newHass) {
        if (!oldHass) return;

        const entityId = this.config.entity;
        const oldState = oldHass.states[entityId]?.state;
        const newState = newHass.states[entityId]?.state;

        if (oldState !== newState) {
            if (newState === 'opening') {
                this._startSimulation('opening');
            } else if (newState === 'closing') {
                this._startSimulation('closing');
            } else {
                this._stopSimulation();
                // Sync position if we have a known end state and no position attribute
                if (newState === 'open') this._simulatedPosition = 100;
                if (newState === 'closed') this._simulatedPosition = 0;
            }
        }
    }

    _startSimulation(direction) {
        if (this._animationFrame) cancelAnimationFrame(this._animationFrame);

        this._state = direction;
        this._lastUpdate = performance.now();

        const animate = (time) => {
            const deltaTime = (time - this._lastUpdate) / 1000; // seconds
            this._lastUpdate = time;

            const duration = direction === 'opening'
                ? (this.config.opening_time || 10)
                : (this.config.closing_time || 10);

            const deltaPos = (100 / duration) * deltaTime;

            if (direction === 'opening') {
                this._simulatedPosition = Math.min(100, this._simulatedPosition + deltaPos);
            } else {
                this._simulatedPosition = Math.max(0, this._simulatedPosition - deltaPos);
            }

            this._updateVisuals(this._simulatedPosition);

            if ((direction === 'opening' && this._simulatedPosition < 100) ||
                (direction === 'closing' && this._simulatedPosition > 0)) {
                this._animationFrame = requestAnimationFrame(animate);
            } else {
                this._state = 'stopped';
            }
        };

        this._animationFrame = requestAnimationFrame(animate);
    }

    _stopSimulation() {
        if (this._animationFrame) cancelAnimationFrame(this._animationFrame);
        this._state = 'stopped';
    }

    _handleCoverAction(action) {
        if (!this._hass || !this.config) return;
        this._hass.callService('cover', action, {
            entity_id: this.config.entity,
        });

        // Immediate feedback for simulation logic if state doesn't update fast enough
        // or if we rely purely on commands.
        // But _checkStateChange is more robust if the entity reports state.
    }

    _openMoreInfo() {
        const event = new CustomEvent('hass-more-info', {
            detail: { entityId: this.config.entity },
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);
    }

    _update() {
        const stateObj = this._getEntityState();
        if (!stateObj) return;

        // Use real position if available, otherwise simulation
        let position = 0;
        if (stateObj.attributes.current_position !== undefined && !this.config.assume_position_from_time) {
            position = stateObj.attributes.current_position;
            this._simulatedPosition = position; // Sync simulation
        } else {
            // Check if we need to infer state from string state (closed=0, open=100) if checks failed
            if (this._state === 'stopped') {
                if (stateObj.state === 'closed') this._simulatedPosition = 0;
                if (stateObj.state === 'open') this._simulatedPosition = 100;
            }
            position = this._simulatedPosition;
        }

        this._updateVisuals(position);
    }

    _updateVisuals(position) {
        if (!this.shadowRoot) return;

        // Slider
        const positionSlider = this.shadowRoot.querySelector('.position-slider');
        const positionFill = this.shadowRoot.querySelector('.position-fill');

        if (positionSlider && !positionSlider.matches(':active')) {
            positionSlider.value = Math.round(position);
        }
        if (positionFill) {
            positionFill.style.width = `${Math.round(position)}%`;
        }

        // Gate Animation
        this._animateGate(position);
    }

    _animateGate(position) {
        const gateType = this.config.gate_type;
        const gateVisual = this.shadowRoot.querySelector('.gate-visual');
        if (!gateVisual) return;

        if (gateType === 'sliding') {
            const panel = gateVisual.querySelector('.gate-sliding-panel');
            if (panel) {
                // 0% -> Closed (0px), 100% -> Open (Slide Right)
                // Assuming panel width is ~80% of view, we slide it.
                // SVG viewbox 0 0 200 120. Panel width approx 140.
                const translate = (position / 100) * 130;
                panel.style.transform = `translateX(${translate}px)`;
            }
        } else if (gateType === 'swing') {
            const left = gateVisual.querySelector('.gate-swing-left');
            const right = gateVisual.querySelector('.gate-swing-right');
            if (left && right) {
                // Rotate open. Left: 0 to -90deg? 
                // Using scaleX/skew/rotate logic or simple perspective rotation
                // Simpler 2D representation: Translate + ScaleX slightly to simulate perspective opening
                // Or just Rotate from a pivot point.
                // SVG Origin setup required.

                // Let's assume origin is at the hinge (outer edges)
                // Left hinge: x=20, Right hinge: x=180
                const angle = (position / 100) * 90;
                // Since this is 2D svg, rotation needs perspective or just pure rotation
                // CSS RotateY requires HTML/ForeignObject or very modern SVG.
                // Simple SVG rotate is 2D. 
                // Let's use scaleX to simulate opening "into" the background
                const scale = 1 - (position / 100) * 0.9; // 1 -> 0.1

                left.style.transform = `scaleX(${scale})`;
                right.style.transform = `scaleX(${scale})`;
            }
        } else if (gateType === 'garage') {
            const panels = gateVisual.querySelectorAll('.garage-panel');
            // Lift panels up.
            // 0% = Down (visible), 100% = Up (hidden/stacked)
            const totalHeight = 100; // SVG space
            const slideUp = (position / 100) * totalHeight;

            panels.forEach((p, i) => {
                // Staggered or all together? All together for sectional usually
                p.style.transform = `translateY(-${slideUp}px)`;
            });
        }
    }

    _getGateIcon() {
        switch (this.config.gate_type) {
            case 'garage': return 'mdi:garage';
            case 'swing': return 'mdi:gate';
            default: return 'mdi:gate';
        }
    }

    _render() {
        if (!this.config) return;
        const stateObj = this._getEntityState();
        const name = this.config.name || (stateObj ? stateObj.attributes.friendly_name : this.config.entity);
        const position = this._simulatedPosition;

        if (!this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
        }

        const opacity = (this.config.background_opacity ?? 100) / 100;

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    --accent-color: var(--state-icon-active-color, var(--primary-color, #03a9f4));
                    --glass-bg: rgba(var(--rgb-card-background-color, 30, 30, 30), ${opacity});
                }
                
                ha-card {
                    background: var(--glass-bg);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                    transition: background 0.3s;
                }

                .card-content {
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .header {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 8px;
                }
                
                .title {
                    font-size: 1.2rem;
                    font-weight: 500;
                    color: var(--primary-text-color);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                /* VISUALIZATION CONTAINER */
                .gate-visual-container {
                    width: 100%;
                    height: 140px;
                    position: relative;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background: rgba(0,0,0,0.2);
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.05);
                    box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);
                    overflow: hidden;
                }

                svg.gate-visual {
                    width: 100%;
                    height: 100%;
                    max-width: 300px;
                }

                /* SLIDING GATE STYLES */
                .gate-sliding-track { stroke: rgba(255,255,255,0.2); stroke-width: 2; }
                .gate-post { fill: #444; stroke: #222; }
                .gate-sliding-panel { 
                    fill: #3a3a3a; 
                    stroke: var(--accent-color); 
                    stroke-width: 2; 
                    transition: transform 0.1s linear;
                    /* Glow effect */
                    filter: drop-shadow(0 0 2px var(--accent-color));
                }
                .gate-bars path { stroke: rgba(255,255,255,0.1); stroke-width: 1; }

                /* SWING GATE STYLES */
                .gate-swing-left, .gate-swing-right {
                    fill: #3a3a3a;
                    stroke: var(--accent-color);
                    stroke-width: 2;
                    transform-origin: 20px 60px; /* Adjust for right panel */
                    transition: transform 0.1s linear;
                }
                .gate-swing-right { transform-origin: 180px 60px; }

                /* GARAGE STYLES */
                .garage-panel {
                    fill: #3a3a3a;
                    stroke: var(--accent-color);
                    stroke-width: 1.5;
                    transition: transform 0.1s linear;
                }

                /* CONTROLS */
                .controls {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .slider-container {
                    position: relative;
                    height: 24px;
                    display: flex;
                    align-items: center;
                }
                
                .position-fill {
                    position: absolute;
                    left: 0;
                    height: 6px;
                    border-radius: 3px;
                    background: var(--accent-color);
                    box-shadow: 0 0 8px var(--accent-color);
                    z-index: 1;
                    pointer-events: none;
                }

                .position-slider {
                    -webkit-appearance: none;
                    width: 100%;
                    height: 6px;
                    border-radius: 3px;
                    background: rgba(255,255,255,0.1);
                    outline: none;
                    position: relative;
                    z-index: 2;
                }

                .position-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #fff;
                    cursor: pointer;
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    margin-top: -6px; /* Center on track */
                }

                .button-row {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                }

                .ctrl-btn {
                    flex: 1;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 10px;
                    padding: 12px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    transition: all 0.2s;
                    color: var(--primary-text-color);
                }

                .ctrl-btn:hover {
                    background: rgba(255,255,255,0.1);
                    border-color: var(--accent-color);
                }

                .ctrl-btn:active {
                    background: var(--accent-color);
                    color: #fff;
                }
                
                .ctrl-btn ha-icon {
                    --mdc-icon-size: 24px;
                }

                .ctrl-label {
                    font-size: 0.8rem;
                    font-weight: 500;
                }

            </style>
            
            <ha-card>
                <div class="card-content">
                    <div class="header">
                        <div class="title">
                            <ha-icon icon="${this._getGateIcon()}"></ha-icon>
                            ${name}
                        </div>
                    </div>

                    <div class="gate-visual-container">
                        ${this._renderSvg(this.config.gate_type)}
                    </div>

                    <div class="controls">
                        <div class="slider-container">
                            <div class="position-fill" style="width: ${position}%"></div>
                            <input type="range" class="position-slider" min="0" max="100" value="${Math.round(position)}">
                        </div>

                        <div class="button-row">
                            <button class="ctrl-btn" id="btn-open">
                                <ha-icon icon="mdi:arrow-up"></ha-icon>
                                <span class="ctrl-label">Open</span>
                            </button>
                            
                            ${this.config.show_stop_button ? `
                            <button class="ctrl-btn" id="btn-stop">
                                <ha-icon icon="mdi:stop"></ha-icon>
                                <span class="ctrl-label">Stop</span>
                            </button>
                            ` : ''}

                            <button class="ctrl-btn" id="btn-close">
                                <ha-icon icon="mdi:arrow-down"></ha-icon>
                                <span class="ctrl-label">Close</span>
                            </button>
                        </div>
                    </div>
                </div>
            </ha-card>
        `;

        this._addEventListeners();
        this._updateVisuals(position);
    }

    _renderSvg(type) {
        if (type === 'sliding') {
            return `
                <svg class="gate-visual" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
                    <!-- Ground/Track -->
                    <line x1="10" y1="110" x2="190" y2="110" class="gate-sliding-track" />
                    
                    <!-- Fixed Post (Right) -->
                    <rect x="170" y="20" width="20" height="90" rx="2" class="gate-post" />
                    
                    <!-- Sliding Panel -->
                    <g class="gate-sliding-panel">
                        <rect x="20" y="30" width="140" height="75" rx="2" fill-opacity="0.3" />
                         <!-- Bars -->
                        <line x1="20" y1="45" x2="160" y2="45" stroke="var(--accent-color)" stroke-width="2" />
                        <line x1="20" y1="65" x2="160" y2="65" stroke="var(--accent-color)" stroke-width="2" />
                        <line x1="20" y1="85" x2="160" y2="85" stroke="var(--accent-color)" stroke-width="2" />
                        <rect x="20" y="30" width="140" height="75" rx="2" fill="none" class="gate-frame" />
                    </g>
                </svg>
            `;
        } else if (type === 'swing') {
            return `
                <svg class="gate-visual" viewBox="0 0 200 120">
                    <!-- Posts -->
                    <rect x="10" y="20" width="10" height="90" class="gate-post" />
                    <rect x="180" y="20" width="10" height="90" class="gate-post" />
                    
                    <!-- Left Leaf -->
                    <g class="gate-swing-left" style="transform-origin: 20px 65px;">
                        <rect x="20" y="30" width="75" height="70" rx="2" fill-opacity="0.3" />
                        <rect x="20" y="30" width="75" height="70" rx="2" fill="none" stroke="var(--accent-color)" />
                        <line x1="30" y1="30" x2="30" y2="100" stroke="rgba(255,255,255,0.2)" />
                        <line x1="50" y1="30" x2="50" y2="100" stroke="rgba(255,255,255,0.2)" />
                        <line x1="70" y1="30" x2="70" y2="100" stroke="rgba(255,255,255,0.2)" />
                    </g>
                    
                    <!-- Right Leaf -->
                    <g class="gate-swing-right" style="transform-origin: 180px 65px;">
                        <rect x="105" y="30" width="75" height="70" rx="2" fill-opacity="0.3" />
                        <rect x="105" y="30" width="75" height="70" rx="2" fill="none" stroke="var(--accent-color)" />
                        <line x1="125" y1="30" x2="125" y2="100" stroke="rgba(255,255,255,0.2)" />
                        <line x1="145" y1="30" x2="145" y2="100" stroke="rgba(255,255,255,0.2)" />
                        <line x1="165" y1="30" x2="165" y2="100" stroke="rgba(255,255,255,0.2)" />
                    </g>
                </svg>
            `;
        } else if (type === 'garage') {
            return `
                <svg class="gate-visual" viewBox="0 0 200 120">
                    <!-- Wall Frame -->
                    <path d="M20,110 V20 H180 V110" fill="none" stroke="#444" stroke-width="10" />
                    
                    <g class="garage-panels">
                        <rect class="garage-panel" x="30" y="80" width="140" height="25" rx="1" />
                        <rect class="garage-panel" x="30" y="54" width="140" height="25" rx="1" />
                        <rect class="garage-panel" x="30" y="28" width="140" height="25" rx="1" />
                    </g>
                </svg>
             `;
        }
    }

    _addEventListeners() {
        if (!this.shadowRoot) return;

        this.shadowRoot.getElementById('btn-open')?.addEventListener('click', () => this._handleCoverAction('open_cover'));
        this.shadowRoot.getElementById('btn-close')?.addEventListener('click', () => this._handleCoverAction('close_cover'));
        this.shadowRoot.getElementById('btn-stop')?.addEventListener('click', () => this._handleCoverAction('stop_cover'));

        const slider = this.shadowRoot.querySelector('.position-slider');
        if (slider) {
            slider.addEventListener('change', (e) => {
                this._hass.callService('cover', 'set_cover_position', {
                    entity_id: this.config.entity,
                    position: parseInt(e.target.value)
                });
            });
            // Live update for dragging (optional, depends on if we want visual feedback immediately)
            slider.addEventListener('input', (e) => {
                this._updateVisuals(parseInt(e.target.value));
            });
        }
    }

    // EDITOR
    static getConfigElement() {
        return document.createElement('cover-gate-card-editor');
    }

    getCardSize() {
        return 3;
    }
}

// EDITOR CLASS
class CoverGateCardEditor extends HTMLElement {
    setConfig(config) {
        this._config = config;
        this.render();
    }

    set hass(hass) {
        this._hass = hass;
        this.render(); // Update if needed
    }

    render() {
        if (!this._hass || !this._config) return;

        // Simple innerHTML render for editor (could be LitElement but vanilla JS here)
        this.innerHTML = `
            <div class="card-config">
                <div class="side-by-side">
                    <ha-entity-picker
                        label="Entity"
                        .hass="${this._hass}"
                        .value="${this._config.entity}"
                        .includeDomains="${['cover']}"
                        @value-changed="${this._valueChanged}"
                        .configValue="${'entity'}"
                    ></ha-entity-picker>
                </div>
                
                <div class="side-by-side">
                    <ha-textfield
                        label="Name (Optional)"
                        .value="${this._config.name || ''}"
                        .configValue="${'name'}"
                        @input="${this._valueChanged}"
                    ></ha-textfield>
                </div>

                <div class="side-by-side">
                     <ha-select
                        label="Gate Type"
                        .value="${this._config.gate_type || 'sliding'}"
                        .configValue="${'gate_type'}"
                        @selected="${this._valueChanged}"
                        fixedMenuPosition
                        naturalMenuWidth
                    >
                        <mwc-list-item value="sliding">Sliding Gate</mwc-list-item>
                        <mwc-list-item value="swing">Swing Gate</mwc-list-item>
                        <mwc-list-item value="garage">Garage Door</mwc-list-item>
                    </ha-select>
                </div>
                
                <br>
                <h3>Simulation Settings (Optional)</h3>
                <div class="side-by-side">
                     <ha-textfield
                        label="Opening Time (sec)"
                        type="number"
                        .value="${this._config.opening_time || 0}"
                        .configValue="${'opening_time'}"
                        @input="${this._valueChanged}"
                    ></ha-textfield>
                    <ha-textfield
                        label="Closing Time (sec)"
                        type="number"
                        .value="${this._config.closing_time || 0}"
                        .configValue="${'closing_time'}"
                        @input="${this._valueChanged}"
                    ></ha-textfield>
                </div>
                
                <br>
                <h3>Appearance</h3>
                <div class="side-by-side">
                    <ha-backend-slider
                        label="Background Opacity"
                        .value="${this._config.background_opacity ?? 100}"
                         min="0" max="100" step="10"
                        .configValue="${'background_opacity'}"
                        @change="${this._valueChanged}"
                    ></ha-backend-slider>
                </div>

                <div class="side-by-side">
                    <ha-formfield label="Show Stop Button">
                        <ha-checkbox
                            .checked="${this._config.show_stop_button !== false}"
                            .configValue="${'show_stop_button'}"
                            @change="${this._valueChanged}"
                        ></ha-checkbox>
                    </ha-formfield>
                </div>
            </div>
            <style>
                .card-config { display: flex; flex-direction: column; gap: 12px; }
                .side-by-side { display: flex; gap: 8px; align-items: center; }
                ha-select { width: 100%; }
            </style>
        `;

        // Re-attach event listeners because innerHTML wipes them
        this.querySelectorAll('[configValue]').forEach(el => {
            if (el.tagName === 'HA-ENTITY-PICKER' || el.tagName === 'HA-SELECT') {
                el.addEventListener('value-changed', this._valueChanged.bind(this));
                // For ha-select 'selected' might be needed depending on version, generic catch:
                el.addEventListener('selected', (e) => {
                    e.stopPropagation();
                    this._valueChanged({ target: el, detail: { value: el.value } });
                });
            } else if (el.tagName === 'HA-TEXTFIELD' || el.tagName === 'HA-BACKEND-SLIDER') {
                el.addEventListener('input', this._valueChanged.bind(this)); // live update
                el.addEventListener('change', this._valueChanged.bind(this));
            } else if (el.tagName === 'HA-CHECKBOX') {
                el.addEventListener('change', this._valueChanged.bind(this));
            }
        });
    }

    _valueChanged(e) {
        if (!this._config || !this._hass) return;
        const target = e.target;
        const value = target.checked !== undefined ? target.checked : (e.detail?.value || target.value);
        const configValue = target.configValue;

        if (this._config[configValue] === value) return;

        if (configValue) {
            this._config = {
                ...this._config,
                [configValue]: value,
            };
            this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
        }
    }
}

customElements.define('cover-gate-card', CoverGateCard);
customElements.define('cover-gate-card-editor', CoverGateCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "cover-gate-card",
    name: "Cover Gate Card",
    preview: true,
    description: "Animated card for courtyard gates and garage doors"
});
