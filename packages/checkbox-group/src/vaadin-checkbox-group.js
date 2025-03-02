/**
 * @license
 * Copyright (c) 2018 - 2024 Vaadin Ltd.
 * This program is available under Apache License Version 2.0, available at https://vaadin.com/license/
 */
import { html, PolymerElement } from '@polymer/polymer/polymer-element.js';
import { DisabledMixin } from '@vaadin/a11y-base/src/disabled-mixin.js';
import { FocusMixin } from '@vaadin/a11y-base/src/focus-mixin.js';
import { Checkbox } from '@vaadin/checkbox/src/vaadin-checkbox.js';
import { defineCustomElement } from '@vaadin/component-base/src/define.js';
import { ElementMixin } from '@vaadin/component-base/src/element-mixin.js';
import { SlotObserver } from '@vaadin/component-base/src/slot-observer.js';
import { TooltipController } from '@vaadin/component-base/src/tooltip-controller.js';
import { FieldMixin } from '@vaadin/field-base/src/field-mixin.js';
import { ThemableMixin } from '@vaadin/vaadin-themable-mixin/vaadin-themable-mixin.js';

/**
 * `<vaadin-checkbox-group>` is a web component that allows the user to choose several items from a group of binary choices.
 *
 * ```html
 * <vaadin-checkbox-group label="Export data">
 *   <vaadin-checkbox value="0" label="Order ID"></vaadin-checkbox>
 *   <vaadin-checkbox value="1" label="Product name"></vaadin-checkbox>
 *   <vaadin-checkbox value="2" label="Customer"></vaadin-checkbox>
 *   <vaadin-checkbox value="3" label="Status"></vaadin-checkbox>
 * </vaadin-checkbox-group>
 * ```
 *
 * ### Styling
 *
 * The following shadow DOM parts are available for styling:
 *
 * Part name            | Description
 * ---------------------|----------------
 * `label`              | The slotted label element wrapper
 * `group-field`        | The checkbox elements wrapper
 * `helper-text`        | The slotted helper text element wrapper
 * `error-message`      | The slotted error message element wrapper
 * `required-indicator` | The `required` state indicator element
 *
 * The following state attributes are available for styling:
 *
 * Attribute           | Description                               | Part name
 * --------------------|-------------------------------------------|------------
 * `disabled`          | Set when the element is disabled          | :host
 * `invalid`           | Set when the element is invalid           | :host
 * `focused`           | Set when the element is focused           | :host
 * `has-label`         | Set when the element has a label          | :host
 * `has-value`         | Set when the element has a value          | :host
 * `has-helper`        | Set when the element has helper text      | :host
 * `has-error-message` | Set when the element has an error message | :host
 *
 * See [Styling Components](https://vaadin.com/docs/latest/styling/styling-components) documentation.
 *
 * @fires {CustomEvent} invalid-changed - Fired when the `invalid` property changes.
 * @fires {CustomEvent} value-changed - Fired when the `value` property changes.
 * @fires {CustomEvent} validated - Fired whenever the field is validated.
 *
 * @customElement
 * @extends HTMLElement
 * @mixes ThemableMixin
 * @mixes DisabledMixin
 * @mixes ElementMixin
 * @mixes FocusMixin
 * @mixes FieldMixin
 */
class CheckboxGroup extends FieldMixin(FocusMixin(DisabledMixin(ElementMixin(ThemableMixin(PolymerElement))))) {
  static get is() {
    return 'vaadin-checkbox-group';
  }

  static get template() {
    return html`
      <style>
        :host {
          display: inline-flex;
        }

        :host::before {
          content: '\\2003';
          width: 0;
          display: inline-block;
        }

        :host([hidden]) {
          display: none !important;
        }

        .vaadin-group-field-container {
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        [part='group-field'] {
          display: flex;
          flex-wrap: wrap;
        }

        :host(:not([has-label])) [part='label'] {
          display: none;
        }
      </style>

      <div class="vaadin-group-field-container">
        <div part="label">
          <slot name="label"></slot>
          <span part="required-indicator" aria-hidden="true"></span>
        </div>

        <div part="group-field">
          <slot></slot>
        </div>

        <div part="helper-text">
          <slot name="helper"></slot>
        </div>

        <div part="error-message">
          <slot name="error-message"></slot>
        </div>
      </div>

      <slot name="tooltip"></slot>
    `;
  }

  static get properties() {
    return {
      /**
       * An array containing values of the currently checked checkboxes.
       *
       * The array is immutable so toggling checkboxes always results in
       * creating a new array.
       *
       * @type {!Array<!string>}
       */
      value: {
        type: Array,
        value: () => [],
        notify: true,
        observer: '__valueChanged',
      },
    };
  }

  constructor() {
    super();

    this.__registerCheckbox = this.__registerCheckbox.bind(this);
    this.__unregisterCheckbox = this.__unregisterCheckbox.bind(this);
    this.__onCheckboxCheckedChanged = this.__onCheckboxCheckedChanged.bind(this);

    this._tooltipController = new TooltipController(this);
    this._tooltipController.addEventListener('tooltip-changed', (event) => {
      const tooltip = event.detail.node;
      if (tooltip && tooltip.isConnected) {
        // Tooltip element has been added to the DOM
        const inputs = this.__checkboxes.map((checkbox) => checkbox.inputElement);
        this._tooltipController.setAriaTarget(inputs);
      } else {
        // Tooltip element is no longer connected
        this._tooltipController.setAriaTarget([]);
      }
    });
  }

  /**
   * A collection of the checkboxes.
   *
   * @return {!Array<!Checkbox>}
   * @private
   */
  get __checkboxes() {
    return this.__filterCheckboxes([...this.children]);
  }

  /** @protected */
  ready() {
    super.ready();

    this.ariaTarget = this;

    // See https://github.com/vaadin/vaadin-web-components/issues/94
    this.setAttribute('role', 'group');

    const slot = this.shadowRoot.querySelector('slot:not([name])');
    this._observer = new SlotObserver(slot, ({ addedNodes, removedNodes }) => {
      const addedCheckboxes = this.__filterCheckboxes(addedNodes);
      const removedCheckboxes = this.__filterCheckboxes(removedNodes);

      addedCheckboxes.forEach(this.__registerCheckbox);
      removedCheckboxes.forEach(this.__unregisterCheckbox);

      const inputs = this.__checkboxes.map((checkbox) => checkbox.inputElement);
      this._tooltipController.setAriaTarget(inputs);

      this.__warnOfCheckboxesWithoutValue(addedCheckboxes);
    });

    this.addController(this._tooltipController);
  }

  /**
   * Override method inherited from `ValidateMixin`
   * to validate the value array.
   *
   * @override
   * @return {boolean}
   */
  checkValidity() {
    return !this.required || this.value.length > 0;
  }

  /**
   * @param {!Array<!Node>} nodes
   * @return {!Array<!Checkbox>}
   * @private
   */
  __filterCheckboxes(nodes) {
    return nodes.filter((child) => child instanceof Checkbox);
  }

  /**
   * @param {!Array<!Checkbox>} checkboxes
   * @private
   */
  __warnOfCheckboxesWithoutValue(checkboxes) {
    const hasCheckboxesWithoutValue = checkboxes.some((checkbox) => {
      const { value } = checkbox;

      return !checkbox.hasAttribute('value') && (!value || value === 'on');
    });

    if (hasCheckboxesWithoutValue) {
      console.warn('Please provide the value attribute to all the checkboxes inside the checkbox group.');
    }
  }

  /**
   * Registers the checkbox after adding it to the group.
   *
   * @param {!Checkbox} checkbox
   * @private
   */
  __registerCheckbox(checkbox) {
    checkbox.addEventListener('checked-changed', this.__onCheckboxCheckedChanged);

    if (this.disabled) {
      checkbox.disabled = true;
    }

    if (checkbox.checked) {
      this.__addCheckboxToValue(checkbox.value);
    } else if (this.value.includes(checkbox.value)) {
      checkbox.checked = true;
    }
  }

  /**
   * Unregisters the checkbox before removing it from the group.
   *
   * @param {!Checkbox} checkbox
   * @private
   */
  __unregisterCheckbox(checkbox) {
    checkbox.removeEventListener('checked-changed', this.__onCheckboxCheckedChanged);

    if (checkbox.checked) {
      this.__removeCheckboxFromValue(checkbox.value);
    }
  }

  /**
   * Override method inherited from `DisabledMixin`
   * to propagate the `disabled` property to the checkboxes.
   *
   * @param {boolean} newValue
   * @param {boolean} oldValue
   * @override
   * @protected
   */
  _disabledChanged(newValue, oldValue) {
    super._disabledChanged(newValue, oldValue);

    // Prevent updating the `disabled` property for the checkboxes at initialization.
    // Otherwise, the checkboxes may end up enabled regardless the `disabled` attribute
    // intentionally added by the user on some of them.
    if (!newValue && oldValue === undefined) {
      return;
    }

    if (oldValue !== newValue) {
      this.__checkboxes.forEach((checkbox) => {
        checkbox.disabled = newValue;
      });
    }
  }

  /**
   * @param {string} value
   * @private
   */
  __addCheckboxToValue(value) {
    if (!this.value.includes(value)) {
      this.value = [...this.value, value];
    }
  }

  /**
   * @param {string} value
   * @private
   */
  __removeCheckboxFromValue(value) {
    if (this.value.includes(value)) {
      this.value = this.value.filter((v) => v !== value);
    }
  }

  /**
   * @param {!CustomEvent} event
   * @private
   */
  __onCheckboxCheckedChanged(event) {
    const checkbox = event.target;

    if (checkbox.checked) {
      this.__addCheckboxToValue(checkbox.value);
    } else {
      this.__removeCheckboxFromValue(checkbox.value);
    }
  }

  /**
   * @param {string | null | undefined} value
   * @param {string | null | undefined} oldValue
   * @private
   */
  __valueChanged(value, oldValue) {
    // Setting initial value to empty array, skip validation
    if (value.length === 0 && oldValue === undefined) {
      return;
    }

    this.toggleAttribute('has-value', value.length > 0);

    this.__checkboxes.forEach((checkbox) => {
      checkbox.checked = value.includes(checkbox.value);
    });

    if (oldValue !== undefined) {
      this.validate();
    }
  }

  /**
   * Override method inherited from `FocusMixin`
   * to prevent removing the `focused` attribute
   * when focus moves between checkboxes inside the group.
   *
   * @param {!FocusEvent} event
   * @return {boolean}
   * @protected
   */
  _shouldRemoveFocus(event) {
    return !this.contains(event.relatedTarget);
  }

  /**
   * Override method inherited from `FocusMixin`
   * to run validation when the group loses focus.
   *
   * @param {boolean} focused
   * @override
   * @protected
   */
  _setFocused(focused) {
    super._setFocused(focused);

    // Do not validate when focusout is caused by document
    // losing focus, which happens on browser tab switch.
    if (!focused && document.hasFocus()) {
      this.validate();
    }
  }
}

defineCustomElement(CheckboxGroup);

export { CheckboxGroup };
