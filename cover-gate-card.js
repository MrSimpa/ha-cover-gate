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
        this.attachShadow({ mode: 'open' });
    }

    setConfig(config) {
        if (!config.entity) throw new Error('Please define an entity');

        this.config = {
            name: config.name || '',
            entity: config.entity,
            gate_type: config.gate_type || 'sliding', // sliding, swing, garage
            button_text_open: config.button_text_open || 'Open',
            button_text_stop: config.button_text_stop || 'Stop',
            button_text_close: config.button_text_close || 'Close',
            button_style_background: config.button_style_background || 'rgba(255,255,255,0.05)',
            button_style_text: config.button_style_text || 'var(--primary-text-color)',
            button_style_icon: config.button_style_icon || 'inherit',

            // Granular Button Styles
            btn_open_bg: config.btn_open_bg,
            btn_open_text: config.btn_open_text,
            btn_open_icon: config.btn_open_icon || 'mdi:arrow-up',
            btn_open_icon_color: config.btn_open_icon_color,

            btn_stop_bg: config.btn_stop_bg,
            btn_stop_text: config.btn_stop_text,
            btn_stop_icon: config.btn_stop_icon || 'mdi:stop',
            btn_stop_icon_color: config.btn_stop_icon_color,

            btn_close_bg: config.btn_close_bg,
            btn_close_text: config.btn_close_text,
            btn_close_icon: config.btn_close_icon || 'mdi:arrow-down',
            btn_close_icon_color: config.btn_close_icon_color,

            control_style: config.control_style || 'row', // row, single
            show_buttons: config.show_buttons !== false,
            show_name: config.show_name !== false,
            show_state: config.show_state !== false,
            show_stop_button: config.show_stop_button !== false,
            background_opacity: config.background_opacity ?? 100,

            background_opacity: config.background_opacity ?? 100,

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

        this._hass = hass;

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

    _computeStateDisplay(stateObj) {
        if (!stateObj) return '';
        if (this._hass && this._hass.formatEntityState) {
            return this._hass.formatEntityState(stateObj);
        }
        // Fallback
        const state = stateObj.state;
        return state.charAt(0).toUpperCase() + state.slice(1);
    }

    _handleCoverAction(action) {
        if (!this._hass || !this.config) return;
        this._hass.callService('cover', action, {
            entity_id: this.config.entity,
        });
    }

    _handleToggle() {
        if (!this._hass || !this.config) return;
        const stateObj = this._getEntityState();
        if (!stateObj) return;

        // Determine action based on state/position
        // Use real position if available
        let position = 50;
        if (stateObj.attributes.current_position !== undefined) {
            position = Number(stateObj.attributes.current_position);
        } else {
            if (stateObj.state === 'closed') position = 0;
            else if (stateObj.state === 'open') position = 100;
        }

        let action = 'stop_cover';

        if (stateObj.state === 'opening' || stateObj.state === 'closing') {
            action = 'stop_cover';
        } else if (Math.round(position) === 0) {
            action = 'open_cover';
        } else {
            action = 'close_cover';
        }

        this._handleCoverAction(action);
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

        // Use real position if available
        let position = 0;
        if (stateObj.attributes.current_position !== undefined) {
            position = stateObj.attributes.current_position;
        } else {
            // Check if we need to infer state from string state (closed=0, open=100) if checks failed
            if (stateObj.state === 'closed') position = 0;
            else if (stateObj.state === 'open') position = 100;
            else position = 50; // Unknown/Middle
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

        // Update Button States
        const btnOpen = this.shadowRoot.getElementById('btn-open');
        const btnClose = this.shadowRoot.getElementById('btn-close');

        if (btnOpen) {
            if (Math.round(position) === 100) btnOpen.classList.add('disabled');
            else btnOpen.classList.remove('disabled');
        }

        if (btnClose) {
            if (Math.round(position) === 0) btnClose.classList.add('disabled');
            else btnClose.classList.remove('disabled');
        }

        // Update Single Button
        const btnToggle = this.shadowRoot.getElementById('btn-toggle');
        if (btnToggle) {
            const label = btnToggle.querySelector('.ctrl-label');
            const icon = btnToggle.querySelector('ha-icon');

            let text = '';
            let iconName = '';
            let styleType = ''; // open, stop, close

            if (this._state === 'opening' || this._state === 'closing') {
                text = this.config.button_text_stop;
                iconName = this.config.btn_stop_icon || 'mdi:stop';
                styleType = 'stop';
            } else if (Math.round(position) === 0) {
                text = this.config.button_text_open;
                iconName = this.config.btn_open_icon || 'mdi:arrow-up';
                styleType = 'open';
            } else {
                text = this.config.button_text_close;
                iconName = this.config.btn_close_icon || 'mdi:arrow-down';
                styleType = 'close';
            }

            if (label) label.textContent = text;
            if (icon) icon.setAttribute('icon', iconName);

            // Apply style dynamically
            const bg = this.config[`btn_${styleType}_bg`] || this.config.button_style_background;
            const textColor = this.config[`btn_${styleType}_text`] || this.config.button_style_text;
            const iconColor = this.config[`btn_${styleType}_icon_color`] || (this.config.button_style_icon === 'inherit' ? textColor : this.config.button_style_icon);

            btnToggle.style.background = bg;
            btnToggle.style.color = textColor;
            btnToggle.style.borderColor = 'rgba(255,255,255,0.1)';
            btnToggle.style.setProperty('--btn-icon', iconColor);
        }
    }

    _animateGate(position) {
        const gateType = this.config.gate_type;
        const gateVisual = this.shadowRoot.querySelector('.gate-visual');
        if (!gateVisual) return;

        if (gateType === 'sliding') {
            const panel = gateVisual.querySelector('.gate-panel');
            if (panel) {
                // 0% -> Closed (0px), 100% -> Open (Slide Right 100%)
                const translate = position;
                panel.style.transform = `translateX(${translate}%)`;
                // Also update shadow/glow opacity based on movement if desired
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

        // Helper to get button style
        const getBtnStyle = (type) => {
            const bg = this.config[`btn_${type}_bg`] || this.config.button_style_background;
            const text = this.config[`btn_${type}_text`] || this.config.button_style_text;
            const iconColor = this.config[`btn_${type}_icon_color`] || (this.config.button_style_icon === 'inherit' ? text : this.config.button_style_icon);
            return `background: ${bg}; color: ${text}; --btn-icon: ${iconColor}; border-color: rgba(255,255,255,0.1);`;
        };

        const openStyle = getBtnStyle('open');
        const stopStyle = getBtnStyle('stop');
        const closeStyle = getBtnStyle('close');

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
                    flex-direction: column;
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

                .state {
                    font-size: 0.9rem;
                    color: var(--secondary-text-color);
                    margin-top: 2px;
                }

                /* VISUALIZATION CONTAINER */
                .gate-visual-container {
                    width: 100%;
                    height: 105px;
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

                /* SLIDING GATE RESPONSIVE STYLES */
                .gate-sliding-wrapper {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                }
                .gate-track {
                    position: absolute;
                    bottom: 15px;
                    left: 0;
                    width: 100%;
                    height: 4px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 2px;
                }
                .gate-post { 
                    position: absolute;
                    right: 10%;
                    bottom: 15px;
                    width: 12px;
                    height: 70%;
                    background: #444;
                    border: 1px solid #222;
                    border-radius: 2px;
                    z-index: 2;
                }
                .gate-panel {
                    position: absolute;
                    left: 10px; 
                    bottom: 18px;
                    height: 60%;
                    /* Width: distance from left (10px) to post (right 10%) + overlap? 
                       Let's say post is at right: 30px roughly. 
                       Panel should cover the gap. 
                       width: calc(90% - 20px) roughly to touch the post 
                    */
                    width: calc(90% - 20px); 
                    background: rgba(58, 58, 58, 0.3);
                    border: 2px solid var(--accent-color);
                    border-radius: 4px;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-evenly;
                    padding: 4px 0;
                    z-index: 1;
                    transition: transform 0.1s linear;
                    backdrop-filter: blur(2px);
                }
                .gate-bar {
                    width: 100%;
                    height: 2px;
                    background: var(--accent-color);
                    opacity: 0.8;
                }

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
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 8px;
                    padding: 8px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                    transition: all 0.2s;
                    /* Styles set inline */
                }

                .ctrl-btn.disabled {
                    opacity: 0.3;
                    pointer-events: none;
                    background: transparent !important;
                    border-color: transparent !important;
                }

                .ctrl-btn:hover:not(.disabled) {
                    filter: brightness(1.2);
                    border-color: var(--accent-color) !important;
                }

                .ctrl-btn:active:not(.disabled) {
                    filter: brightness(0.8);
                }
                
                .ctrl-btn ha-icon {
                    --mdc-icon-size: 18px;
                    color: var(--btn-icon);
                }

                .ctrl-label {
                    font-size: 0.7rem;
                    font-weight: 500;
                }

            </style>
            
            <ha-card>
                <div class="card-content">
                    ${(this.config.show_name || this.config.show_state) ? `
                    <div class="header">
                        ${this.config.show_name ? `
                        <div class="title">
                            <ha-icon icon="${this._getGateIcon()}"></ha-icon>
                            ${name}
                        </div>
                        ` : ''}
                        
                        ${this.config.show_state ? `
                        <div class="state">
                            ${stateObj ? this._computeStateDisplay(stateObj) : ''}
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}

                    <div class="gate-visual-container">
                        ${this._renderGateVisual(this.config.gate_type)}
                    </div>

                    <div class="controls">
                        <div class="slider-container">
                            <div class="position-fill" style="width: ${position}%"></div>
                            <input type="range" class="position-slider" min="0" max="100" value="${Math.round(position)}">
                        </div>

                        <div class="button-row">
                            ${this.config.control_style === 'single' ? `
                                <button class="ctrl-btn" id="btn-toggle" style="${openStyle}">
                                    <ha-icon icon="${this.config.btn_open_icon}"></ha-icon>
                                    <span class="ctrl-label">${this.config.button_text_open}</span>
                                </button>
                            ` : `
                                <button class="ctrl-btn ${Math.round(position) === 100 ? 'disabled' : ''}" id="btn-open" style="${openStyle}">
                                    <ha-icon icon="${this.config.btn_open_icon}"></ha-icon>
                                    <span class="ctrl-label">${this.config.button_text_open}</span>
                                </button>
                                
                                ${this.config.show_stop_button ? `
                                <button class="ctrl-btn" id="btn-stop" style="${stopStyle}">
                                    <ha-icon icon="${this.config.btn_stop_icon}"></ha-icon>
                                    <span class="ctrl-label">${this.config.button_text_stop}</span>
                                </button>
                                ` : ''}

                                <button class="ctrl-btn ${Math.round(position) === 0 ? 'disabled' : ''}" id="btn-close" style="${closeStyle}">
                                    <ha-icon icon="${this.config.btn_close_icon}"></ha-icon>
                                    <span class="ctrl-label">${this.config.button_text_close}</span>
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            </ha-card>
        `;

        this._addEventListeners();
        this._updateVisuals(position);
    }

    _renderGateVisual(type) {
        if (type === 'sliding') {
            return `
                <div class="gate-sliding-wrapper gate-visual">
                    <div class="gate-track"></div>
                    <div class="gate-post"></div>
                    <div class="gate-panel">
                        <div class="gate-bar"></div>
                        <div class="gate-bar"></div>
                        <div class="gate-bar"></div>
                    </div>
                </div>
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
        this.shadowRoot.getElementById('btn-toggle')?.addEventListener('click', () => this._handleToggle());

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

        // Only render structure once
        if (this.querySelector('.card-config')) {
            // Update values only
            const config = this._config;
            const elements = this.querySelectorAll('[configValue]');
            elements.forEach(el => {
                const key = el.getAttribute('configValue');
                if (!key) return;

                let value = config[key];
                if (el.tagName === 'HA-CHECKBOX') {
                    // Checkbox handling
                    // 'show_buttons' is not in the current template, but keeping it as per instruction
                    if (key === 'show_buttons') value = config.show_buttons !== false;
                    if (key === 'show_stop_button') value = config.show_stop_button !== false;
                    if (key === 'show_name') value = config.show_name !== false;
                    if (key === 'show_state') value = config.show_state !== false;
                    el.checked = value;
                } else if (el.tagName === 'HA-BACKEND-SLIDER') {
                    // Slider default
                    if (key === 'background_opacity' && value === undefined) value = 100;
                    el.value = value;
                } else {
                    // Textfield, select, picker
                    if (key === 'gate_type' && !value) value = 'sliding';
                    if (key === 'control_style' && !value) value = 'row';
                    // Maintain focus if this element is active to avoid cursor jumping
                    if (el !== document.activeElement && el.value !== value) {
                        el.value = value !== undefined ? value : '';
                    }
                }
            });
            return;
        }

        // Initial Render
        this.innerHTML = `
            <div class="card-config">
                <div class="side-by-side">
                    <ha-entity-picker
                        label="Entity"
                        .hass="${this._hass}"
                        .value="${this._config.entity}"
                        .includeDomains="${['cover']}"
                        configValue="entity"
                    ></ha-entity-picker>
                </div>
                
                <div class="side-by-side">
                    <ha-textfield
                        label="Name (Optional)"
                        .value="${this._config.name || ''}"
                        configValue="name"
                    ></ha-textfield>
                </div>
                
                <h3>Button Labels</h3>
                 <div class="side-by-side">
                    <ha-textfield
                        label="Open Text"
                        .value="${this._config.button_text_open || 'Open'}"
                        configValue="button_text_open"
                    ></ha-textfield>
                    <ha-textfield
                        label="Stop Text"
                        .value="${this._config.button_text_stop || 'Stop'}"
                        configValue="button_text_stop"
                    ></ha-textfield>
                    <ha-textfield
                        label="Close Text"
                        .value="${this._config.button_text_close || 'Close'}"
                        configValue="button_text_close"
                    ></ha-textfield>
                </div>

                <h3>Button Global Styling</h3>
                 <div class="side-by-side">
                    <ha-textfield
                        label="Global BG"
                        .value="${this._config.button_style_background || 'rgba(255,255,255,0.05)'}"
                        configValue="button_style_background"
                    ></ha-textfield>
                    <ha-textfield
                        label="Global Text"
                        .value="${this._config.button_style_text || 'var(--primary-text-color)'}"
                        configValue="button_style_text"
                    ></ha-textfield>
                    <ha-textfield
                        label="Global Icon Color"
                        .value="${this._config.button_style_icon || ''}"
                        configValue="button_style_icon"
                    ></ha-textfield>
                </div>

                <h3>Open Button</h3>
                <div class="side-by-side">
                     <ha-textfield label="BG" .value="${this._config.btn_open_bg || ''}" configValue="btn_open_bg"></ha-textfield>
                     <ha-textfield label="Text" .value="${this._config.btn_open_text || ''}" configValue="btn_open_text"></ha-textfield>
                </div>
                <div class="side-by-side">
                     <ha-icon-picker label="Icon" .value="${this._config.btn_open_icon || ''}" configValue="btn_open_icon"></ha-icon-picker>
                     <ha-textfield label="Icon Color" .value="${this._config.btn_open_icon_color || ''}" configValue="btn_open_icon_color"></ha-textfield>
                </div>

                <h3>Stop Button</h3>
                <div class="side-by-side">
                     <ha-textfield label="BG" .value="${this._config.btn_stop_bg || ''}" configValue="btn_stop_bg"></ha-textfield>
                     <ha-textfield label="Text" .value="${this._config.btn_stop_text || ''}" configValue="btn_stop_text"></ha-textfield>
                </div>
                <div class="side-by-side">
                     <ha-icon-picker label="Icon" .value="${this._config.btn_stop_icon || ''}" configValue="btn_stop_icon"></ha-icon-picker>
                     <ha-textfield label="Icon Color" .value="${this._config.btn_stop_icon_color || ''}" configValue="btn_stop_icon_color"></ha-textfield>
                </div>

                <h3>Close Button</h3>
                 <div class="side-by-side">
                     <ha-textfield label="BG" .value="${this._config.btn_close_bg || ''}" configValue="btn_close_bg"></ha-textfield>
                     <ha-textfield label="Text" .value="${this._config.btn_close_text || ''}" configValue="btn_close_text"></ha-textfield>
                </div>
                <div class="side-by-side">
                     <ha-icon-picker label="Icon" .value="${this._config.btn_close_icon || ''}" configValue="btn_close_icon"></ha-icon-picker>
                     <ha-textfield label="Icon Color" .value="${this._config.btn_close_icon_color || ''}" configValue="btn_close_icon_color"></ha-textfield>
                </div>

                <div class="side-by-side">
                     <div class="select-label">Control Style</div>
                     <select
                        class="native-select"
                        configValue="control_style"
                    >
                        <option value="row">3-Button Row</option>
                        <option value="single">Single Button</option>
                    </select>
                </div>

                <div class="side-by-side">
                     <div class="select-label">Gate Type</div>
                     <select
                        class="native-select"
                        configValue="gate_type"
                    >
                        <option value="sliding">Sliding Gate</option>
                        <option value="swing">Swing Gate</option>
                        <option value="garage">Garage Door</option>
                    </select>
                </div>
                
                <br>
                <h3>Appearance</h3>
                <div class="side-by-side">
                    <ha-backend-slider
                        label="Background Opacity"
                        .value="${this._config.background_opacity ?? 100}"
                         min="0" max="100" step="10"
                        configValue="background_opacity"
                    ></ha-backend-slider>
                </div>

                <div class="side-by-side">
                    <ha-formfield label="Show Stop Button">
                        <ha-checkbox
                            .checked="${this._config.show_stop_button !== false}"
                            configValue="show_stop_button"
                        ></ha-checkbox>
                    </ha-formfield>
                </div>
                
                <div class="side-by-side">
                    <ha-formfield label="Show Name">
                        <ha-checkbox
                            .checked="${this._config.show_name !== false}"
                            configValue="show_name"
                        ></ha-checkbox>
                    </ha-formfield>
                    <ha-formfield label="Show State">
                        <ha-checkbox
                            .checked="${this._config.show_state !== false}"
                            configValue="show_state"
                        ></ha-checkbox>
                    </ha-formfield>
                </div>
            </div>
            <style>
                .card-config { display: flex; flex-direction: column; gap: 12px; }
                .side-by-side { display: flex; gap: 8px; align-items: center; }
                .select-label { font-size: 12px; color: var(--secondary-text-color); margin-bottom: 4px; }
                .native-select { width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); }
            </style>
        `;

        // Attach event listeners once
        this.querySelectorAll('[configValue]').forEach(el => {
            el.addEventListener('value-changed', this._valueChanged.bind(this));
            if (el.tagName === 'HA-CHECKBOX' || el.tagName === 'HA-BACKEND-SLIDER') {
                el.addEventListener('change', this._valueChanged.bind(this));
            }
            if (el.tagName === 'HA-TEXTFIELD') {
                el.addEventListener('input', this._valueChanged.bind(this));
            }
            if (el.tagName === 'SELECT') {
                el.addEventListener('change', this._valueChanged.bind(this));
            }
            if (el.tagName === 'HA-ICON-PICKER') {
                el.addEventListener('value-changed', this._valueChanged.bind(this));
            }
        });
    }

    _valueChanged(e) {
        if (!this._config || !this._hass) return;
        const target = e.target;
        let value = target.value;

        if (target.tagName === 'HA-CHECKBOX') {
            value = target.checked;
        } else {
            value = e.detail?.value !== undefined ? e.detail.value : target.value;
        }

        const configValue = target.getAttribute('configValue');

        if (this._config[configValue] === value) return;

        if (configValue) {
            this._config = {
                ...this._config,
                [configValue]: value,
            };
            this.dispatchEvent(new CustomEvent('config-changed', {
                detail: { config: this._config },
                bubbles: true,
                composed: true
            }));
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
