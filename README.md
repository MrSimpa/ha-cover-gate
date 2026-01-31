# Cover Gate Card
A modern Home Assistant custom card for controlling gates and garage doors with advanced animations and styling.

[![Donate with PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/donate/?business=A3X9JMT39M3U2&no_recurring=0&currency_code=EUR)

*If you like this project, please support me.*

## Features
- 🚪 **Multiple Gate Types**: Sliding Gate (Responsive), Swing Gate, Garage Door
- 🎨 **Advanced Visualization**: Animated visuals that adapt to the card width.
- 🎮 **Control Modes**: Choose between a classic **3-Button Row** or a smart **Single Button** control.
- ✨ **Granular Styling**: Customize background, text, and icon colors for *each* button state (Open, Stop, Close).
- ℹ️ **State Display**: Optionally show the entity state text (e.g., "Open", "Closed") in the header.

## Screenshots

| Sliding Gate | Swing Gate | Garage Door |
|:---:|:---:|:---:|
| ![Sliding Gate](screenshot.png) | ![Swing Gate](screenshot-swing.png) | ![Garage Door](screenshot-garage.png) |

## Installation

### HACS (Recommended)
1. Open HACS in Home Assistant.
2. Go to **Frontend**.
3. Click the menu button (top right) -> **Custom repositories**.
4. Add the URL of your repository:
   `https://github.com/MrSimpa/ha-cover-gate`
5. Select category **Lovelace**.
6. Click **Add**.
7. Find "Cover Gate Card" in the list and install it.
8. Restart Home Assistant (or reload resources).

### Manual Installation
1. Copy `cover-gate-card.js` to `/config/www/cover-gate-card.js`
2. Add to resources in Home Assistant:
```yaml
resources:
  - url: /local/cover-gate-card.js
    type: module
```

## Configuration

### Visual Editor
The card includes a full visual editor for easy configuration of all options, including colors and icons.

### Manual YAML

```yaml
type: custom:cover-gate-card
entity: cover.my_gate
gate_type: sliding          # sliding (default), swing, garage
control_style: row          # row (default), single
show_state: true            # true (default), false
background_opacity: 80      # 0-100 (optional, default 100)

# Branding / Styling
button_style_background: 'rgba(255,0,0,0.2)' # Global button BG
btn_open_bg: '#4CAF50'      # Specific BG for Open button
btn_open_icon: 'mdi:door-open' 
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **General** | | | |
| `entity` | string | **required** | Cover entity ID |
| `name` | string | entity name | Custom display name |
| `gate_type` | string | `sliding` | `sliding`, `swing`, or `garage` |
| `control_style` | string | `row` | `row` (Open/Stop/Close) or `single` (Dynamic Button) |
| **Display** | | | |
| `show_name` | boolean | `true` | Show/Hide the card title |
| `show_state` | boolean | `true` | Show/Hide the text state in header |
| `show_buttons` | boolean | `true` | Show/Hide all control buttons |
| `show_stop_button` | boolean | `true` | Show/Hide the Stop button (in Row mode) |
| `background_opacity` | number | `100` | Card background opacity (0-100) |
| **Styling (Global)** | | | |
| `button_style_background` | string | `rgba(255,255,255,0.05)` | Default background for all buttons |
| `button_style_text` | string | `var(--primary-text-color)` | Default text color |
| `button_style_icon` | string | `inherit` | Default icon color |
| **Styling (Granular)** | | | |
| `btn_open_bg` | string | | Background for Open button (or Single button in 'Closed' state) |
| `btn_open_text` | string | | Text color for Open button |
| `btn_open_icon` | string | `mdi:arrow-up` | Icon for Open button |
| `btn_open_icon_color` | string | | Icon color for Open button |
| `btn_stop_bg` | string | | Background for Stop button |
| `btn_stop_text` | string | | Text color for Stop button |
| `btn_stop_icon` | string | `mdi:stop` | Icon for Stop button |
| `btn_stop_icon_color` | string | | Icon color for Stop button |
| `btn_close_bg` | string | | Background for Close button |
| `btn_close_text` | string | | Text color for Close button |
| `btn_close_icon` | string | `mdi:arrow-down` | Icon for Close button |
| `btn_close_icon_color` | string | | Icon color for Close button |

## Converting Switches to Covers
Since most garage doors or gates do not operate in "cover" mode by default but rather as a simple switch, you can achieve full Cover functionality using this template:

```yaml
# 1. Helper to track stop state
input_boolean:
  garage_door_stop_active:
    initial: off

# 2. Script to handle stop action
script:
  garage_door_stop:
    sequence:
      - service: switch.turn_off
        target:
          entity_id: switch.garage_door
      - delay: '00:00:10'
      - service: input_boolean.turn_off
        target:
          entity_id: input_boolean.garage_door_stop_active
          
# 3. The Cover Template
template:
  - cover:
      - device_class: garage
        name: Garage door
        # Define entity icon
        icon: >
          {% if is_state('binary_sensor.garage_door_input', 'on') %}
            mdi:fence
          {% else %}
            mdi:gate-open
          {% endif %}
        # Define state
        state: "{{ is_state('binary_sensor.garage_door_input', 'off') }}"
        
        # Open Action
        open_cover:
          - condition: state
            entity_id:
              - binary_sensor.garage_door_input
            state: 'on'
            match: all
          - target:
              entity_id:
                - switch.garage_door
            action: switch.turn_on
          - delay: 0:00:10 # Opening time in seconds
          - target:
              entity_id:
                - binary_sensor.garage_door_input
            action: input_boolean.turn_off
            
        # Close Action
        close_cover:
          - condition: state
            entity_id:
              - binary_sensor.garage_door_input
            state: 'off'
            match: all
          - target:
              entity_id:
                - switch.garage_door
            action: switch.turn_on
          - delay: 0:00:10 # Closing time in seconds
          - target:
              entity_id:
                - binary_sensor.garage_door_input
            action: input_boolean.turn_off
            
        # Stop Action
        stop_cover:
          - action: script.garage_door_stop
        
        default_entity_id: cover.garage
```
[![Donate with PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/donate/?business=A3X9JMT39M3U2&no_recurring=0&currency_code=EUR)

*If you like this project, please support me.*
